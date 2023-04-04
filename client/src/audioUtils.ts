//import { Downloader } from './downloader';

const FILTER_FREQUENCY = 100;
const THRESHOLD = 0.9;
const SAMPLE_SKIP = 350;
const PEAK_GAIN = 15;
const MIN_ANIMATION_TIME = 3;
//const downloader = new Downloader();
const PROXY_URL = 'https://cors-anywhere.herokuapp.com/';

export async function getAudioBeats(audioUrl: string, setAudioSource: Function, setAudioBeats: Function) {

  // downloader.getMP3({videoId: "Vhd6Kc4TZls", name: "Cold Funk - Funkorama.mp3"}, function(err: any, res: any) {
  //     if(err)
  //         throw err;
  //     else{
  //         console.log("Song was downloaded: " + res.file);
  //     }
  // });
  //
  // return ytdl(audioUrl, {quality: 'highestaudio' })
  //   .then((res: any) => res.arrayBuffer())
  //   .then((audioData: ArrayBuffer) => { 
  //     return new AudioContext().decodeAudioData(audioData);
  //   })
  //   .then((audioBuffer: AudioBuffer) => {
  //     const audioContext = new AudioContext();
  //     const audioBufferSource = audioContext.createBufferSource();
  //     audioBufferSource.buffer = audioBuffer;
  //     audioBufferSource.connect(audioContext.destination);
  //     setAudioSource(audioBufferSource);
  //     return analyze(audioBuffer, FILTER_FREQUENCY, THRESHOLD, SAMPLE_SKIP, PEAK_GAIN, MIN_ANIMATION_TIME)
  //   })
  //   .then((songData: any[]) => {
  //     setAudioBeats(songData);
  //  })
  return null;
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

