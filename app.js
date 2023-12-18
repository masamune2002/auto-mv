const express = require("express");
const ffmpeg = require("ffmpeg-static");
const { spawn } = require("child_process");
const { getSongData } = require("./src/audio");
const { makeClip } = require("./src/video");

const app = express();
const port = 3000;

function getPeaksAtThreshold(data, threshold) {
  var peaksArray = [];
  var length = data.length;
  for (var i = 0; i < length; ) {
    if (data[i] > threshold) {
      peaksArray.push(i);
      // Skip forward ~ 1/4s to get past this peak.
      i += 10000;
    }
    i++;
  }
  return peaksArray;
}

app.get("/", (req, res) => {
  res.send("Hello, Express!");
});

app.get("/convert", (req, res) => {
  // Example: Convert an input file to an output file
  const inputFilePath = "input.mp4";
  const outputFilePath = "output.mp4";

  const ffmpegProcess = spawn(ffmpeg, ["-i", inputFilePath, outputFilePath]);

  ffmpegProcess.on("close", (code) => {
    if (code === 0) {
      res.send("Conversion successful!");
    } else {
      res.status(500).send("Conversion failed.");
    }
  });
});

app.get("/make-clip", (req, res) => {
  // Download song data
  const songUrl = "http://www.youtube.com/watch?v=aqz-KE-bpKQ";
  getSongData(songUrl).then((songData) => {
    const inputFilePath = "input.mp4";
    const outputFilePath = "output-clip.mp4";

    // Get start time and duration from query parameters
    const startTime = req.query.startTime || "00:10:00"; // Format: HH:MM:SS
    const duration = req.query.duration || "60"; // Duration in seconds

    makeClip(inputFilePath, outputFilePath, startTime, duration).then(
      (code) => {
        console.log(`Finished with code ${code}`);
        if (code === 0) {
          res.send("Clip created successfully!");
        } else {
          res.status(500).send("Clip creation failed.");
        }
      }
    );
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
