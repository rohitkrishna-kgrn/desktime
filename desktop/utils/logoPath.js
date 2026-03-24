const path = require('path');
const { app } = require('electron');

/**
 * Returns the path to the bundled logo, working both in dev and after packaging.
 */
function getLogoPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'assets', 'logo.png');
  }
  return path.join(__dirname, '..', 'assets', 'logo.png');
}

module.exports = { getLogoPath };
