const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    sendSurvey: (data) => ipcRenderer.invoke('submit-survey', data),
    openUrl: (url) => ipcRenderer.invoke('open-url', url)
});
