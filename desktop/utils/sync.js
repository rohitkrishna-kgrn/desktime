const api = require('./api');
const storage = require('./storage');

let online = true;

/**
 * Upload a screenshot. If offline, skip (screenshots cannot be stored locally due to size).
 * Returns true on success.
 */
async function syncScreenshot(buffer, timestamp) {
  try {
    await api.uploadScreenshot(buffer, timestamp);
    online = true;
    return true;
  } catch (err) {
    online = false;
    const status = err.response?.status;
    // 403 = not checked in — don't retry
    if (status === 403) {
      console.log('[Sync] Screenshot rejected: user not checked in');
      return false;
    }
    console.warn('[Sync] Screenshot upload failed (offline?):', err.message);
    return false;
  }
}

/**
 * Flush and sync productivity logs.
 * Falls back to offline queue on failure.
 */
async function syncProductivityLogs(freshLogs) {
  // Merge with any queued offline logs
  const queued = storage.flushProductivityQueue();
  const all = [...queued, ...freshLogs];
  if (!all.length) return;

  // Send in batches of 200; track which batches fail so we don't re-queue already-sent data
  const failed = [];
  for (let i = 0; i < all.length; i += 200) {
    const batch = all.slice(i, i + 200);
    try {
      await api.sendProductivityLogs(batch);
      online = true;
    } catch {
      online = false;
      failed.push(...batch);
    }
  }
  if (failed.length) {
    for (const log of failed) storage.queueProductivityLog(log);
    console.warn(`[Sync] ${failed.length} productivity logs queued for retry`);
  }
}

/**
 * Send heartbeat. Silently fails.
 */
async function syncHeartbeat() {
  try {
    await api.sendHeartbeat();
    online = true;
    return true;
  } catch {
    online = false;
    return false;
  }
}

/**
 * Immediately tell the backend this client is no longer active.
 * Called on logout and app quit. Best-effort — never throws.
 */
async function syncDeactivate() {
  try {
    await api.deactivateClient();
    console.log('[Sync] Client deactivated on backend');
  } catch (err) {
    console.warn('[Sync] Deactivate failed (may be offline):', err.message);
  }
}

/**
 * Fetch attendance status from backend.
 */
async function fetchAttendanceStatus() {
  try {
    return await api.getAttendanceStatus();
  } catch {
    return null;
  }
}

async function syncBreakStart(reason, category) {
  try {
    const result = await api.startBreak(reason, category);
    online = true;
    return result;
  } catch (err) {
    online = false;
    throw err;
  }
}

async function syncBreakEnd() {
  try {
    const result = await api.endBreak();
    online = true;
    return result;
  } catch (err) {
    online = false;
    throw err;
  }
}

function isOnline() {
  return online;
}

module.exports = {
  syncScreenshot,
  syncProductivityLogs,
  syncHeartbeat,
  syncDeactivate,
  fetchAttendanceStatus,
  syncBreakStart,
  syncBreakEnd,
  isOnline,
};
