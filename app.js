const { spawn, execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cliProgress = require('cli-progress');
const minimist = require('minimist');

// Allowed file extensions
const allowedVideoExts = ['.mkv', '.mov', '.mp4', '.wmv', '.avi'];
const allowedAudioExts = ['.mp3', '.flac', '.ogg', '.wav'];

// Shared progress bar options
const progressBarOptions = {
  format: '{title} [{bar}] {percentage}% | {value}/{total}',
  barCompleteChar: '#',
  barIncompleteChar: '-',
  hideCursor: true
};

/**
 * Creates a unique working directory inside a base "temp" folder.
 */
function createWorkingDirectory() {
  const baseTempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(baseTempDir)) {
    fs.mkdirSync(baseTempDir);
  }
  const uniqueId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  const workingDir = path.join(baseTempDir, uniqueId);
  fs.mkdirSync(workingDir);
  return workingDir;
}

/**
 * Uses ffprobe to get the duration of a video file.
 */
function getVideoDuration(videoFile) {
  const duration = execSync(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${videoFile}"`
  ).toString().trim();
  return parseFloat(duration);
}

/**
 * Fast trims the video using stream copy.
 */
function trimVideoFast(inputVideo, outputVideo, ob, oe) {
  const totalDuration = getVideoDuration(inputVideo);
  if (totalDuration < ob + oe) {
    throw new Error("Video is shorter than the sum of the provided offsets.");
  }
  const effectiveDuration = totalDuration - ob - oe;
  execSync(
    `ffmpeg -y -ss ${ob} -i "${inputVideo}" -t ${effectiveDuration} -c copy "${outputVideo}"`,
    { stdio: 'inherit' }
  );
}

/**
 * Wrapper for trimming the video that displays a spinner.
 * Uses fast stream-copy trimming.
 * Ora (an ES module) is imported dynamically.
 */
async function trimVideoWithSpinner(inputVideo, outputVideo, ob, oe) {
  const oraModule = await import('ora');
  const ora = oraModule.default;
  const spinner = ora('Trimming video...').start();
  try {
    trimVideoFast(inputVideo, outputVideo, ob, oe);
    spinner.succeed('Trimming complete');
  } catch (e) {
    spinner.fail('Trimming failed');
    throw e;
  }
}

/**
 * Converts an input audio file to a WAV file for beat detection.
 */
function convertToWav(inputFile, outputFile) {
  execSync(`ffmpeg -y -i "${inputFile}" -ar 44100 -ac 1 "${outputFile}"`);
}

/**
 * Uses aubio beat detection (via a temporary WAV conversion) to detect beats.
 * The temporary WAV file is stored in workingDir.
 */
function getBeats(audioFile, workingDir) {
  return new Promise((resolve, reject) => {
    const tempWav = path.join(workingDir, 'temp_audio.wav');
    convertToWav(audioFile, tempWav);
    exec(`aubio beat "${tempWav}"`, (error, stdout, stderr) => {
      fs.unlinkSync(tempWav);
      if (error) {
        reject(error);
      } else {
        const beats = stdout
          .split('\n')
          .filter(line => line.trim().length > 0)
          .map(parseFloat);
        resolve(beats);
      }
    });
  });
}

/**
 * Wrapper for beat detection that displays a progress bar.
 */
async function getBeatsWithProgress(audioFile, workingDir) {
  const bar = new cliProgress.SingleBar(
    { ...progressBarOptions, title: 'Detecting beats' },
    cliProgress.Presets.shades_classic
  );
  bar.start(100, 0);
  const beats = await getBeats(audioFile, workingDir);
  bar.update(100);
  bar.stop();
  return beats;
}

/**
 * From the trimmed video, extract dynamic clips based on beat intervals.
 * The "cf" (clip factor) option determines how many beats to skip between boundaries.
 * The clips are stored in tempDir.
 *
 * Returns an object with:
 *   - segments: array of objects { path, duration }
 *   - targetTotalDuration: total duration of all clips.
 */
