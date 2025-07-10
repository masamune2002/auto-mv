const express = require('express');
const bodyParser = require('body-parser');
const { processVideoCli } = require('./index');

const app = express();
app.use(bodyParser.json());

app.post('/process', async (req, res) => {
  const {
    input,
    output,
    beats
  } = req.body;
  if (!input) return res.status(400).json({ error: 'input path required' });
  try {
    await processVideoCli(input, { output, beats, /* … */ });
    res.json({ status: 'ok' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`auto-mv API listening on port ${PORT}`);
});

