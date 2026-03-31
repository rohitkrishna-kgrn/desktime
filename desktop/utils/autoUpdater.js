/**
 * autoUpdater.js
 *
 * Checks a version.json file hosted on GitHub for new releases.
 * If a newer version is found, downloads the installer and prompts
 * the user to install it.
 *
 * Workflow for releasing a new version:
 *   1. Bump version in desktop/package.json (e.g. "1.0.1")
 *   2. Run: npm run build:win
 *   3. Push the new installer + updated version.json to the repo
 *   4. Running clients will detect the change within 4 hours (or on next startup)
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const { app, dialog, shell } = require('electron');

// ── Config ──────────────────────────────────────────────────────────────────────
const VERSION_JSON_URL   = 'https://raw.githubusercontent.com/rohitkrishna-kgrn/desktime/main/desktop/app/version.json';
const CHECK_INTERVAL_MS  = 4 * 60 * 60 * 1000; // check every 4 hours
const STARTUP_DELAY_MS   = 15 * 1000;            // wait 15s after launch before first check

let checkTimer   = null;
let isDownloading = false;

// ── Semver comparison ────────────────────────────────────────────────────────────
// Returns 1 if a > b, -1 if a < b, 0 if equal
function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

// ── HTTP GET with redirect following ────────────────────────────────────────────
function httpsGet(url, timeout = 15_000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout }, (res) => {
      // Follow redirects (GitHub sends 302 for raw content)
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        httpsGet(res.headers.location, timeout).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve(body));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

// ── Stream download with redirect following ──────────────────────────────────────
function downloadStream(url, destPath, onProgress, timeout = 180_000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout }, (res) => {
      // Follow redirects
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        downloadStream(res.headers.location, destPath, onProgress, timeout)
          .then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        return;
      }

      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      const file = fs.createWriteStream(destPath);

      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (onProgress && total > 0) {
          onProgress(Math.round((downloaded / total) * 100));
        }
      });

      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
      res.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Download timed out')); });
  });
}

// ── Main check logic ─────────────────────────────────────────────────────────────
async function checkForUpdates(mainWindow) {
  if (isDownloading) return;

  try {
    console.log('[Updater] Checking for updates…');
    const body    = await httpsGet(VERSION_JSON_URL);
    const info    = JSON.parse(body);
    const current = app.getVersion();

    if (!info?.version || !info?.url) {
      console.warn('[Updater] version.json missing required fields');
      return;
    }

    if (compareVersions(info.version, current) <= 0) {
      console.log(`[Updater] Up to date (${current})`);
      return;
    }

    console.log(`[Updater] New version: ${info.version} (running ${current})`);

    // Prompt user
    const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
    const { response } = await dialog.showMessageBox(win, {
      type:      'info',
      title:     'DeskTime Update Available',
      message:   `DeskTime v${info.version} is available`,
      detail:    info.releaseNotes
        ? `What's new:\n${info.releaseNotes}\n\nClick "Update Now" to download and install. The app will restart automatically.`
        : `A new version is available. Click "Update Now" to download and install.\nThe app will restart automatically.`,
      buttons:   ['Update Now', 'Later'],
      defaultId: 0,
      cancelId:  1,
    });

    if (response !== 0) {
      console.log('[Updater] User chose to update later');
      return;
    }

    // Download
    isDownloading = true;
    const filename = `DeskTime-Setup-${info.version}.exe`;
    const destPath = path.join(os.tmpdir(), filename);

    // Notify renderer that download is starting
    if (win) win.webContents.send('update:downloading', { version: info.version });

    console.log(`[Updater] Downloading ${info.url} → ${destPath}`);

    await downloadStream(info.url, destPath, (percent) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('update:progress', { percent });
      }
      if (percent % 20 === 0) console.log(`[Updater] Download progress: ${percent}%`);
    });

    console.log('[Updater] Download complete — launching installer');

    // Notify renderer download is done
    if (win && !win.isDestroyed()) {
      win.webContents.send('update:ready', { version: info.version });
    }

    // Short pause so renderer can show "ready" state, then launch installer and quit
    setTimeout(async () => {
      await dialog.showMessageBox(win, {
        type:    'info',
        title:   'Ready to Install',
        message: `DeskTime v${info.version} downloaded`,
        detail:  'The installer will open now. DeskTime will close automatically.',
        buttons: ['Install'],
      });
      await shell.openPath(destPath);
      app.isQuitting = true;
      app.quit();
    }, 500);

  } catch (err) {
    isDownloading = false;
    console.warn('[Updater] Check failed:', err.message);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────────

/**
 * Start the auto-updater. Call once after the main window is ready.
 * @param {BrowserWindow} mainWindow
 */
function start(mainWindow) {
  // First check after a short delay so startup isn't delayed
  setTimeout(() => checkForUpdates(mainWindow), STARTUP_DELAY_MS);

  // Periodic checks
  checkTimer = setInterval(() => checkForUpdates(mainWindow), CHECK_INTERVAL_MS);
}

/**
 * Stop the periodic check timer (call on app quit).
 */
function stop() {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
}

/**
 * Trigger an immediate manual check (e.g. from a menu item).
 * @param {BrowserWindow} mainWindow
 */
function checkNow(mainWindow) {
  checkForUpdates(mainWindow);
}

module.exports = { start, stop, checkNow };
