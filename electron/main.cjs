const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Fix GPU crashes on some Windows systems
// Disable GPU hardware acceleration entirely to prevent EGL init failures
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-compositing');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#000000',
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    autoHideMenuBar: true,
    frame: true,
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Hide the menu bar
  mainWindow.setMenuBarVisibility(false);

  // Load the app
  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // F11 for fullscreen toggle
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// IPC: Save recorded video with file dialog
ipcMain.handle('save-video', async (event, buffer, defaultFilename) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Bzoink1 Session Video',
      defaultPath: path.join(require('os').homedir(), 'Desktop', defaultFilename),
      filters: [
        { name: 'MP4 Video', extensions: ['mp4'] },
        { name: 'WebM Video', extensions: ['webm'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    const uint8Array = new Uint8Array(buffer);
    fs.writeFileSync(result.filePath, uint8Array);
    return { success: true, path: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: Open URL in system browser (for Stripe payment)
ipcMain.handle('open-external', async (event, url) => {
  const { shell } = require('electron');
  await shell.openExternal(url);
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
