const screenshot = require('screenshot-desktop');
const sharp = require('sharp');

/**
 * Captures the primary screen and returns a compressed JPEG buffer.
 */
async function captureScreen() {
  // screenshot-desktop returns a PNG buffer
  const imgBuffer = await screenshot({ format: 'png' });

  // Compress: resize to max 1280px wide, 80% JPEG
  const compressed = await sharp(imgBuffer)
    .resize({ width: 1280, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  return compressed;
}

module.exports = { captureScreen };
