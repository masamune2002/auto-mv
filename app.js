const express = require('express');
const ffmpeg = require('ffmpeg-static');
const { spawn } = require('child_process');
const ytdl = require('ytdl-core');
const fs = require('fs');

const app = express();
const port = 3000;

function getPeaksAtThreshold(data, threshold) {
  var peaksArray = [];
  var length = data.length;
  for(var i = 0; i < length;) {
    if (data[i] > threshold) {
      peaksArray.push(i);
      // Skip forward ~ 1/4s to get past this peak.
      i += 10000;
    }
    i++;
  }
  return peaksArray;
}

app.get('/', (req, res) => {
  res.send('Hello, Express!');
});

app.get('/convert', (req, res) => {
  // Example: Convert an input file to an output file
  const inputFilePath = 'input.mp4';
  const outputFilePath = 'output.mp4';

  const ffmpegProcess = spawn(ffmpeg, ['-i', inputFilePath, outputFilePath]);

  ffmpegProcess.on('close', (code) => {
    if (code === 0) {
      res.send('Conversion successful!');
    } else {
      res.status(500).send('Conversion failed.');
    }
  });
});

app.get('/make-clip', (req, res) => {
  const songUrl = 'http://www.youtube.com/watch?v=aqz-KE-bpKQ';
  const stream = ytdl(songUrl, {filter: 'audioonly'});
  songData = [];
  stream.on('readable', function() {
  
    let data;

    while ((data = this.read()) !== null) {
      songData.push(data);
      console.log('inner ' + songData.length);
    }
  }); 
 console.log(songData.length); 
  
  const inputFilePath = 'input.mp4';
  const outputFilePath = 'output-clip.mp4';

  // Get start time and duration from query parameters
  const startTime = req.query.startTime || '00:10:00'; // Format: HH:MM:SS
  const duration = req.query.duration || '60'; // Duration in seconds
  console.log(startTime);

  // ffmpeg command to create a clip
  const ffmpegArgs = [
    '-i', inputFilePath,
    '-ss', startTime,
    '-t', duration,
    '-c', 'copy', // Copy codec for fast extraction
    outputFilePath,
  ];

  const ffmpegProcess = spawn(ffmpeg, ffmpegArgs);

  ffmpegProcess.stderr.on('data', (data) => {
    console.log('here');
    // Parse stderr data to extract percentage completion
    const dataString = data.toString();
    const match = dataString.match(/time=(\d+:\d+:\d+)/);
    if (match && match[1]) {
      const currentTime = match[1];
      console.log(`Processing: ${currentTime}`);
      // You can use currentTime to calculate percentage completion or display it as needed
    }
  });

  ffmpegProcess.on('close', (code) => {
    if (code === 0) {
      res.send('Clip created successfully!');
    } else {
      res.status(500).send('Clip creation failed.');
    }
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

