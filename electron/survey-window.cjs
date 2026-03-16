const { BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

class SurveyWindow {
    constructor() {
        this.window = null;
    }

    create() {
        if (this.window) return;

        this.window = new BrowserWindow({
            width: 600,
            height: 750,
            frame: false, // Daha modern bir görünüm için framesiz
            transparent: true,
            resizable: false,
            alwaysOnTop: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload-survey.cjs')
            }
        });

        this.window.loadFile(path.join(__dirname, 'survey.html'));

        this.window.on('closed', () => {
            this.window = null;
        });

        // Web sitesini açma isteği gelirse
        ipcMain.handle('open-url', (event, url) => {
            shell.openExternal(url);
        });
    }

    close() {
        if (this.window) {
            this.window.close();
        }
    }
}

module.exports = new SurveyWindow();
