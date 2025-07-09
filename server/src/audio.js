const fs = require('fs');
const ytdl = require("ytdl-core");
const cliProgress = require('cli-progress');
const path = require('path');
const { execSync, exec } = require('child_process');
const { PROGRESS_BAR_OPTIONS } = require('./utils');

const getSongData = (songUrl) => {
  return new Promise((resolve, reject) => {
    songData = [];
    const stream = ytdl(songUrl, { filter: "audioonly" });
    stream.on("data", songData.push.bind(songData));
    stream.on("end", resolve(songData));
    stream.on("error", reject);
  });
};

/**
 * Converts an input audio file to a WAV file for beat detection.
 */
const convertToWav = (inputFile, outputFile) => {
  execSync(`ffmpeg -y -i "${inputFile}" -ar 44100 -ac 1 "${outputFile}"`);
}

/**
 * Uses aubio beat detection (via a temporary WAV conversion) to detect beats.
 * The temporary WAV file is stored in workingDir.
 */
const getBeats = (audioFile, workingDir) => {
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
const getBeatsWithProgress = async (audioFile, workingDir) => {
  const bar = new cliProgress.SingleBar(
    { ...PROGRESS_BAR_OPTIONS, title: 'Detecting beats' },
    cliProgress.Presets.shades_classic
  );
  bar.start(100, 0);
  const beats = await getBeats(audioFile, workingDir);
  bar.update(100);
  bar.stop();
  return beats;
}


const getBeatTimestamps = async (
  audioBuffer,
  filterFrequency,
  threshold,
  sampleSkip,
  peakGain,
  minAnimationTime
) => {
  const offlineContext = new OfflineAudioContext(
    1,
    audioBuffer.length,
    audioBuffer.sampleRate
  );
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  const filter = offlineContext.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterFrequency;
  filter.Q.value = 1;

  const filter2 = offlineContext.createBiquadFilter();
  filter2.type = "peaking";
  filter2.frequency.value = filterFrequency;
  filter2.Q.value = 1;
  filter2.gain.value = peakGain;

  source.connect(filter2);
  filter2.connect(filter);
  filter.connect(offlineContext.destination);
  source.start();
  const buffer = await offlineContext.startRendering();

  const channelData = buffer.getChannelData(0);

  const songData = [];
  for (let i = 0; i < channelData.length; ++i) {
    if (channelData[i] > threshold) {
      const time = i / buffer.sampleRate;
      const previousTime = songData.length
        ? songData[songData.length - 1].time
        : 0;
      if (time - previousTime > minAnimationTime) {
        songData.push({
          data: channelData[i],
          time,
        });
      }
    }
    i += sampleSkip;
  }
  return songData;
};

module.exports = {
  getBeats,
  getBeatsWithProgress,
  getSongData,
  convertToWav,
  getBeatTimestamps,
};
