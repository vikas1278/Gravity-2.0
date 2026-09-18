const path = require('path');
try {
  const ffmpegStatic = require('ffmpeg-static');
  process.env.PATH = path.dirname(ffmpegStatic) + path.delimiter + process.env.PATH;
} catch (e) {
  console.error("Failed to load ffmpeg-static");
}
require("./bot.js");
