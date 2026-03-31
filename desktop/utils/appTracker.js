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
  'mspub',         // Publisher
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
  'msteams',
  'slack',
  'zoom',
  'skype',
  'webex',
  'postman',       // Dev tools
  'insomnia',
  'dbeaver',
  'ssms',          // SQL Server Management Studio
  'datagrip64',
  'figma',         // Design
  'xd',
  'sketch',
  'onedrive',      // Cloud / productivity
  'github desktop',
  'sourcetree',
  'fork',
  'gitkraken',
  'node', 'nodemon',
  // ── Chartered Accountant / Finance firm apps ──────────────────────────────
  'tally',         // Tally.ERP 9 / Tally Prime
  'tallyerp',
  'tallyprime',
  'busy',          // Busy Accounting Software
  'busywin',
  'marg',          // Marg ERP
  'margcomp',
  'wings',         // Wings ERP
  'spectrum',      // Spectrum Accounting
  'sapgui',        // SAP GUI
  'saplogon',
  'qbw',           // QuickBooks
  'qbw32',
  'computax',      // Computax CA software
  'taxbase',       // TaxBase
  'tdspro',        // TDS-PRO
  'expresstds',    // ExpressTDS
  'cleartds',
  'winman',        // WinMan CA
  'genius',        // Genius Tax/Accounting
  'caoffice',      // CA Office
  'acrobat',       // Adobe Acrobat
  'acrord32',      // Adobe Reader
  'foxitreader',   // Foxit PDF Reader
  'foxitpdfeditor',
  'pdfxedit',      // PDF-XChange
  'pdfxchangeeditor',
  'winzip',        // File archiving
  'winrar',
  '7zfm',
  'mstsc',         // Remote Desktop (WFH)
  'anydesk',
  'teamviewer',
  'visio',         // MS Visio
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
    this._samples          = new Map(); // processName → { appName, windowTitle, durationSeconds, productive }
    this._lastSampleTime   = Date.now();
    this._pollInterval     = null;
    this._sampleIntervalMs = 5_000;
  }

  start(sampleIntervalMs = 5_000) {
    this._sampleIntervalMs = sampleIntervalMs;
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
    // Cap elapsed to 2× sample interval to prevent sleep/wake inflation
    // (if PC was suspended, the timer fires immediately on wake with a huge gap)
    const rawElapsed = (now - this._lastSampleTime) / 1000;
    const elapsed = Math.min(rawElapsed, (this._sampleIntervalMs / 1000) * 2);
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
