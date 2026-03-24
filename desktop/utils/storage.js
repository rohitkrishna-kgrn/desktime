const Store = require('electron-store');

const store = new Store({
  name: 'desktime',
  encryptionKey: 'desktime-secure-key-v1', // AES encryption for sensitive data
  schema: {
    token: { type: 'string', default: '' },
    user: { type: 'object', default: {} },
    apiUrl: { type: 'string', default: 'https://backend-desktime.averelabs.com/api' },
    offlineQueue: {
      type: 'object',
      properties: {
        screenshots: { type: 'array', default: [] },
        productivityLogs: { type: 'array', default: [] },
      },
      default: {},
    },
  },
});

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

// ── API URL ───────────────────────────────────────────────────────────────────
function getApiUrl() {
  return store.get('apiUrl', 'https://backend-desktime.averelabs.com/api');
}

function setApiUrl(url) {
  store.set('apiUrl', url);
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
  getApiUrl,
  setApiUrl,
  queueProductivityLog,
  flushProductivityQueue,
  getQueuedProductivityLogs,
};
