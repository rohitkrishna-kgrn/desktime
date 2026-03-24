const AppRule = require('../models/AppRule');

// Default productive app patterns
const DEFAULT_PRODUCTIVE = [
  'excel', 'word', 'powerpoint', 'outlook', 'visual studio', 'vscode', 'code',
  'intellij', 'pycharm', 'webstorm', 'sublime', 'atom', 'notepad++', 'vim', 'nvim',
  'chrome', 'firefox', 'edge', 'brave', // browsers — mark neutral by default; can override
  'terminal', 'cmd', 'powershell', 'bash', 'git',
  'slack', 'teams', 'zoom', 'meet',
  'figma', 'sketch', 'xd', 'photoshop', 'illustrator',
  'postman', 'insomnia', 'dbeaver', 'datagrip', 'sequel pro',
  'android studio', 'xcode',
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
