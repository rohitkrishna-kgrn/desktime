const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  shell,
} = require('electron');
const path = require('path');
const storage = require('./utils/storage');
const sync = require('./utils/sync');
const { AppTracker } = require('./utils/appTracker');
const { captureScreen } = require('./utils/screenshot');
const apiUtil = require('./utils/api');
const { getLogoPath } = require('./utils/logoPath');

// ── Constants ─────────────────────────────────────────────────────────────────
const HEARTBEAT_INTERVAL_MS    = 60 * 1000;      // 1 min
const SCREENSHOT_INTERVAL_MS   = 1 * 60 * 1000;  // 1 min (testing)
const APP_TRACK_SAMPLE_MS      = 5 * 1000;        // 5 sec samples
const PRODUCTIVITY_FLUSH_MS    = 1 * 60 * 1000;  // flush every 1 min
const ATTENDANCE_POLL_MS       = 10 * 1000;       // poll attendance every 10 sec (real-time feel)

// ── State ─────────────────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let appTracker = null;

let currentStatus = 'unknown';  // checked_in | checked_out | unknown
let isOnline = false;
let isTracking = false;

// ── Timers ────────────────────────────────────────────────────────────────────
const timers = {
  heartbeat:         null,
  screenshot:        null,
  productivityFlush: null,
  attendancePoll:    null,
};

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 360,
    height: 620,
    resizable: false,
    maximizable: false,
    frame: true,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: getAppIcon(),
    title: 'DeskTime',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Hide to tray on close instead of quitting
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function getAppIcon() {
  const logoPath = getLogoPath();
  if (logoPath) {
    try { return nativeImage.createFromPath(logoPath); } catch { /* fall through */ }
  }
  return undefined;
}

