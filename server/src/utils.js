const fs = require('fs');
const path = require('path');

// Allowed file extensions
const ALLOWED_VIDEO_EXTS = ['.mkv', '.mov', '.mp4', '.wmv', '.avi'];
const ALLOWED_AUDIO_EXTS = ['.mp3', '.flac', '.ogg', '.wav'];

// Shared progress bar options
const PROGRESS_BAR_OPTIONS = {
  format: '{title} [{bar}] {percentage}% | {value}/{total}',
  barCompleteChar: '#',
  barIncompleteChar: '-',
  hideCursor: true
};

/**
 * Creates a unique working directory inside a base "temp" folder.
 */
const createWorkingDirectory = () => {
  const baseTempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(baseTempDir)) {
    fs.mkdirSync(baseTempDir);
  }
  const uniqueId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  const workingDir = path.join(baseTempDir, uniqueId);
  fs.mkdirSync(workingDir);
  return workingDir;
};

module.exports = {
  createWorkingDirectory,
  PROGRESS_BAR_OPTIONS,
  ALLOWED_VIDEO_EXTS,
  ALLOWED_AUDIO_EXTS
};
