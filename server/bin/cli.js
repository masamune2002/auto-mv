#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const { processVideo } = require('../src/video');
const { createWorkingDirectory, ALLOWED_VIDEO_EXTS, ALLOWED_AUDIO_EXTS } = require('../src/utils');

/**
 * In directory mode (if --dir is provided), the program processes all videos in a target folder.
 * Otherwise, it processes a single video/audio pair.
 */
async function main() {
  const args = minimist(process.argv.slice(2), {
    string: ['audio', 'video', 'output', 'vidDir', 'audDir', 'processedDir', 'outDir'],
    alias: { a: 'audio', v: 'video', o: 'output', d: 'dir' },
    default: {
      offsetBegin: '0',
      offsetEnd: '0',
      cf: '0',
      vidDir: path.join(process.cwd(), 'input', 'video'),
      audDir: path.join(process.cwd(), 'input', 'audio'),
      processedDir: path.join(process.cwd(), 'input', 'video', 'processed'),
      outDir: path.join(process.cwd(), 'output')
    }
  });
  const offsetBegin = parseFloat(args.ob) || 0;
  const offsetEnd = parseFloat(args.oe) || 0;
  const cf = parseInt(args.cf) || 0;
  
  if (args.dir) {
    const videoDir = args.vidDir;
    const audioDir = args.audDir;
    const processedDir = args.processedDir; // for original videos
    const outDir = args.outDir;             // for processed output videos

    if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir, { recursive: true });
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    let videoFiles = fs.readdirSync(videoDir).filter(file => {
      console.log(file)
      return ALLOWED_VIDEO_EXTS.includes(path.extname(file).toLowerCase());
    });
    if (videoFiles.length === 0) {
      console.error("No video files found in", videoDir);
      process.exit(1);
    }
    let audioFiles = fs.readdirSync(audioDir).filter(file => {
      return ALLOWED_AUDIO_EXTS.includes(path.extname(file).toLowerCase());
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
        await processVideo(workingVideoPath, audioPath, finalOutput, workingDir, offsetBegin, offsetEnd, cf);
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
    await processVideo(videoFile, audioFile, outputFile, workingDir, offsetBegin, offsetEnd, cf);
    console.log("Video created successfully:", outputFile);
  }
}

main().catch(err => {
  console.error("Error:", err);
});

