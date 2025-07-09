const fs = require('fs');
const path = require('path');
const ffmpeg = require("ffmpeg-static");
const cliProgress = require('cli-progress');
const { spawn, execSync } = require('child_process');
const { getBeatsWithProgress } = require('./audio');
const { PROGRESS_BAR_OPTIONS } = require('./utils');

/**
 * Processes a single video file using the provided audio file.
 * The workingDir is used for temporary files.
 * The final processed video is written to outputFile.
 */
const processVideo = async function(videoFile, audioFile, outputFile, workingDir, offsetBegin, offsetEnd, cf) {
  const trimmedVideo = path.join(workingDir, 'trimmed_video.mp4');
  console.log(`Trimming video (offsetBegin=${offsetBegin}, offsetEnd=${offsetEnd})...`);
  await trimVideoWithSpinner(videoFile, trimmedVideo, offsetBegin, offsetEnd);
  console.log("Detecting beats...");
  const beats = await getBeatsWithProgress(audioFile, workingDir);
  if (beats.length < cf + 2) {
    throw new Error("Not enough beats detected for the given cf value.");
  }
  const dynSegmentsDir = path.join(workingDir, 'dyn_segments');
  const { segments, targetTotalDuration } = await generateDynamicClips(trimmedVideo, beats, cf, dynSegmentsDir);
  if (segments.length === 0) {
    throw new Error("No segments were generated.");
  }
  console.log("Concatenating segments and combining with audio...");
  concatenateSegmentsWithProgress(segments, outputFile, audioFile, targetTotalDuration, workingDir);
};

/**
 * From the trimmed video, extract dynamic clips based on beat intervals.
 * The "cf" (clip factor) option determines how many beats to skip between boundaries.
 * The clips are stored in tempDir.
 *
 * Returns an object with:
 *   - segments: array of objects { path, duration }
 *   - targetTotalDuration: total duration of all clips.
 */
const generateDynamicClips = async (videoFile, beats, cf, tempDir) => {
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
  const segments = [];
  const step = cf + 1;
  const numIntervals = Math.floor((beats.length - 1) / step);
  if (numIntervals < 1) {
    console.error("Not enough beats for the given cf value.");
    return { segments, targetTotalDuration: 0 };
  }
  let targetTotalDuration = 0;
  const effectiveDuration = await getVideoDuration(videoFile);
  const bar = new cliProgress.SingleBar(
    { ...PROGRESS_BAR_OPTIONS, title: 'Extracting dynamic clips' },
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
 * Wrapper for trimming the video that displays a spinner.
 * Uses fast stream-copy trimming.
 * Ora (an ES module) is imported dynamically.
 */
const trimVideoWithSpinner = async (inputVideo, outputVideo, offsetBegin, offsetEnd) => {
  const oraModule = await import('ora');
  const ora = oraModule.default;
  const spinner = ora('Trimming video...').start();
  try {
    trimVideoFast(inputVideo, outputVideo, offsetBegin, offsetEnd);
    spinner.succeed('Trimming complete');
  } catch (e) {
    spinner.fail('Trimming failed');
    throw e;
  }
}

const makeClip = (inputFilePath, outputFilePath, startTime, duration) => {
  return new Promise((resolve, reject) => {
    // ffmpeg command to create a clip
    const ffmpegArgs = [
      "-y",
      "-i",
      inputFilePath,
      "-ss",
      startTime,
      "-t",
      duration,
      "-c",
      "copy", // Copy codec for fast extraction
      outputFilePath,
    ];

    const ffmpegProcess = spawn(ffmpeg, ffmpegArgs);

    ffmpegProcess.stderr.on("data", (data) => {
      // Parse stderr data to extract percentage completion
      const dataString = data.toString();
      const match = dataString.match(/time=(\d+:\d+:\d+)/);
      if (match && match[1]) {
        const currentTime = match[1];
        console.log(`Processing: ${currentTime}`);
        // You can use currentTime to calculate percentage completion or display it as needed
      }
    });

    ffmpegProcess.on("close", (code) => {
      resolve(code);
    });

    ffmpegProcess.on("error", (code) => {
      console.log("Error in ffmpeg. Code " + code);
      reject(code);
    });
  });
};

/**
 * Concatenates the extracted segments into one video file, then combines it with the audio,
 * trimming the final output to match the total beat interval duration.
 * Temporary files are stored in workingDir.
 */
const concatenateSegments = (segments, output, audioFile, targetDuration, workingDir) => {
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
const concatenateSegmentsWithProgress = (segments, output, audioFile, targetDuration, workingDir) => {
  const bar = new cliProgress.SingleBar(
    { ...PROGRESS_BAR_OPTIONS, title: 'Concatenating segments' },
    cliProgress.Presets.shades_classic
  );
  bar.start(100, 0);
  concatenateSegments(segments, output, audioFile, targetDuration, workingDir);
  bar.update(100);
  bar.stop();
};

/**
 * Fast trims the video using stream copy.
 */
const trimVideoFast = async (inputVideo, outputVideo, offsetBegin, offsetEnd) => {
  const totalDuration = await getVideoDuration(inputVideo);
  if (totalDuration < offsetBegin + offsetEnd) {
    throw new Error("Video is shorter than the sum of the provided offsets.");
  }
  const effectiveDuration = totalDuration - offsetBegin - offsetEnd;
  execSync(
    `ffmpeg -y -ss ${offsetBegin} -i "${inputVideo}" -t ${effectiveDuration} -c copy "${outputVideo}"`,
    { stdio: 'inherit' }
  );
};

/**
 * Uses ffprobe to get the duration of a video file.
 */
const getVideoDuration = async (videoFile) => {
  const duration = execSync(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${videoFile}"`
  ).toString().trim();
  return parseFloat(duration);
};

module.exports = {
  makeClip,
  generateDynamicClips,
  trimVideoFast,
  trimVideoWithSpinner,
  getVideoDuration,
  processVideo,
  concatenateSegments,
  concatenateSegmentsWithProgress
};
