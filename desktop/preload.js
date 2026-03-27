const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktime', {
  // Auth
  login: (email, password) => ipcRenderer.invoke('auth:login', { email, password }),
  register: (email, password, name) => ipcRenderer.invoke('auth:register', { email, password, name }),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getUser: () => ipcRenderer.invoke('auth:getUser'),

  // Status
  getStatus: () => ipcRenderer.invoke('status:get'),
  getConnectionStatus: () => ipcRenderer.invoke('status:connection'),

  // Break
  startBreak: (reason, category) => ipcRenderer.invoke('break:start', { reason, category }),
  endBreak: () => ipcRenderer.invoke('break:end'),

  // Settings
  getApiUrl: () => ipcRenderer.invoke('settings:getApiUrl'),
  setApiUrl: (url) => ipcRenderer.invoke('settings:setApiUrl', url),

  // Events from main → renderer
  onStatusUpdate: (cb) => {
    ipcRenderer.on('status:update', (_event, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('status:update');
  },
});
