import React, { useState } from "react";
import fileDownload from 'js-file-download';
import './App.css';
import { useFilePicker } from 'react-sage';

const getVideo = async () => {
  const searchParams = new URLSearchParams({ url: `https://music.youtube.com/watch?v=rDBbaGCCIhk` });

  return fetch('/download?' + searchParams)
    .then(res => res.blob())
    .then(data => fileDownload(data));
};

const filePicker = (HiddenFileInput, onClick) => {
  return (
    <div>
      <HiddenFileInput />
      <button onClick={onClick} className={'download-button'}> Upload Video </button>  
    </div>
  );
};

const downloadButton = (audio, video) => {
  return video && audio ? 
    (<button onClick={getVideo} className={'download-button'}> Download </button>) : null
}

const displayVideoPreview = (videoStream) => {
  const videoElement = document.querySelector('video');
  const videoUrl=window.URL.createObjectURL(videoStream.data);

  videoElement.src = videoUrl;
}

function App() {
  const [audio, setAudio] = useState(`https://music.youtube.com/watch?v=rDBbaGCCIhk`);
  const { files, errors, onClick, HiddenFileInput } = useFilePicker();
  const currentVideo = files[0] || null;

  if (currentVideo) {
    displayVideoPreview(currentVideo);
  }

  return (
    <div className='App'>
      <header className='App-header'>
        <button onClick={getVideo} className={'download-button'}> Upload Music </button>
        {filePicker(HiddenFileInput, onClick)}
        {downloadButton(audio, currentVideo)} 
      </header>
      <video id="video" type="video/mp4" controls></video>
      <canvas id="canvas"></canvas>
    </div>
  );
}

export default App;