function generateDynamicClips(videoFile, beats, cf, tempDir) {
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
  const segments = [];
  const step = cf + 1;
  const numIntervals = Math.floor((beats.length - 1) / step);
  if (numIntervals < 1) {
    console.error("Not enough beats for the given cf value.");
    return { segments, targetTotalDuration: 0 };
  }
  let targetTotalDuration = 0;
  const effectiveDuration = getVideoDuration(videoFile);
  const bar = new cliProgress.SingleBar(
    { ...progressBarOptions, title: 'Extracting dynamic clips' },
    cliProgress.Presets.shades_classic
  );
  bar.start(numIntervals, 0);
  for (let k = 0; k < numIntervals; k++) {
    const i = k * step;
    const j = i + step;
    const clipDuration = beats[j] - beats[i];
    targetTotalDuration += clipDuration;
    const normalizedIndex = numIntervals > 1 ? k / (numIntervals - 1) : 0;
    const maxStart = effectiveDuration - clipDuration;
    const segmentStart = normalizedIndex * maxStart;
    const outputPath = path.join(tempDir, `dyn_segment_${k}.mp4`);
    try {
      execSync(
        `ffmpeg -y -ss ${segmentStart} -i "${videoFile}" -t ${clipDuration} -an -vf "scale=iw:ih,format=yuv420p" -c:v libx264 -preset ultrafast "${outputPath}"`,
        { stdio: 'ignore' }
      );
      segments.push({ path: outputPath, duration: clipDuration });
    } catch (err) {
      console.error("Error generating segment:", err);
    }
    bar.increment();
  }
  bar.stop();
  return { segments, targetTotalDuration };
}

/**
 * Concatenates the extracted segments into one video file, then combines it with the audio,
 * trimming the final output to match the total beat interval duration.
 * Temporary files are stored in workingDir.
 */
function concatenateSegments(segments, output, audioFile, targetDuration, workingDir) {
  const concatFile = path.join(workingDir, 'segments.txt');
  const fileList = segments
    .map(seg => `file '${path.resolve(seg.path).replace(/\\/g, '/')}'`)
    .join('\n');
  fs.writeFileSync(concatFile, fileList);
  const tempVideo = path.join(workingDir, 'temp_video.mp4');
  execSync(`ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c copy "${tempVideo}"`, { stdio: 'inherit' });
  execSync(
    `ffmpeg -y -i "${tempVideo}" -i "${audioFile}" -t ${targetDuration} -c:v libx264 -preset fast -crf 22 -c:a aac -b:a 192k "${output}"`,
    { stdio: 'inherit' }
  );
  fs.unlinkSync(concatFile);
  fs.unlinkSync(tempVideo);
}

/**
 * Wrapper for concatenation that displays a progress bar.
 */
function concatenateSegmentsWithProgress(segments, output, audioFile, targetDuration, workingDir) {
  const bar = new cliProgress.SingleBar(
    { ...progressBarOptions, title: 'Concatenating segments' },
    cliProgress.Presets.shades_classic
  );
  bar.start(100, 0);
  concatenateSegments(segments, output, audioFile, targetDuration, workingDir);
  bar.update(100);
  bar.stop();
}

/**
 * Processes a single video file using the provided audio file.
 * The workingDir is used for temporary files.
 * The final processed video is written to outputFile.
 */
async function processVideo(videoFile, audioFile, outputFile, workingDir, ob, oe, cf) {
  const trimmedVideo = path.join(workingDir, 'trimmed_video.mp4');
  console.log(`Trimming video (ob=${ob}, oe=${oe})...`);
  await trimVideoWithSpinner(videoFile, trimmedVideo, ob, oe);
  console.log("Detecting beats...");
  const beats = await getBeatsWithProgress(audioFile, workingDir);
  if (beats.length < cf + 2) {
    throw new Error("Not enough beats detected for the given cf value.");
  }
  const dynSegmentsDir = path.join(workingDir, 'dyn_segments');
  const { segments, targetTotalDuration } = generateDynamicClips(trimmedVideo, beats, cf, dynSegmentsDir);
  if (segments.length === 0) {
    throw new Error("No segments were generated.");
  }
  console.log("Concatenating segments and combining with audio...");
  concatenateSegmentsWithProgress(segments, outputFile, audioFile, targetTotalDuration, workingDir);
}

