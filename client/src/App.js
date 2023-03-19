import React, {useState} from "react";
import {useFilePicker} from 'react-sage';
import './App.css';
import { getAudioBeats } from './audioUtils.js';

const uploadVideoButton = (HiddenFileInput, onClick) => {
  return (
    <div className="upload-video-button-containter">
      <HiddenFileInput />
      <button onClick={onClick} className={'upload-video-button'}> Upload Video </button>
    </div>
  );
};

const playButton = (audioSource, audioBeats, video) => {
  return video && audioSource ?
    (<button onClick={() => {playVideo(audioSource, audioBeats)}} className={'download-button'}> Download </button>) : null
}

const playVideo = (audioSource, audioBeats) => {
  const video = document.querySelector('video');
  audioSource.start();
  video.play();
  const start = Date.now();
  let beatIndex = 0;
  setInterval(() => {
    const delta = Date.now() - start;
    const deltaSeconds = delta / 1000;
    // if current millis > next beat, fastforward
    // and set next beat to next next beat
    if (deltaSeconds > audioBeats[beatIndex].time) {
      console.log('beat', beatIndex, audioBeats[beatIndex].time); 
      video.currentTime += 30;
      beatIndex += 1;
    }
  }, 1000); // update about every ten milliseconds
}

const videoPreview = (videoUrl) => {
  if (!videoUrl) {
    return (<video className="video-player" controls/>);
  }
  return (<video className="video-player" preload="auto" src={videoUrl}></video>);
}

const uploadMusicButton = (audioUrl, setAudioSource, setAudioBeats) => {
  return (
    <button onClick={() => getAudioBeats(audioUrl, setAudioSource, setAudioBeats)} className={'download-button'}>
      Upload Music
    </button>
  );
}

function App() {
  const [audioBeats, setAudioBeats] = useState(null);
  const [audioSource, setAudioSource] = useState(null);
  const [audioUrl, setAudioUrl] = useState(`https://www.youtube.com/watch?v=TmtyIkkb2EI`);
  const [videoUrl, setVideoUrl] = useState(null);
  const {files, errors, onClick, HiddenFileInput} = useFilePicker();

  if (!videoUrl && files[0]) {
    setVideoUrl(window.URL.createObjectURL(files[0]));
  }

  return (
    <div className="App">
      <div className="app-layout">
        <div className="controls-panel">
          <div className="audio-panel">
            <input value={audioUrl} onChange={event => setAudioUrl(event.target.value)}></input>
            {uploadMusicButton(audioUrl, setAudioSource, setAudioBeats)}
          </div>
          <div className="video-panel">
            {uploadVideoButton(HiddenFileInput, onClick)}
          </div>
          <div className="download-panel">
            {playButton(audioSource, audioBeats, videoUrl)}
          </div>
        </div>
        <div className="preview-panel">
          <div className="video-display">
            {videoPreview(videoUrl)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
