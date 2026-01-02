const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('uninstallerAPI', {
  uninstall: (full) => ipcRenderer.invoke('uninstall', { full })
});