/**
 * Main function.
 * In directory mode (if --dir is provided), the program processes all videos in a target folder.
 * Otherwise, it processes a single video/audio pair.
 */
async function main() {
  const args = minimist(process.argv.slice(2), {
    string: ['audio', 'video', 'output', 'vidDir', 'audDir', 'processedDir', 'outDir'],
    alias: { a: 'audio', v: 'video', o: 'output', d: 'dir' },
    default: {
      ob: '0',
      oe: '0',
      cf: '0',
      vidDir: path.join(process.cwd(), 'input', 'videos'),
      audDir: path.join(process.cwd(), 'input', 'music'),
      processedDir: path.join(process.cwd(), 'processed'),
      outDir: path.join(process.cwd(), 'output')
    }
  });
  const ob = parseFloat(args.ob) || 0;
  const oe = parseFloat(args.oe) || 0;
  const cf = parseInt(args.cf) || 0;
  
  if (args.dir) {
    const videoDir = args.vidDir;
    const audioDir = args.audDir;
    const processedDir = args.processedDir; // for original videos
    const outDir = args.outDir;             // for processed output videos

    if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir, { recursive: true });
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    let videoFiles = fs.readdirSync(videoDir).filter(file => {
      return allowedVideoExts.includes(path.extname(file).toLowerCase());
    });
    if (videoFiles.length === 0) {
      console.error("No video files found in", videoDir);
      process.exit(1);
    }
    let audioFiles = fs.readdirSync(audioDir).filter(file => {
      return allowedAudioExts.includes(path.extname(file).toLowerCase());
    });
    if (audioFiles.length === 0) {
      console.error("No audio files found in", audioDir);
      process.exit(1);
    }

    for (let file of videoFiles) {
      const videoPath = path.join(videoDir, file);
      console.log(`\nProcessing video: ${file}`);
      const workingDir = createWorkingDirectory();
      console.log(`Working directory: ${workingDir}`);

      // Move the video file into the working directory.
      const workingVideoPath = path.join(workingDir, file);
      fs.renameSync(videoPath, workingVideoPath);

      // Randomly select an audio file.
      const randomAudio = audioFiles[Math.floor(Math.random() * audioFiles.length)];
      const audioPath = path.join(audioDir, randomAudio);

      // Determine output file paths.
      // Original video: move to processed folder (unchanged name).
      const processedDest = path.join(processedDir, file);
      // Processed (output) video: placed directly in outDir.
      const videoTitle = path.basename(file, path.extname(file));
      const uniqueId = path.basename(workingDir);
      const finalOutput = path.join(outDir, `${videoTitle}_${uniqueId}.mp4`);

      try {
        await processVideo(workingVideoPath, audioPath, finalOutput, workingDir, ob, oe, cf);
        console.log("Processed video saved as:", finalOutput);
        // Move original video to processed folder (without renaming).
        fs.renameSync(workingVideoPath, processedDest);
        console.log("Original video moved to:", processedDest);
      } catch (err) {
        console.error("Error processing video:", err);
      }
      // Optionally clean up workingDir if desired.
    }
  } else {
    const audioFile = args.audio;
    const videoFile = args.video;
    const outputFile = args.output;
    if (!audioFile || !videoFile || !outputFile) {
      console.error(
        'Usage (file mode): node autoMv.js --audio <audio> --video <video> --output <output> [--ob <seconds>] [--oe <seconds>] [--cf <number>]'
      );
      process.exit(1);
    }
    const workingDir = createWorkingDirectory();
    console.log(`Using working directory: ${workingDir}`);
    await processVideo(videoFile, audioFile, outputFile, workingDir, ob, oe, cf);
    console.log("Video created successfully:", outputFile);
  }
}

main().catch(err => {
  console.error("Error:", err);
});

