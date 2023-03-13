// server/index.js

const express = require("express");

const PORT = process.env.PORT || 3001;

const app = express();

app.get("/health", (req, res) => {
  res.send(true);
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
