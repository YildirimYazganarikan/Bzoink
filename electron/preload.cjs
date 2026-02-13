// Preload script for Electron
// This runs in a sandboxed context before the renderer process loads.
// Use contextBridge to safely expose APIs to the renderer if needed.

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    platform: process.platform,
});
