import React, { useEffect, useRef } from 'react';
import { MediaPlayer } from 'dashjs';

const VideoPlayer = ({ url }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      const player = MediaPlayer().create();
      player.initialize(videoRef.current, url, true);
    }
  }, [url]);

  return (
    <video
      ref={videoRef}
      controls
      style={{ width: '100%', height: 'auto' }}
      playsInline
    />
  );
};

export default VideoPlayer;

