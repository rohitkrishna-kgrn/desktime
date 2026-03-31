const AppRule = require('../models/AppRule');

// Default productive app patterns
// Includes both friendly names and actual Windows process names (e.g. powerpnt, winword, devenv)
const DEFAULT_PRODUCTIVE = [
  // Microsoft Office — process names on Windows
  'excel', 'winword', 'word', 'powerpnt', 'powerpoint', 'outlook', 'onenote', 'msaccess', 'mspub',
  // IDEs / editors
  'visual studio', 'vscode', 'code', 'devenv',
  'intellij', 'pycharm', 'webstorm', 'rider', 'clion', 'goland',
  'sublime', 'atom', 'notepad++', 'notepadplusplus', 'vim', 'nvim', 'gvim',
  // Browsers
  'chrome', 'firefox', 'msedge', 'edge', 'brave', 'opera',
  // Terminals / shells
  'terminal', 'windowsterminal', 'cmd', 'powershell', 'pwsh', 'bash', 'mintty', 'hyper', 'git',
  // Communication & meetings
  'slack', 'teams', 'msteams', 'zoom', 'meet', 'skype', 'webex',
  // Design tools
  'figma', 'sketch', 'xd', 'photoshop', 'illustrator', 'indesign', 'adobexd',
  // Dev / DB tools
  'postman', 'insomnia', 'dbeaver', 'datagrip', 'ssms', 'sequel pro', 'tableplus',
  'android studio', 'xcode',
  // PDF tools (process names: AcroRd32, Acrobat, FoxitReader, PDFXEdit)
  'acrobat', 'acrord32', 'foxitreader', 'foxitpdfeditor', 'pdfxedit', 'pdfxchangeeditor',
  // ── Chartered Accountant / Finance firm apps ──────────────────────────────
  // Tally ERP / Tally Prime
  'tally', 'tallyerp', 'tallyprime',
  // Busy Accounting Software
  'busy', 'busywin',
  // Marg ERP
  'marg', 'margcomp',
  // Wings ERP / Accounting
  'wings',
  // Spectrum (accounting)
  'spectrum',
  // SAP GUI
  'sapgui', 'saplogon',
  // QuickBooks
  'qbw', 'qbw32', 'quickbooks',
  // Zoho Books / Zoho apps
  'zoho',
  // Computax (CA tax software)
  'computax',
  // TaxBase
  'taxbase',
  // TDS software (ExpressTDS, TDS-PRO, ClearTDS)
  'tdspro', 'expresstds', 'cleartds', 'winman',
  // Genius (tax / accounting)
  'genius',
  // CA Office
  'caoffice',
  // File archiving (CA work involves zipping/unzipping files)
  'winzip', 'winrar', '7zfm', 'peazip',
  // OneDrive / SharePoint (document management)
  'onedrive', 'sharepoint',
  // Remote desktop (WFH)
  'mstsc', 'anydesk', 'teamviewer',
  // MS Whiteboard / Visio
  'visio', 'whiteboard',
];

const DEFAULT_UNPRODUCTIVE = [
  'netflix', 'youtube', 'twitch', 'spotify', 'vlc', 'media player',
  'steam', 'epic games', 'minecraft', 'roblox',
  'facebook', 'instagram', 'tiktok', 'twitter',
  'solitaire', 'minesweeper', 'candy crush',
];

let rulesCache = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getRules() {
  if (rulesCache && Date.now() < cacheExpiry) return rulesCache;
  try {
    rulesCache = await AppRule.find({});
    cacheExpiry = Date.now() + CACHE_TTL;
    return rulesCache;
  } catch {
    return [];
  }
}

function matchRule(appName, rule) {
  const name = appName.toLowerCase();
  const pattern = rule.pattern.toLowerCase();
  if (rule.matchType === 'exact') return name === pattern;
  if (rule.matchType === 'regex') {
    try { return new RegExp(rule.pattern, 'i').test(appName); } catch { return false; }
  }
  // contains
  return name.includes(pattern);
}

async function categorizeApp(appName) {
  if (!appName) return 'idle';

  const rules = await getRules();
  for (const rule of rules) {
    if (matchRule(appName, rule)) return rule.category;
  }

  const lower = appName.toLowerCase();
  for (const p of DEFAULT_UNPRODUCTIVE) {
    if (lower.includes(p)) return 'unproductive';
  }
  for (const p of DEFAULT_PRODUCTIVE) {
    if (lower.includes(p)) return 'productive';
  }
  return 'neutral';
}

function invalidateCache() {
  rulesCache = null;
  cacheExpiry = 0;
}

module.exports = { categorizeApp, invalidateCache };
