import React, {useState} from "react";
import {useFilePicker} from 'react-sage'; import './App.css';

const FILTER_FREQUENCY = 100;
const THRESHOLD = 0.8;
const SAMPLE_SKIP = 350;
const PEAK_GAIN = 15;
const MIN_ANIMATION_TIME = 0.4;

const getAudioBeats = async (setAudioSource, setAudioBeats) => {
  const searchParams = new URLSearchParams({url: `https://music.youtube.com/watch?v=rDBbaGCCIhk`});

  return fetch('/download?' + searchParams)
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
   })
};

const analyze = async (audioBuffer, filterFrequency, threshold, sampleSkip, peakGain, minAnimationTime) => {
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

const filePicker = (HiddenFileInput, onClick) => {
  return (
    <div>
      <HiddenFileInput />
      <button onClick={onClick} className={'download-button'}> Upload Video </button>
    </div>
  );
};

const playButton = (audioSource, audioBeats, video) => {
  return video && audioSource ?
    (<button onClick={() => {playVideo(audioSource, audioBeats)}} className={'download-button'}> Download </button>) : null
}

const playVideo = (audioSource, audioBeats) => {
  audioSource.start();
  const video = document.querySelector('video');
  video.play();
  const start = Date.now();
  let beatIndex = 0;
  setInterval(() => {
    const delta = Date.now() - start;
    const deltaSeconds = delta / 1000;
    console.log(deltaSeconds);
    console.log(beatIndex);
    console.log(audioBeats);
    // if current millis > next beat, fastforward
    // and set next beat to next next beat
    if (deltaSeconds > audioBeats[beatIndex].time) {
      console.log('Beat');
      video.currentTime += 60;
      beatIndex += 4;
    }
  }, 10); // update about every second
}

const displayVideoPreview = (videoStream) => {
  const videoElement = document.querySelector('video');
  const videoUrl = window.URL.createObjectURL(videoStream);
  console.log(videoStream);
  videoElement.src = videoUrl;
}

function App() {
  const [audioBeats, setAudioBeats] = useState(null);
  const [audioSource, setAudioSource] = useState(null);
  const [audioUrl, setAudioUrl] = useState(`https://music.youtube.com/watch?v=rDBbaGCCIhk`);
  const [nextBeat, setNextBeat] = useState(null);
  const {files, errors, onClick, HiddenFileInput} = useFilePicker();
  const currentVideo = files[0] || null;

  if (currentVideo) {
    displayVideoPreview(currentVideo);
  }

  return (
    <div className='App'>
      <button onClick={() => getAudioBeats(setAudioSource, setAudioBeats)} className={'download-button'}> Upload Music </button>
      {filePicker(HiddenFileInput, onClick)}
      {playButton(audioSource, audioBeats, currentVideo)}
      <video id="video" type="video/mp4" controls></video>
    </div>
  );
}

export default App;
