// Preload script for Electron
// This runs in a sandboxed context before the renderer process loads.
// Use contextBridge to safely expose APIs to the renderer if needed.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    platform: process.platform,
    saveVideo: (buffer, filename) => ipcRenderer.invoke('save-video', buffer, filename),
});
