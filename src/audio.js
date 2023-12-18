const ytdl = require("ytdl-core");

const getSongData = (songUrl) => {
  return new Promise((resolve, reject) => {
    songData = [];
    const stream = ytdl(songUrl, { filter: "audioonly" });
    stream.on("data", songData.push.bind(songData));
    stream.on("end", resolve(songData));
    stream.on("error", reject);
  });
};

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
  getSongData,
  getBeatTimestamps,
};
