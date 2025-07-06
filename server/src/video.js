const { spawn } = require("child_process");
const ffmpeg = require("ffmpeg-static");

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

module.exports = {
  makeClip,
};
