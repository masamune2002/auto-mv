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

module.exports = {
  getSongData,
};
