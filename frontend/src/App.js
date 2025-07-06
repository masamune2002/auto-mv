import React from 'react';
import VideoPlayer from './VideoPlayer';

function App() {
  // Example DASH manifest URL (Big Buck Bunny)
  const streamUrl = 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd';

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Dash.js React Player</h1>
      <VideoPlayer url={streamUrl} />
    </div>
  );
}

export default App;
