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
const autoUpdater = require('./utils/autoUpdater');

// ── Constants ─────────────────────────────────────────────────────────────────
const HEARTBEAT_INTERVAL_MS    = 60 * 1000;      // 1 min
const SCREENSHOT_INTERVAL_MS   = 10 * 60 * 1000; // 10 min
const APP_TRACK_SAMPLE_MS      = 5 * 1000;        // 5 sec samples
const PRODUCTIVITY_FLUSH_MS    = 1 * 30 * 1000;   // flush every 30 sec
const ATTENDANCE_POLL_MS       = 10 * 1000;        // poll every 10 sec

// ── State ─────────────────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let appTracker = null;

let currentStatus = 'unknown';  // checked_in | checked_out | unknown
let isOnline = false;
let isTracking = false;
let isOnBreak = false;

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
    height: 660,
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
  const statusLabel = isOnBreak
    ? '🟡 On Break'
    : currentStatus === 'checked_in'
    ? '🟢 Checked In'
    : '🔴 Checked Out';

  const menu = Menu.buildFromTemplate([
    { label: user?.name || 'DeskTime', enabled: false },
    { label: statusLabel, enabled: false },
    { type: 'separator' },
    { label: 'Open DeskTime', click: () => mainWindow?.show() },
    { label: 'Check for Updates', click: () => autoUpdater.checkNow(mainWindow) },
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

// ── Productivity tracking (only when checked_in and not on break) ─────────────
function startProductivityTracking() {
  if (appTracker) return; // already running
  console.log('[Tracker] Productivity tracking started (checked in)');

  appTracker = new AppTracker();
  appTracker.start(APP_TRACK_SAMPLE_MS);

  // Screenshot every 1 min
  timers.screenshot = setInterval(async () => {
    if (currentStatus !== 'checked_in' || isOnBreak) return;
    try {
      const buf = await captureScreen();
      await sync.syncScreenshot(buf, new Date());
      console.log('[Tracker] Screenshot uploaded');
    } catch (err) {
      console.error('[Tracker] Screenshot error:', err.message);
    }
  }, SCREENSHOT_INTERVAL_MS);

  // Flush productivity logs every 30 sec
  timers.productivityFlush = setInterval(async () => {
    if (!appTracker || currentStatus !== 'checked_in' || isOnBreak) return;
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

  const logs = appTracker.flush();
  if (logs.length) sync.syncProductivityLogs(logs);

  appTracker.stop();
  appTracker = null;

  if (timers.screenshot)        { clearInterval(timers.screenshot);        timers.screenshot = null; }
  if (timers.productivityFlush) { clearInterval(timers.productivityFlush); timers.productivityFlush = null; }
}

function pauseProductivityTracking() {
  if (!appTracker) return;
  console.log('[Tracker] Pausing (on break)');
  // Flush remaining logs then pause sampling
  const logs = appTracker.flush();
  if (logs.length) sync.syncProductivityLogs(logs);
  appTracker.stop();
  // Leave timers alive but they will be skipped due to isOnBreak check
}

function resumeProductivityTracking() {
  if (!appTracker) return;
  console.log('[Tracker] Resuming (break ended)');
  appTracker.start(APP_TRACK_SAMPLE_MS);
}

// ── Main tracking lifecycle ────────────────────────────────────────────────────
function startTracking() {
  if (isTracking) return;
  isTracking = true;
  console.log('[Tracker] Starting...');

  timers.heartbeat = setInterval(async () => {
    const ok = await sync.syncHeartbeat();
    isOnline = ok;
    broadcastStatus();
  }, HEARTBEAT_INTERVAL_MS);

  sync.syncHeartbeat().then((ok) => {
    isOnline = ok;
    broadcastStatus();
  });

  timers.attendancePoll = setInterval(async () => {
    const data = await sync.fetchAttendanceStatus();
    if (!data) return;

    const prev = currentStatus;
    const prevOnBreak = isOnBreak;
    currentStatus = data.status;
    isOnBreak = data.onBreak || false;

    // Checked in transition
    if (currentStatus === 'checked_in' && prev !== 'checked_in') {
      startProductivityTracking();
    }

    // Checked out transition — end break if needed
    if (currentStatus !== 'checked_in' && prev === 'checked_in') {
      isOnBreak = false;
      stopProductivityTracking();
    }

    // Break started (detected via poll — e.g., started from web)
    if (isOnBreak && !prevOnBreak && currentStatus === 'checked_in') {
      pauseProductivityTracking();
    }

    // Break ended (detected via poll — e.g., resumed from web)
    if (!isOnBreak && prevOnBreak && currentStatus === 'checked_in') {
      resumeProductivityTracking();
    }

    updateTrayMenu();
    broadcastStatus();
  }, ATTENDANCE_POLL_MS);

  sync.fetchAttendanceStatus().then((data) => {
    if (!data) return;
    const prev = currentStatus;
    currentStatus = data.status;
    isOnBreak = data.onBreak || false;

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
  isOnBreak = false;
  stopProductivityTracking();
  if (timers.heartbeat)      { clearInterval(timers.heartbeat);      timers.heartbeat = null; }
  if (timers.attendancePoll) { clearInterval(timers.attendancePoll); timers.attendancePoll = null; }
}

function broadcastStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('status:update', {
      status: currentStatus,
      onBreak: isOnBreak,
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
    isOnline = true;
    startTracking();
    return { success: true, user: data.user };
  } catch (err) {
    const errorMsg = err.response?.data?.error
      || (err.response ? `Server error ${err.response.status}` : null)
      || err.message
      || 'Unknown error';
    console.error('[IPC] auth:login failed:', errorMsg);
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('auth:getDepartments', async () => {
  try {
    const data = await apiUtil.getDepartments();
    return { success: true, departments: data };
  } catch (err) {
    return { success: false, departments: [] };
  }
});

ipcMain.handle('auth:register', async (_e, { email, password, name, departmentId }) => {
  console.log('[IPC] auth:register called for:', email);
  try {
    const data = await apiUtil.register(email, password, name, departmentId);
    storage.saveAuth(data.token, data.user);
    isOnline = true;
    startTracking();
    return { success: true, user: data.user };
  } catch (err) {
    const errorMsg = err.response?.data?.error
      || (err.response ? `Server error ${err.response.status}` : null)
      || err.message
      || 'Unknown error';
    console.error('[IPC] auth:register failed:', errorMsg);
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('auth:logout', async () => {
  await sync.syncDeactivate();
  stopTracking();
  storage.clearAuth();
  currentStatus = 'unknown';
  isOnline = false;
  isOnBreak = false;
  broadcastStatus();
  return { success: true };
});

ipcMain.handle('auth:getUser', () => storage.getUser());

ipcMain.handle('status:get', () => ({
  status: currentStatus,
  onBreak: isOnBreak,
  online: isOnline,
  user: storage.getUser(),
}));

ipcMain.handle('status:connection', () => isOnline);

ipcMain.handle('break:start', async (_e, { reason, category }) => {
  try {
    if (currentStatus !== 'checked_in') {
      return { success: false, error: 'Must be checked in to take a break' };
    }
    await sync.syncBreakStart(reason, category);
    isOnBreak = true;
    pauseProductivityTracking();
    updateTrayMenu();
    broadcastStatus();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.response?.data?.error || err.message || 'Failed to start break' };
  }
});

ipcMain.handle('break:end', async () => {
  try {
    await sync.syncBreakEnd();
    isOnBreak = false;
    resumeProductivityTracking();
    updateTrayMenu();
    broadcastStatus();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.response?.data?.error || err.message || 'Failed to end break' };
  }
});

ipcMain.handle('settings:getApiUrl', () => 'https://backend-desktime.averelabs.com/api');
ipcMain.handle('settings:setApiUrl', () => ({ success: true }));

// ── App Lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();

  if (storage.isAuthenticated()) {
    isOnline = false;
    startTracking();
  }

  // Start auto-updater after window is ready
  autoUpdater.start(mainWindow);
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('activate', () => {
  if (mainWindow) mainWindow.show();
});

app.on('before-quit', async (e) => {
  if (app._deactivating) return;
  app.isQuitting    = true;
  app._deactivating = true;

  e.preventDefault();
  stopTracking();
  autoUpdater.stop();

  try { await sync.syncDeactivate(); } catch { /* offline — ok */ }

  app.quit();
});
