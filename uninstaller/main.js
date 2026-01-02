const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 320,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'E-Defter Otomasyon Kaldırıcı',
    icon: path.join(__dirname, '../assets/icon.png'),
  });
  mainWindow.removeMenu();
  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

ipcMain.handle('uninstall', async (event, { full }) => {
  try {
    // Ana programın kurulu olduğu klasörü bul
    const programDir = path.join(process.env.LOCALAPPDATA, 'Programs', 'E-Defter Otomasyon');
    const userDataDir = path.join(process.env.APPDATA, 'E-Defter Otomasyon');
    const logDir = path.join(userDataDir, 'logs');

    let deleted = [];
    let errors = [];

    if (full) {
      // Tam kaldırma: program, kullanıcı verisi ve loglar
      for (const dir of [programDir, userDataDir, logDir]) {
        if (await fs.pathExists(dir)) {
          try {
            await fs.remove(dir);
            deleted.push(dir);
          } catch (e) {
            errors.push({ dir, error: e.message });
          }
        }
      }
    } else {
      // Kısmi kaldırma: sadece program dosyaları
      if (await fs.pathExists(programDir)) {
        try {
          await fs.remove(programDir);
          deleted.push(programDir);
        } catch (e) {
          errors.push({ dir: programDir, error: e.message });
        }
      }
    }
    return { success: errors.length === 0, deleted, errors };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

app.on('window-all-closed', () => {
  app.quit();
});