// ── Tray ──────────────────────────────────────────────────────────────────────
function createTray() {
  const logoPath = getLogoPath();
  let icon;
  if (logoPath) {
    try { icon = nativeImage.createFromPath(logoPath).resize({ width: 16, height: 16 }); } catch { /* fall through */ }
  }
  if (!icon || icon.isEmpty()) {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('DeskTime');
  updateTrayMenu();
  tray.on('click', () => mainWindow?.show());
}

function updateTrayMenu() {
  if (!tray) return;
  const user = storage.getUser();
  const statusLabel = currentStatus === 'checked_in' ? '🟢 Checked In' : '🔴 Checked Out';

  const menu = Menu.buildFromTemplate([
    { label: user?.name || 'DeskTime', enabled: false },
    { label: statusLabel, enabled: false },
    { type: 'separator' },
    { label: 'Open DeskTime', click: () => mainWindow?.show() },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        stopTracking();
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
}

// ── Productivity tracking (only when checked_in) ───────────────────────────────
function startProductivityTracking() {
  if (appTracker) return; // already running
  console.log('[Tracker] Productivity tracking started (checked in)');

  appTracker = new AppTracker();
  appTracker.start(APP_TRACK_SAMPLE_MS);

  // Screenshot every 1 min
  timers.screenshot = setInterval(async () => {
    if (currentStatus !== 'checked_in') return;
    try {
      const buf = await captureScreen();
      await sync.syncScreenshot(buf, new Date());
      console.log('[Tracker] Screenshot uploaded');
    } catch (err) {
      console.error('[Tracker] Screenshot error:', err.message);
    }
  }, SCREENSHOT_INTERVAL_MS);

  // Flush productivity logs every 1 min
  timers.productivityFlush = setInterval(async () => {
    if (!appTracker || currentStatus !== 'checked_in') return;
    const logs = appTracker.flush();
    if (logs.length) {
      await sync.syncProductivityLogs(logs);
      console.log(`[Tracker] Flushed ${logs.length} productivity entries`);
    }
  }, PRODUCTIVITY_FLUSH_MS);
}

function stopProductivityTracking() {
  if (!appTracker) return;
  console.log('[Tracker] Productivity tracking stopped (checked out)');

  // Flush remaining logs before stopping
  const logs = appTracker.flush();
  if (logs.length) sync.syncProductivityLogs(logs);

  appTracker.stop();
  appTracker = null;

  if (timers.screenshot)        { clearInterval(timers.screenshot);        timers.screenshot = null; }
  if (timers.productivityFlush) { clearInterval(timers.productivityFlush); timers.productivityFlush = null; }
}

// ── Main tracking lifecycle ────────────────────────────────────────────────────
function startTracking() {
  if (isTracking) return;
  isTracking = true;
  console.log('[Tracker] Starting...');

  // ── Heartbeat (always runs while logged in) ──────────────────────────────
  timers.heartbeat = setInterval(async () => {
    const ok = await sync.syncHeartbeat();
    isOnline = ok;
    broadcastStatus();
  }, HEARTBEAT_INTERVAL_MS);

  // Immediate heartbeat — fix: actually use the result so online shows right away
  sync.syncHeartbeat().then((ok) => {
    isOnline = ok;
    broadcastStatus();
  });

  // ── Attendance poll every 10 sec for real-time status ───────────────────
  timers.attendancePoll = setInterval(async () => {
    const data = await sync.fetchAttendanceStatus();
    if (!data) return;

    const prev = currentStatus;
    currentStatus = data.status;

    // Transition: just checked IN → start productivity + screenshots
    if (currentStatus === 'checked_in' && prev !== 'checked_in') {
      startProductivityTracking();
    }

    // Transition: just checked OUT → stop and flush
    if (currentStatus !== 'checked_in' && prev === 'checked_in') {
      stopProductivityTracking();
    }

    updateTrayMenu();
    broadcastStatus();
  }, ATTENDANCE_POLL_MS);

  // Immediate attendance fetch
  sync.fetchAttendanceStatus().then((data) => {
    if (!data) return;
    const prev = currentStatus;
    currentStatus = data.status;

    if (currentStatus === 'checked_in' && prev !== 'checked_in') {
      startProductivityTracking();
    }

    updateTrayMenu();
    broadcastStatus();
  });
}

function stopTracking() {
  if (!isTracking) return;
  isTracking = false;
  stopProductivityTracking();
  if (timers.heartbeat)      { clearInterval(timers.heartbeat);      timers.heartbeat = null; }
  if (timers.attendancePoll) { clearInterval(timers.attendancePoll); timers.attendancePoll = null; }
}

function broadcastStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('status:update', {
      status: currentStatus,
      online: isOnline,
      user: storage.getUser(),
    });
  }
  updateTrayMenu();
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────
ipcMain.handle('auth:login', async (_e, { email, password }) => {
  console.log('[IPC] auth:login called for:', email);
  try {
    const data = await apiUtil.login(email, password);
    storage.saveAuth(data.token, data.user);
    // Mark online immediately — login itself proves connectivity
    isOnline = true;
    startTracking();
    return { success: true, user: data.user };
  } catch (err) {
    const errorMsg = err.response?.data?.error
      || (err.response ? `Server error ${err.response.status}` : null)
      || err.message
      || 'Unknown error';
    console.error('[IPC] auth:login failed:', errorMsg, '| status:', err.response?.status, '| code:', err.code);
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('auth:register', async (_e, { email, password, name }) => {
  console.log('[IPC] auth:register called for:', email);
  try {
    const data = await apiUtil.register(email, password, name);
    storage.saveAuth(data.token, data.user);
    isOnline = true;
    startTracking();
    return { success: true, user: data.user };
  } catch (err) {
    const errorMsg = err.response?.data?.error
      || (err.response ? `Server error ${err.response.status}` : null)
      || err.message
      || 'Unknown error';
    console.error('[IPC] auth:register failed:', errorMsg, '| status:', err.response?.status, '| code:', err.code);
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('auth:logout', async () => {
  // Tell backend immediately — don't wait for heartbeat expiry
  await sync.syncDeactivate();
  stopTracking();
  storage.clearAuth();
  currentStatus = 'unknown';
  isOnline = false;
  broadcastStatus();
  return { success: true };
});

ipcMain.handle('auth:getUser', () => {
  return storage.getUser();
});

ipcMain.handle('status:get', () => {
  return { status: currentStatus, online: isOnline, user: storage.getUser() };
});

ipcMain.handle('status:connection', () => isOnline);

ipcMain.handle('settings:getApiUrl', () => storage.getApiUrl());
ipcMain.handle('settings:setApiUrl', (_e, url) => {
  storage.setApiUrl(url);
  return { success: true };
});

// ── App Lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();

  // Auto-start tracking if already authenticated
  if (storage.isAuthenticated()) {
    isOnline = false; // will be set true on first heartbeat
    startTracking();
  }
});

app.on('window-all-closed', (e) => {
  // Don't quit when all windows close; keep tray alive
  e.preventDefault();
});

app.on('activate', () => {
  if (mainWindow) mainWindow.show();
});

app.on('before-quit', async (e) => {
  if (app._deactivating) return; // prevent re-entry
  app.isQuitting    = true;
  app._deactivating = true;

  e.preventDefault(); // hold quit until deactivate finishes
  stopTracking();

  // Best-effort: tell backend client is gone before process exits
  try { await sync.syncDeactivate(); } catch { /* offline — ok */ }

  app.quit(); // now actually quit
});
