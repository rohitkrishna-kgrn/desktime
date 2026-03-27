const fs = require('fs');
const Store = require('electron-store');

const STORE_CONFIG = {
  name: 'desktime',
  encryptionKey: 'desktime-secure-key-v1',
  schema: {
    token: { type: 'string', default: '' },
    user: { type: 'object', default: {} },
    offlineQueue: {
      type: 'object',
      properties: {
        screenshots: { type: 'array', default: [] },
        productivityLogs: { type: 'array', default: [] },
      },
      default: {},
    },
  },
};

let store;
try {
  store = new Store(STORE_CONFIG);
  // Verify store is readable — catches decryption failures from stale keys
  store.get('token');
} catch (err) {
  console.warn('[Storage] Store corrupted or unreadable, resetting:', err.message);
  try {
    // Get path of the broken file and delete it
    const tmp = new Store({ name: STORE_CONFIG.name });
    if (fs.existsSync(tmp.path)) fs.unlinkSync(tmp.path);
  } catch { /* best-effort */ }
  store = new Store(STORE_CONFIG);
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function saveAuth(token, user) {
  store.set('token', token);
  store.set('user', user);
}

function clearAuth() {
  store.delete('token');
  store.delete('user');
}

function getToken() {
  return store.get('token', '');
}

function getUser() {
  return store.get('user', null);
}

function isAuthenticated() {
  return !!getToken();
}

// ── Offline Queue ─────────────────────────────────────────────────────────────
function queueProductivityLog(log) {
  const current = store.get('offlineQueue.productivityLogs', []);
  // Keep last 5000 entries max
  const updated = [...current, log].slice(-5000);
  store.set('offlineQueue.productivityLogs', updated);
}

function flushProductivityQueue() {
  const logs = store.get('offlineQueue.productivityLogs', []);
  store.set('offlineQueue.productivityLogs', []);
  return logs;
}

function getQueuedProductivityLogs() {
  return store.get('offlineQueue.productivityLogs', []);
}

module.exports = {
  saveAuth,
  clearAuth,
  getToken,
  getUser,
  isAuthenticated,
  queueProductivityLog,
  flushProductivityQueue,
  getQueuedProductivityLogs,
};
