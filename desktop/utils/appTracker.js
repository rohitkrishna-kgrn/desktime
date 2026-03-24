const { getActiveWindow } = require('./windowsActiveWin');

// Apps considered productive (case-insensitive substring match on process name)
const PRODUCTIVE_NAMES = new Set([
  'code',          // VS Code
  'code - insiders',
  'devenv',        // Visual Studio
  'webstorm64',    // WebStorm
  'idea64',        // IntelliJ IDEA
  'pycharm64',
  'rider64',
  'sublime_text',
  'notepad++',
  'notepad',
  'vim', 'nvim', 'gvim',
  'excel',         // Microsoft Office
  'winword',       // Word
  'powerpnt',      // PowerPoint
  'outlook',
  'onenote',
  'msaccess',
  'chrome',        // Browsers
  'msedge',
  'firefox',
  'brave',
  'opera',
  'iexplore',
  'windowsterminal',  // Terminals
  'cmd',
  'powershell',
  'pwsh',
  'wt',
  'bash',
  'mintty',
  'hyper',
  'teams',         // Communication
  'slack',
  'zoom',
  'msteams',
  'skype',
  'postman',       // Dev tools
  'insomnia',
  'dbeaver',
  'ssms',          // SQL Server Management Studio
  'datagrip64',
  'figma',         // Design
  'xd',
  'sketch',
  'onedrive',      // Cloud / productivity
  'onenote',
  'github desktop',
  'sourcetree',
  'fork',
  'gitkraken',
  'node', 'nodemon',
]);

function isProductive(processName) {
  if (!processName) return false;
  const lower = processName.toLowerCase();
  if (lower === 'idle' || lower === '(idle)') return false;
  // exact match or prefix/substring match
  for (const name of PRODUCTIVE_NAMES) {
    if (lower.includes(name)) return true;
  }
  return false;
}

class AppTracker {
  constructor() {
    this._samples        = new Map(); // processName → { appName, windowTitle, durationSeconds, productive }
    this._lastSampleTime = Date.now();
    this._pollInterval   = null;
  }

  start(sampleIntervalMs = 5_000) {
    this._lastSampleTime = Date.now();
    this._sample(); // immediate first sample
    this._pollInterval = setInterval(() => this._sample(), sampleIntervalMs);
  }

  stop() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }

  async _sample() {
    const now     = Date.now();
    const elapsed = (now - this._lastSampleTime) / 1000; // seconds
    this._lastSampleTime = now;

    try {
      const win = await getActiveWindow();

      if (!win || !win.processName || win.processName === 'idle') {
        this._addSample('(idle)', '', elapsed, false);
        return;
      }

      const appName = win.processName;
      const title   = win.title || '';
      this._addSample(appName, title, elapsed, isProductive(appName));
    } catch (err) {
      console.warn('[AppTracker] Sample error:', err.message);
      this._addSample('(idle)', '', elapsed, false);
    }
  }

  _addSample(appName, windowTitle, seconds, productive) {
    const existing = this._samples.get(appName);
    if (existing) {
      existing.durationSeconds += seconds;
      existing.windowTitle = windowTitle;
    } else {
      this._samples.set(appName, { appName, windowTitle, durationSeconds: seconds, productive });
    }
  }

  /**
   * Flush accumulated samples and reset.
   * Returns [{ appName, windowTitle, durationSeconds, productive, timestamp }]
   */
  flush() {
    const timestamp = new Date().toISOString();
    const logs = [];
    for (const entry of this._samples.values()) {
      if (entry.durationSeconds > 0) {
        logs.push({ ...entry, timestamp });
      }
    }
    this._samples.clear();
    this._lastSampleTime = Date.now();
    return logs;
  }
}

module.exports = { AppTracker };
