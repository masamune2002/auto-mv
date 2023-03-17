const express = require("express");
const ytdl = require('ytdl-core');

const PORT = process.env.PORT || 3001;

const app = express();

app.get('/health', (req, res) => {
  res.send(true);
});

app.get('/download', (req, res) => {
    const url = req.query.url;
    res.header('Content-Disposition', 'attachment; filename="audio.mp3"');
    return ytdl(url, { quality: 'highestaudio' }).pipe(res);
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
