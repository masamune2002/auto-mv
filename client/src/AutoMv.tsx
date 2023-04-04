import React, {useState} from "react"; import {useFilePicker} from 'react-sage';
import './AutoMv.css';
import { getAudioBeats } from './audioUtils';

interface OptionsMap {
  threshold: number,
  filterFrequency: number,
  sampleSkip: number,
  peakGain: number,
  minAnimationTime: number
};

const DEFAULT_OPTIONS = {
  threshold: 0.9,
  filterFrequency: 100,
  sampleSkip: 350,
  peakGain: 15,
  minAnimationTime: 3
};

const uploadVideoButton = (HiddenFileInput: any, onClick: React.MouseEventHandler<HTMLInputElement>) => {
  return (
    <div className="upload-video-button-containter">
      <HiddenFileInput />
      <button onClick={onClick} className={'upload-video-button'}> Upload Video </button>
    </div>
  );
};

const playButton = (audioSource: any, audioBeats: any[], videoUrl: string) => {
  return videoUrl && audioSource ?
    (<button onClick={() => {playVideo(audioSource, audioBeats)}} className={'download-button'}> Download </button>) : null
};

const playVideo = (audioSource: any, audioBeats: any[]) => {
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
};

const optionsPanel = (options: OptionsMap, setOptions: Function) => {
  console.log(options);
  return (
    <div className="options-panel">
      <span> Beat Threshold</span>
      <input
        value={options.threshold}
        onChange={(event) => setOptions(Object.assign({}, {...options, threshold: event.target.value}))}
      />
      <span>Filter Frequency</span>
      <input
        value={options.filterFrequency}
        onChange={(event) => setOptions(Object.assign({}, {...options, filterFrequency: event.target.value}))}
      />
      <span>Sample Skip</span>
      <input
        value={options.sampleSkip}
        onChange={(event) => setOptions(Object.assign({}, {...options, sampleSkip: event.target.value}))}
      />
      <span>Peak Gain</span>
      <input
        value={options.peakGain}
        onChange={(event) => setOptions(Object.assign({}, {...options, peakGain: event.target.value}))}
      />
      <span>Minimum Animation Time</span>
      <input
        value={options.minAnimationTime}
        onChange={(event) => setOptions(Object.assign({}, {...options, minAnimationTime: event.target.value}))}
      />
    </div>
 );
}

const videoPreview = (videoUrl: string) => {
  if (!videoUrl) {
    return (<video className="video-player" controls/>);
  }
  return (<video className="video-player" preload="auto" src={videoUrl}></video>);
};

const uploadMusicButton = (audioUrl: string, setAudioSource: Function, setAudioBeats: Function) => {
  return (
    <button onClick={() => getAudioBeats(audioUrl, setAudioSource, setAudioBeats)} className={'download-button'}>
      Upload Music
    </button>
  );
};

function App() {
  const [audioBeats, setAudioBeats] = useState(null);
  const [audioSource, setAudioSource] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
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
          {optionsPanel(options, setOptions)}
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
