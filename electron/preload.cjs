// Preload script for Electron
const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    platform: process.platform,
    saveVideo: (buffer, filename) => ipcRenderer.invoke('save-video', buffer, filename),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
});
