const FILTER_FREQUENCY = 100;
const THRESHOLD = 0.9;
const SAMPLE_SKIP = 350;
const PEAK_GAIN = 15;
const MIN_ANIMATION_TIME = 3;

export async function getAudioBeats(audioUrl: string, setAudioSource: Function, setAudioBeats: Function) {
  const searchParams = new URLSearchParams({url: audioUrl});
  return fetch('/api/download?' + searchParams)
    .then(res => res.arrayBuffer())
    .then(audioData => { 
      return new AudioContext().decodeAudioData(audioData);
    })
   .then(audioBuffer => {
     const audioContext = new AudioContext();
     const audioBufferSource = audioContext.createBufferSource();
     audioBufferSource.buffer = audioBuffer;
     audioBufferSource.connect(audioContext.destination);
     setAudioSource(audioBufferSource);
       return analyze(audioBuffer, FILTER_FREQUENCY, THRESHOLD, SAMPLE_SKIP, PEAK_GAIN, MIN_ANIMATION_TIME)
     })
     .then(songData => {
       console.log('audioBeats', songData);
       setAudioBeats(songData);
     });
}

export async function analyze(audioBuffer: any, filterFrequency: number, threshold: number, sampleSkip: number,
                              peakGain: number, minAnimationTime: number) {
  const offlineContext = new OfflineAudioContext(1, audioBuffer.length, audioBuffer.sampleRate);
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
          time
        });
      }
    }
    i += sampleSkip;
  }
  return songData;
};

