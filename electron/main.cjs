// NODE_ENV ayarı (eğer ayarlanmamışsa production olarak varsay)
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

const { app, BrowserWindow, ipcMain, dialog, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const chokidar = require('chokidar');
const ExcelJS = require('exceljs');
// Nodemailer 7.x import - CommonJS compatibility
let nodemailer;
try {
  nodemailer = require('nodemailer');
  // Eğer default export varsa kullan
  if (nodemailer.default) {
    nodemailer = nodemailer.default;
  }
} catch (err) {
  console.warn('Nodemailer import hatası:', err.message);
}
const archiver = require('archiver');
const Store = require('electron-store');

// Handle Squirrel Windows installer events
if (require('electron-squirrel-startup')) app.quit();

const store = new Store();
let mainWindow;
let tray = null;
let folderWatcher = null;
let backgroundInterval = null;

// trigger-scan event debounce (çoklu refresh önleme)
let triggerScanTimeout = null;
let isScanning = false;  // ✅ Aktif tarama flag'i - UI kilitlenmesini engelle
const TRIGGER_SCAN_DEBOUNCE_MS = 5000; // ✅ 5 saniye (çok sık tarama engelle)

// Optimized Log System - Performans ve güvenlik iyileştirmeleri
let logQueue = [];
let logFlushTimeout = null;
const MAX_LOG_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit
const MAX_LOG_AGE_DAYS = 30; // 30 günden eski logları sil

// Eski log dosyalarını temizle
function cleanupOldLogs() {
  try {
    const logDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logDir)) return;
    
    const files = fs.readdirSync(logDir);
    const now = Date.now();
    const thirtyDaysMs = MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000;
    
    files.forEach(file => {
      const filePath = path.join(logDir, file);
      try {
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > thirtyDaysMs) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Eski log silindi: ${file}`);
        }
      } catch (err) {
        console.warn(`⚠️ Log temizleme hatası: ${file}`, err.message);
      }
    });
  } catch (error) {
    console.error('❌ Log temizleme hatası:', error);
  }
}

function logToFile(level, category, message, details = '') {
  try {
    // Input validation ve sanitization
    if (!level || !category || !message) return;
    
    const sanitizedLevel = String(level).toUpperCase().substring(0, 10);
    const sanitizedCategory = String(category).substring(0, 50);
    const sanitizedMessage = String(message).substring(0, 500);
    const sanitizedDetails = details ? String(details).substring(0, 1000) : '';
    
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleString('tr-TR');
    
    const logEntry = `${timeStr} - [${sanitizedLevel}] ${sanitizedCategory}: ${sanitizedMessage}${sanitizedDetails ? ' - ' + sanitizedDetails : ''}\n`;
    
    // Batch logging için queue'ya ekle
    logQueue.push({ dateStr, logEntry });
    
    // Debounced flush (500ms delay)
    if (logFlushTimeout) clearTimeout(logFlushTimeout);
    logFlushTimeout = setTimeout(flushLogs, 500);
    
    // Console output (dev mode)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[${sanitizedLevel}] ${sanitizedCategory}: ${sanitizedMessage}`, sanitizedDetails);
    }
  } catch (error) {
    console.error('Log yazma hatası:', error);
  }
}

// Batch log flush function - Performance optimization
function flushLogs() {
  if (logQueue.length === 0) return;
  
  try {
    const logDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Group by date
    const logsByDate = logQueue.reduce((groups, log) => {
      if (!groups[log.dateStr]) groups[log.dateStr] = [];
      groups[log.dateStr].push(log.logEntry);
      return groups;
    }, {});
    
    // Write to files
    Object.entries(logsByDate).forEach(([dateStr, entries]) => {
      const logFile = path.join(logDir, `edefter-log-${dateStr}.txt`);
      
      // Check file size before writing
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        if (stats.size > MAX_LOG_FILE_SIZE) {
          // Archive old log and create new one
          const archiveFile = path.join(logDir, `edefter-log-${dateStr}-${Date.now()}.txt`);
          fs.renameSync(logFile, archiveFile);
        }
      }
      
      fs.appendFileSync(logFile, entries.join(''));
    });
    
    logQueue = []; // Clear queue
  } catch (error) {
    console.error('Log flush hatası:', error);
  }
}

async function createWindow(){
  // Startup'ta eski logları temizle
  cleanupOldLogs();
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    show: false
  });

  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    // Development modunda DevTools'u aç
    mainWindow.webContents.openDevTools();
    // Development modunda Vite dev server'ı bekle
    const serverUrl = 'http://localhost:5173';
    try {
      await mainWindow.loadURL(serverUrl);
    } catch (error) {
      console.log('Dev server bekleniyor...');
      setTimeout(() => {
        mainWindow.loadURL(serverUrl);
      }, 3000);
    }
    mainWindow.webContents.openDevTools();
  } else {
    // Production modunda dist klasöründen yükle
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      console.error('dist/index.html bulunamadı. Önce npm run build çalıştırın.');
      logToFile('error', 'Sistem', 'dist/index.html bulunamadı', indexPath);
    }
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    logToFile('info', 'Sistem', 'E-Defter Otomasyon Sistemi başlatıldı');
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
    
    if (!fs.existsSync(iconPath)) {
      logToFile('warning', 'Sistem', 'Sistem tepsisi ikonu bulunamadı', iconPath);
      return;
    }

    // Tray icon'u güvenli şekilde oluştur
    tray = new Tray(iconPath);
    tray.setToolTip('E-Defter Otomasyon Sistemi');
    logToFile('success', 'Sistem', 'Sistem tepsisi başarıyla oluşturuldu');
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'E-Defter Otomasyon',
        click: () => {
          mainWindow.show();
        }
      },
      {
        label: 'Çıkış',
        click: () => {
          app.isQuiting = true;
          app.quit();
        }
      }
    ]);
    
    tray.setToolTip('E-Defter Otomasyon Sistemi');
    tray.setContextMenu(contextMenu);
    
    tray.on('double-click', () => {
      mainWindow.show();
    });
    
    logToFile('success', 'Sistem', 'Sistem tepsisi oluşturuldu');
  } catch (error) {
    logToFile('error', 'Sistem', 'Sistem tepsisi oluşturulamadı', error.message);
  }
}

// ========== GIB FİLE PROCESSING ==========
// GIB dosyası işleme - Tarama sonrası tetikleme
async function processGIBFile(gibFilePath, metadata = {}) {
  try {
    logToFile('info', 'GIB İşleme', `GIB dosyası işleniyor: ${gibFilePath}`);
    
    if (!fs.existsSync(gibFilePath)) {
      logToFile('error', 'GIB İşleme', `Dosya bulunamadı: ${gibFilePath}`);
      return { success: false, error: 'Dosya bulunamadı' };
    }

    // Dosya bilgilerini al
    const fileName = path.basename(gibFilePath);
    const fileDir = path.dirname(gibFilePath);
    
    logToFile('info', 'GIB İşleme', `Dosya işleme başladı - ${fileName}`, fileDir);

    // Trigger-scan UI tarafindan tetiklenecek
    // trigger-scan handler'ı email/backup otomasyonlarını başlatacak
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('trigger-scan', {
        sourcePath: fileDir,
        gibFile: fileName,
        processed: true
      });
      logToFile('success', 'GIB İşleme', `trigger-scan gönderildi: ${fileName}`);
    }

    return { success: true, message: 'GIB dosyası başarıyla işlendi' };
  } catch (error) {
    logToFile('error', 'GIB İşleme', 'GIB dosyası işleme hatası', error.message);
    return { success: false, error: error.message };
  }
}

// IPC Handlers
ipcMain.handle('select-folder', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const folderPath = result.filePaths[0];
      logToFile('success', 'Klasör', `Klasör seçildi: ${folderPath}`);
      return folderPath;
    }
    return null;
  } catch (error) {
    logToFile('error', 'Klasör', 'Klasör seçimi hatası', error.message);
    return null;
  }
});

ipcMain.handle('check-path-exists', async (event, path) => {
  try {
    const exists = fs.existsSync(path);
    return exists;
  } catch (error) {
    logToFile('error', 'Path Kontrolü', `${path} kontrol hatası`, error.message);
    return false;
  }
});

ipcMain.handle('select-excel-file', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Excel Files', extensions: ['xlsx', 'xls'] }
      ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      
      // ExcelJS kullanarak Excel dosyasını oku
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      
      const worksheet = workbook.worksheets[0];
      const data = [];
      
      // İlk satır başlıkları al
      const headers = [];
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell, colNumber) => {
        headers[colNumber] = cell.text || cell.value || '';
      });
      
      // Veri satırlarını işle
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) { // İlk satır başlık
          const rowData = {};
          let hasData = false;
          
          row.eachCell((cell, colNumber) => {
            const header = headers[colNumber];
            
            if (header) {
              // Vergi numarası ve TC numarası alanları için özel işlem
              if (header.toLowerCase().includes('vergi') || 
                  header.toLowerCase().includes('tax') ||
                  header.toLowerCase().includes('tc') ||
                  header.toLowerCase().includes('kimlik')) {
                // Bu alanlar için her zaman string olarak al ve başındaki sıfırları koru
                let cellValue = cell.text || cell.value || '';
                if (typeof cellValue === 'number') {
                  cellValue = cellValue.toString();
                }
                // Sadece rakamları içeren değerleri 10-11 hane olacak şekilde formatla
                if (/^\d+$/.test(String(cellValue))) {
                  const numStr = String(cellValue);
                  // Türk vergi numarası (10 hane) veya TC kimlik (11 hane) formatında ise başına sıfır ekle
                  if (numStr.length < 10) {
                    cellValue = numStr.padStart(10, '0');
                  } else if (numStr.length === 10 && header.toLowerCase().includes('tc')) {
                    // TC kimlik numarası 11 hane olmalı
                    cellValue = numStr.padStart(11, '0');
                  }
                }
                rowData[header] = String(cellValue);
              } else {
                // Diğer alanlar için normal işlem
                rowData[header] = cell.text || cell.value || '';
              }
              hasData = true;
            }
          });
          
          if (hasData) {
            data.push(rowData);
          }
        }
      });
      
      logToFile('success', 'Excel', `Excel dosyası okundu: ${data.length} kayıt (başındaki sıfırlar korundu)`);
      return { success: true, data: data, filePath: filePath };
    }
    
    return { success: false, error: 'Dosya seçilmedi' };
  } catch (error) {
    logToFile('error', 'Excel', 'Excel okuma hatası', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('select-save-location', async (event, defaultFileName) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: path.join(require('os').homedir(), 'Desktop', defaultFileName),
      filters: [
        { name: 'Excel Files', extensions: ['xlsx'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      logToFile('success', 'Dosya', `Kayıt yeri seçildi: ${result.filePath}`);
      return { success: true, filePath: result.filePath };
    }
    
    return { success: false, error: 'Kayıt yeri seçilmedi' };
  } catch (error) {
    logToFile('error', 'Dosya', 'Kayıt yeri seçimi hatası', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-data', async (event, key, data) => {
  try {
    store.set(key, data);
    logToFile('success', 'Veri', `Veri kaydedildi: ${key}`);
    
    // Şirket bilgileri kaydedilirse tracking sistemini güncelle
    if (key === 'companies') {
      mainWindow?.webContents.send('trigger-scan');
      logToFile('info', 'Veri', 'E-Defter tracking sistemi güncellenmesi tetiklendi');
    }
    
    return { success: true };
  } catch (error) {
    logToFile('error', 'Veri', `Veri kaydetme hatası: ${key}`, error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-data', async (event, key, defaultValue = null) => {
  try {
    const data = store.get(key, defaultValue);
    
    // Debug monitoring-data için yıl bilgilerini de göster
    if (key === 'monitoring-data' && Array.isArray(data)) {
      console.log(`[DEBUG] monitoring-data toplam: ${data.length}`);
      
      // Aylık dağılım (tüm yıllar)
      const monthlyCount = {};
      for (let i = 1; i <= 12; i++) {
        monthlyCount[i] = 0;
      }
      
      // Yıl dağılımı da ekle
      const yearlyCount = {};
      
      data.forEach(item => {
        if (item.month >= 1 && item.month <= 12) {
          monthlyCount[item.month]++;
        }
        
        if (item.year) {
          yearlyCount[item.year] = (yearlyCount[item.year] || 0) + 1;
        }
      });
      
      console.log(`[DEBUG] monitoring-data aylık dağılım (tüm yıllar):`, monthlyCount);
      console.log(`[DEBUG] monitoring-data yıl dağılımı:`, yearlyCount);
      
      // Mevcut yıl (2025) için aylık dağılım
      const currentYear = 2025;
      const currentYearData = data.filter(item => item.year === currentYear);
      const currentYearMonthly = {};
      for (let i = 1; i <= 12; i++) {
        currentYearMonthly[i] = 0;
      }
      
      currentYearData.forEach(item => {
        if (item.month >= 1 && item.month <= 12) {
          currentYearMonthly[item.month]++;
        }
      });
      
      console.log(`[DEBUG] monitoring-data ${currentYear} yılı aylık dağılımı:`, currentYearMonthly);
      console.log(`[DEBUG] monitoring-data ${currentYear} yılı toplam kayıt:`, currentYearData.length);
    }

    
    logToFile('info', 'Veri', `Veri yüklendi: ${key}`);
    return { success: true, data: data };
  } catch (error) {
    logToFile('error', 'Veri', `Veri yükleme hatası: ${key}`, error.message);
    return { success: false, error: error.message };
  }
});

// ========== KLASÖRü İZLEME HANDLER'LARI ==========

// Klasör izlemeyi başlat
ipcMain.handle('start-folder-monitoring', async (event, sourcePath, interval = 5000) => {
  try {
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return { success: false, error: 'Kaynak klasör bulunamadı' };
    }

    // ✅ Eski timeout'u temizle
    if (triggerScanTimeout) {
      clearTimeout(triggerScanTimeout);
      triggerScanTimeout = null;
    }

    // ✅ Eski watcher'ı kapat
    if (folderWatcher) {
      folderWatcher.close();
      folderWatcher = null;
    }

    logToFile('info', 'Klasör İzleme', `İzleme başlatıldı: ${sourcePath}, interval: ${interval}ms`);

    // Chokidar ile klasörü izle
    folderWatcher = chokidar.watch(sourcePath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: true
    });

    folderWatcher.on('add', (filePath) => {
      const fileName = path.basename(filePath);
      logToFile('info', 'Klasör İzleme', `Dosya eklendi: ${fileName}`);
      mainWindow?.webContents.send('file-added', { path: filePath, name: fileName });
      
      // ✅ ARTTIRILMIŞ DEBOUNCE: 10 saniye (dosya yazma işlemi bitmesi için)
      // Trigger-scan çok sık tetiklenmesini engelle
      clearTimeout(triggerScanTimeout);
      triggerScanTimeout = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed() && !isScanning) {
          logToFile('debug', 'Klasör İzleme', 'Trigger-scan gönderiliyor');
          mainWindow.webContents.send('trigger-scan');
        }
      }, 10000); // ✅ 10 saniye (eski: 5 saniye)
    });

    folderWatcher.on('addDir', (dirPath) => {
      const dirName = path.basename(dirPath);
      logToFile('info', 'Klasör İzleme', `Klasör eklendi: ${dirName}`);
      mainWindow?.webContents.send('folder-added', { path: dirPath, name: dirName });
    });

    folderWatcher.on('error', (error) => {
      logToFile('error', 'Klasör İzleme', 'Izleme hatası', error.message);
    });

    return { success: true, message: 'Klasör izleme başlatıldı' };
  } catch (error) {
    logToFile('error', 'Klasör İzleme', 'Başlatma hatası', error.message);
    return { success: false, error: error.message };
  }
});

// Klasör izlemeyi durdur
ipcMain.handle('stop-folder-monitoring', async (event) => {
  try {
    // ✅ Timeout'u temizle
    if (triggerScanTimeout) {
      clearTimeout(triggerScanTimeout);
      triggerScanTimeout = null;
    }

    // ✅ Watcher'ı kapat
    if (folderWatcher) {
      folderWatcher.close();
      folderWatcher = null;
      logToFile('info', 'Klasör İzleme', 'İzleme durduruldu');
      return { success: true, message: 'Klasör izleme durduruldu' };
    }
    return { success: false, error: 'Aktif izleme yok' };
  } catch (error) {
    logToFile('error', 'Klasör İzleme', 'Durdurma hatası', error.message);
    return { success: false, error: error.message };
  }
});

// ========== ARKA PLAN SERVİSİ HANDLER'LARI ==========

// Arka plan servisini başlat
ipcMain.handle('start-background-service', async (event) => {
  try {
    if (backgroundInterval) {
      return { success: false, error: 'Arka plan servisi zaten çalışıyor' };
    }

    logToFile('info', 'Arka Plan Servisi', 'Başlatılıyor...');

    // Her 5 dakika kontrol et (300 saniye)
    backgroundInterval = setInterval(async () => {
      try {
        const automationSettings = store.get('automation-settings', {});
        if (automationSettings.backgroundService && automationSettings.enabled) {
          logToFile('info', 'Arka Plan Servisi', 'Otomatik kontrol çalıştırılıyor');
          mainWindow?.webContents.send('perform-automated-scan');
        }
      } catch (err) {
        logToFile('error', 'Arka Plan Servisi', 'Kontrol hatası', err.message);
      }
    }, 300000); // 5 dakika (300 saniye)

    logToFile('info', 'Arka Plan Servisi', 'Başlatıldı');
    return { success: true, message: 'Arka plan servisi başlatıldı' };
  } catch (error) {
    logToFile('error', 'Arka Plan Servisi', 'Başlatma hatası', error.message);
    return { success: false, error: error.message };
  }
});

// Arka plan servisini durdur
ipcMain.handle('stop-background-service', async (event) => {
  try {
    if (backgroundInterval) {
      clearInterval(backgroundInterval);
      backgroundInterval = null;
      logToFile('info', 'Arka Plan Servisi', 'Durduruldu');
      return { success: true, message: 'Arka plan servisi durduruldu' };
    }
    return { success: false, error: 'Aktif arka plan servisi yok' };
  } catch (error) {
    logToFile('error', 'Arka Plan Servisi', 'Durdurma hatası', error.message);
    return { success: false, error: error.message };
  }
});

// Arka plan servisi durumunu kontrol et
ipcMain.handle('get-background-service-status', async (event) => {
  try {
    const isRunning = backgroundInterval !== null;
    const automationSettings = store.get('automation-settings', {});
    
    return {
      success: true,
      status: {
        running: isRunning,
        enabled: automationSettings.backgroundService || false,
        automationEnabled: automationSettings.enabled || false
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ========== OTOMASYONCı ENGINE HANDLER'LARI ==========

let automationEngineRunning = false;

// Otomasyon engine'i başlat
ipcMain.handle('start-automation-engine', async (event, sourcePath) => {
  try {
    if (automationEngineRunning) {
      return { success: false, error: 'Otomasyon engine zaten çalışıyor' };
    }

    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return { success: false, error: 'Kaynak klasör bulunamadı' };
    }

    automationEngineRunning = true;
    logToFile('info', 'Otomasyon Engine', `Engine başlatıldı: ${sourcePath}`);

    // Otomasyon engine'i çalıştır
    mainWindow?.webContents.send('auto-start-automation', { sourcePath });

    return { success: true, message: 'Otomasyon engine başlatıldı' };
  } catch (error) {
    automationEngineRunning = false;
    logToFile('error', 'Otomasyon Engine', 'Başlatma hatası', error.message);
    return { success: false, error: error.message };
  }
});

// Otomasyon engine'i durdur
ipcMain.handle('stop-automation-engine', async (event) => {
  try {
    if (automationEngineRunning) {
      automationEngineRunning = false;
      logToFile('info', 'Otomasyon Engine', 'Engine durduruldu');
      return { success: true, message: 'Otomasyon engine durduruldu' };
    }
    return { success: false, error: 'Aktif otomasyon engine yok' };
  } catch (error) {
    logToFile('error', 'Otomasyon Engine', 'Durdurma hatası', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('scan-folder-structure', async (event, sourcePath, selectedYear) => {
  try {
    if (isScanning) {
      logToFile('warning', 'Tarama', '⚠️ Tarama zaten devam ediyor');
      return { success: false, error: 'Tarama zaten devam ediyor', isAlreadyScanning: true };
    }

    isScanning = true;
    mainWindow?.webContents.send('scan-status-change', { scanning: true, message: '📊 Tarama başlatılıyor...' });
    logToFile('info', 'Tarama', `GIB taraması başlatılıyor: ${sourcePath}`);
    
    const companiesResult = store.get('companies', []);
    const companies = Array.isArray(companiesResult) ? companiesResult : [];
    
    // Şirket listesi boşsa, klasörleri otomatik olarak bul
    let companiesToScan = companies;
    if (companies.length === 0) {
      logToFile('warning', 'Tarama', 'Şirket listesi boş, klasörlerden otomatik taranacak');
      // Kayıtlı şirket olmasa bile klasör taramasını yap - tanımlanmamış klasörler sonunda bulunacak
    }

    // Taramayı background'da çalıştır
    const result = await performScan(sourcePath, selectedYear, companiesToScan);
    
    store.set('monitoring-data', result.data || []);
    logToFile('success', 'Tarama', `Tarama tamamlandı: ${(result.data || []).length} kayıt`);
    
    return result;
    
  } catch (error) {
    logToFile('error', 'Tarama', 'Hata:', error.message);
    return { success: false, error: error.message };
  } finally {
    isScanning = false;
    mainWindow?.webContents.send('scan-status-change', { scanning: false, message: '✅ Tarama tamamlandı' });
  }
});

// ✅ YENİ: Tarama fonksiyonu (non-blocking)
const performScan = async (sourcePath, selectedYear, companies) => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const results = [];

  for (const company of companies) {
      // TC numarası varsa priorite et (11 hane = şahıs), yoksa vergi numarası (10 hane = kurum)
      const priorityOrder = [];
      
      // TC varsa en başa ekle (öncelikli)
      if (company.tcNumber) {
        priorityOrder.push(String(company.tcNumber));
      }
      // Sonra vergi numarası
      if (company.taxNumber) {
        priorityOrder.push(String(company.taxNumber));
      }
      
      if (priorityOrder.length === 0) {
        logToFile('warning', 'Şirket', `Şirket ID bulunamadı: ${company.name}`);
        continue;
      }

      // İlk klasörü bulan ID'yi kullan (TC veya Vergi)
      let foundCompanyPath = null;
      let actualCompanyId = null; // Bulunan gerçek ID
      
      for (const id of priorityOrder) {
        const companyPath = path.join(sourcePath, id);
        if (fs.existsSync(companyPath)) {
          foundCompanyPath = companyPath;
          actualCompanyId = id; // BULUNAN ID'yi kaydet
          logToFile('debug', 'Şirket', `${company.name} - Klasör bulundu: ${id} (${id.length === 11 ? 'TC' : 'Vergi'})`);
          break;
        }
      }

      if (!foundCompanyPath) {
        logToFile('warning', 'Klasör', `${company.name} için klasör bulunamadı. Denenen: ${priorityOrder.join(', ')}`);
        // Ana klasöre ne var görelim
        try {
          const items = fs.readdirSync(sourcePath).slice(0, 10);
          logToFile('debug', 'Klasör', `Ana klasörde ilk 10 item: ${items.join(', ')}`);
        } catch (e) {
          logToFile('warning', 'Klasör', 'Ana klasör okunamadı');
        }
        continue;
      }

      const companyPath = foundCompanyPath;
      
      // Şirket klasörü altındaki tüm yıl klasörlerini bul
      const yearFolders = fs.readdirSync(companyPath).filter(folder => {
        const fullPath = path.join(companyPath, folder);
        return fs.statSync(fullPath).isDirectory() && folder.match(/^\d{2}\.\d{2}\.\d{4}-\d{2}\.\d{2}\.\d{4}$/);
      });
      
      if (yearFolders.length === 0) {
        // Klasör içindeki itemleri debug için logla
        try {
          const items = fs.readdirSync(companyPath);
          logToFile('debug', 'Klasör', `${company.name} için yıl klasörü bulunamadı. Mevcut itemler: ${items.join(', ')}`);
        } catch (e) {
          logToFile('warning', 'Klasör', `${company.name} için yıl klasörü bulunamadı ve klasör okunamadı`);
        }
        continue;
      }
      
      // Her yıl klasörü için kontrol
      for (const yearFolder of yearFolders) {
        const yearMatch = yearFolder.match(/^\d{2}\.\d{2}\.(\d{4})-\d{2}\.\d{2}\.(\d{4})$/);
        if (!yearMatch) continue;
        
        const folderYear = parseInt(yearMatch[1]);
        const yearPath = path.join(companyPath, yearFolder);
        
        logToFile('info', 'Yıl', `${company.name} - ${folderYear} yılı kontrol ediliyor`);

        // Yıl klasörü altındaki ay klasörlerini bul
        let monthFolders = [];
        try {
          monthFolders = fs.readdirSync(yearPath).filter(folder => {
            const fullPath = path.join(yearPath, folder);
            return fs.statSync(fullPath).isDirectory() && folder.match(/^(0[1-9]|1[0-2])$/);
          });
        } catch (error) {
          logToFile('error', 'Yıl', `${company.name} - ${folderYear} yıl klasörü okunamadı`, error.message);
          continue;
        }
        
        if (monthFolders.length === 0) {
          logToFile('info', 'Ay', `${company.name} - ${folderYear} yılında ay klasörü bulunamadı`);
          continue;
        }
        
        logToFile('info', 'Ay', `${company.name} - ${folderYear} yılında ${monthFolders.length} ay klasörü bulundu: ${monthFolders.join(', ')}`);
        
        // Sadece mevcut ay klasörleri için kontrol yap
        for (const monthFolder of monthFolders) {
          const month = parseInt(monthFolder);
          const monthPath = path.join(yearPath, monthFolder);
          
          // Gelecek ayları kontrol etme (sadece mevcut yıl için)
          if (folderYear === currentYear && month > currentMonth) {
            logToFile('info', 'Ay', `${company.name} - ${folderYear}/${month}: Gelecek ay, atlanıyor`);
            continue;
          }
          
          let status = 'missing';
          let gibFileStatus = {
            hasKB: false,
            hasYB: false,
            kbFile: null,
            ybFile: null
          };

          if (fs.existsSync(monthPath)) {
            let files = [];
            try {
              files = fs.readdirSync(monthPath);
            } catch (error) {
              logToFile('error', 'Ay', `${company.name} - ${folderYear}/${month} ay klasörü okunamadı`, error.message);
              continue;
            }
            
            // GIB dosyalarını kontrol et
            const monthStr = month.toString().padStart(2, '0');
            const yearMonthFormat = `${folderYear}${monthStr}`;
            
            // BASIT VE GÜVENILIR DOSYA ALGILAMA - Kayıtlı şirketlerle aynı yöntem
            const kbFile = files.find(file => 
              file.includes('-KB-') && 
              file.includes(yearMonthFormat) &&
              (file.endsWith('.zip') || file.endsWith('.xml'))
            );
            
            const ybFile = files.find(file => 
              file.includes('-YB-') && 
              file.includes(yearMonthFormat) &&
              (file.endsWith('.zip') || file.endsWith('.xml'))
            );
            
            // BONUS: K, D, DR dosyalarını da say
            const otherGibFiles = files.filter(file => {
              if (!file.includes(yearMonthFormat)) return false;
              if (!file.startsWith('GIB-')) return false;
              if (!(file.endsWith('.zip') || file.endsWith('.xml'))) return false;
              // KB ve YB hariç diğerleri
              return !file.includes('-KB-') && !file.includes('-YB-');
            });

            const gibFiles = [
              ...(kbFile ? [kbFile] : []),
              ...(ybFile ? [ybFile] : []),
              ...otherGibFiles
            ];

            const message = String(actualCompanyId || 'UNKNOWN') + ' ' + folderYear + '/' + month + ': Toplam GIB dosyası = ' + gibFiles.length;
            const details = 'KB=' + (kbFile || 'YOK') + ', YB=' + (ybFile || 'YOK') + ', Diğer=' + otherGibFiles.length;
            logToFile('debug', 'GIB Dosya', message, details);

            gibFileStatus = {
              hasKB: !!kbFile,
              hasYB: !!ybFile,
              kbFile: kbFile || null,
              ybFile: ybFile || null
            };

            // Hem KB hem YB varsa tamamlandı, en az bir KB veya YB varsa eksik, hiç yoksa missing
            if (kbFile && ybFile) {
              status = 'complete';
            } else if (gibFiles.length > 0) {
              status = 'incomplete';
            } else {
              status = 'missing';
            }
            
            logToFile('debug', 'Dosya', `${company.name} - Ay klasörü dosyaları: ${files.join(', ')}`);
            logToFile('debug', 'Dosya', `Aranan: ${yearMonthFormat}, Bulunan GIB dosyaları: ${gibFiles.length}, KB: ${kbFile}, YB: ${ybFile}`);
          } else {
            // Ay klasörü yoksa missing
            status = 'missing';
          }

          logToFile('info', 'Dosya', `${company.name} ${folderYear}/${month}: KB=${gibFileStatus.hasKB}, YB=${gibFileStatus.hasYB}, Durum=${status}`, `Klasör: ${monthPath}`);

          results.push({
            companyName: company.name,
            companyId: actualCompanyId, // Bulunan gerçek ID (TC veya Vergi)
            originalTaxNumber: company.taxNumber || null,
            originalTcNumber: company.tcNumber || null,
            year: folderYear,
            month: month,
            folderExists: fs.existsSync(monthPath),
            folderPath: monthPath,
            requiredFiles: 2,
            existingFiles: (gibFileStatus.hasKB ? 1 : 0) + (gibFileStatus.hasYB ? 1 : 0),
            missingFiles: 2 - ((gibFileStatus.hasKB ? 1 : 0) + (gibFileStatus.hasYB ? 1 : 0)),
            status: status,
            lastCheck: new Date(),
            gibFileStatus: gibFileStatus
          });
        }
      }
    }

    // Şirket listesinde olmayan ancak yerel klasörde bulunan klasörleri tespit et
    logToFile('info', 'Tarama', 'Tanımlanmamış şirket klasörleri aranıyor...');
    
    try {
      if (fs.existsSync(sourcePath)) {
        const allFolders = fs.readdirSync(sourcePath).filter(folder => {
          const fullPath = path.join(sourcePath, folder);
          return fs.statSync(fullPath).isDirectory() && folder.match(/^\d{10,11}$/); // 10-11 haneli sayı (vergi/tc no)
        });

        const registeredCompanyIds = [];
        companies.forEach(c => {
          if (c.tcNumber) registeredCompanyIds.push(String(c.tcNumber));
          if (c.taxNumber) registeredCompanyIds.push(String(c.taxNumber));
        });
        const unregisteredFolders = allFolders.filter(folderId => !registeredCompanyIds.includes(folderId));

        logToFile('info', 'Tarama', `${allFolders.length} klasör bulundu, ${unregisteredFolders.length} tanımlanmamış`);

        for (const companyId of unregisteredFolders) {
          const companyPath = path.join(sourcePath, companyId);
          
          logToFile('info', 'Tanımlanmamış', `Şirket klasörü bulundu ancak tanımlanmamış: ${companyId}`);

          // Yıl klasörlerini bul
          let yearFolders = [];
          try {
            yearFolders = fs.readdirSync(companyPath).filter(folder => {
              const fullPath = path.join(companyPath, folder);
              return fs.statSync(fullPath).isDirectory() && folder.match(/^\d{2}\.\d{2}\.\d{4}-\d{2}\.\d{2}\.\d{4}$/);
            });
          } catch (error) {
            logToFile('error', 'Tanımlanmamış', `Klasör okunamadı: ${companyPath}`, error.message);
            continue;
          }

          for (const yearFolder of yearFolders) {
            const yearMatch = yearFolder.match(/^\d{2}\.\d{2}\.(\d{4})-\d{2}\.\d{2}\.(\d{4})$/);
            if (!yearMatch) continue;
            
            const folderYear = parseInt(yearMatch[1]);
            const yearPath = path.join(companyPath, yearFolder);
            
            // Ay klasörlerini bul
            let monthFolders = [];
            try {
              monthFolders = fs.readdirSync(yearPath).filter(folder => {
                const fullPath = path.join(yearPath, folder);
                return fs.statSync(fullPath).isDirectory() && folder.match(/^(0[1-9]|1[0-2])$/);
              });
            } catch (error) {
              logToFile('error', 'Tanımlanmamış', `Yıl klasörü okunamadı: ${yearPath}`, error.message);
              continue;
            }

            for (const monthFolder of monthFolders) {
              const month = parseInt(monthFolder);
              const monthPath = path.join(yearPath, monthFolder);
              
              let status = 'missing';
              let gibFileStatus = {
                hasKB: false,
                hasYB: false,
                kbFile: null,
                ybFile: null
              };

              if (fs.existsSync(monthPath)) {
                let files = [];
                try {
                  files = fs.readdirSync(monthPath);
                } catch (error) {
                  logToFile('error', 'Tanımlanmamış', `Ay klasörü okunamadı: ${monthPath}`, error.message);
                  continue;
                }

                const kbFile = files.find(file => file.includes('-KB-') && file.endsWith('.zip'));
                const ybFile = files.find(file => file.includes('-YB-') && file.endsWith('.zip'));

                gibFileStatus = {
                  hasKB: !!kbFile,
                  hasYB: !!ybFile,
                  kbFile: kbFile || null,
                  ybFile: ybFile || null
                };

                if (kbFile && ybFile) {
                  status = 'complete';
                } else if (kbFile || ybFile) {
                  status = 'incomplete';
                } else {
                  status = 'missing';
                }
              }

              results.push({
                companyName: `Tanımlanmamış (${companyId})`,
                companyId: companyId,
                year: folderYear,
                month: month,
                folderExists: fs.existsSync(monthPath),
                folderPath: monthPath,
                requiredFiles: 2,
                existingFiles: (gibFileStatus.hasKB ? 1 : 0) + (gibFileStatus.hasYB ? 1 : 0),
                missingFiles: 2 - ((gibFileStatus.hasKB ? 1 : 0) + (gibFileStatus.hasYB ? 1 : 0)),
                status: status,
                lastCheck: new Date(),
                gibFileStatus: gibFileStatus
              });
            }
          }
        }

        if (unregisteredFolders.length > 0) {
          logToFile('warning', 'Tarama', `${unregisteredFolders.length} tanımlanmamış şirket klasörü bulundu: ${unregisteredFolders.join(', ')}`);
        }
      }
    } catch (error) {
      logToFile('error', 'Tarama', 'Tanımlanmamış şirket taraması hatası', error.message);
    }

    // Monitoring data'yı kaydet
    store.set('monitoring-data', results);
    
    logToFile('success', 'Tarama', `GIB tarama tamamlandı: ${results.length} kayıt bulundu`);

    // ✅ OTOMASYONLARI TETIKLE: Tamamlanan dosyaları işle (Email + Backup)
    // setImmediate yerine setTimeout kullan (Electron uyumluluğu için)
    setTimeout(async () => {
      try {
        logToFile('info', 'Otomasyon', `Tarama sonrası tetikleme başlatıldı - ${results.length} kayıt işlenecek`);
        
        const completeRecords = results.filter(r => r.status === 'complete');
        const incompleteRecords = results.filter(r => r.status === 'incomplete' || r.status === 'missing');
        
        logToFile('info', 'Otomasyon', `Tamamlanan: ${completeRecords.length}, Eksik: ${incompleteRecords.length}`);
        
        // processGIBFile ile tam otomasyon işle
        for (const record of completeRecords) {
          try {
            if (record.gibFileStatus && record.gibFileStatus.allGibFiles && record.gibFileStatus.allGibFiles[0]) {
              const gibFilePath = path.join(record.folderPath, record.gibFileStatus.allGibFiles[0]);
              if (fs.existsSync(gibFilePath)) {
                logToFile('info', 'Otomasyon', `${record.companyName} - Dosya işleniyor: ${gibFilePath}`);
                
                // ✅ Otomasyon yedeklemesi yapılıyorsa aktivite kaydet
                const automationSettings = store.get('automationSettings', {});
                if (automationSettings.enableAutoBackup && automationSettings.backupPath) {
                  const backupPath = path.join(automationSettings.backupPath, record.companyName, `${record.year}-${String(record.month).padStart(2, '0')}`);
                  
                  const backupActivities = store.get('backupActivities', []);
                  backupActivities.unshift({
                    id: Date.now().toString() + Math.random(),
                    timestamp: new Date().toISOString(),
                    type: 'automatic', // Otomasyon tarafından
                    sourcePath: record.folderPath,
                    destinationPath: backupPath,
                    status: 'success',
                    companyName: record.companyName,
                    companyId: record.companyId,
                    period: `${record.year}-${String(record.month).padStart(2, '0')}`,
                    message: `Otomasyon yedeklemesi: ${record.companyName}`
                  });
                  
                  if (backupActivities.length > 200) {
                    backupActivities.splice(200);
                  }
                  
                  store.set('backupActivities', backupActivities);
                  logToFile('info', 'Otomasyon Yedekleme', `${record.companyName} otomatik yedeklendi`);
                }
                
                await processGIBFile(gibFilePath);
              }
            }
          } catch (err) {
            logToFile('error', 'Otomasyon', `${record.companyName} işleme hatası`, err.message);
          }
        }
        
        logToFile('success', 'Otomasyon', 'Otomatik işlemler tamamlandı');
      } catch (automationErr) {
        logToFile('error', 'Otomasyon', 'Tarama sonrası otomasyon hatası', automationErr.message);
      }
    }, 0); // ✅ setTimeout için 0ms delay
    
    return { success: true, data: results };
};

// ========== RAPOR HANDLER'LARI ==========

// Yedekleme handler'ı
ipcMain.handle('backup-files', async (event, sourcePath, destinationPath) => {
  try {
    logToFile('info', 'Yedekleme', `Yedekleme başlatılıyor: ${sourcePath} → ${destinationPath}`);
    
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: 'Kaynak klasörü bulunamadı' };
    }

    let copiedFiles = 0;
    let skippedFiles = 0;
    let totalSize = 0;
    let errorCount = 0;
    const MAX_BATCH_SIZE = 50; // 50 dosya bir batch'de
    let batch = [];

    const copyFileIfNecessary = async (srcFile, destFile) => {
      try {
        // Hedef dosya yoksa veya kaynak daha yeni ise kopyala
        let shouldCopy = false;
        
        if (!fs.existsSync(destFile)) {
          shouldCopy = true;
        } else {
          try {
            const srcStats = fs.statSync(srcFile);
            const destStats = fs.statSync(destFile);
            
            // Dosya boyutu farklı ise veya kaynak dosya daha yeni ise kopyala
            if (srcStats.size !== destStats.size || srcStats.mtime > destStats.mtime) {
              shouldCopy = true;
            }
          } catch (err) {
            shouldCopy = true; // Hata durumunda kopyala
          }
        }
        
        if (shouldCopy) {
          try {
            fs.ensureDirSync(path.dirname(destFile));
            fs.copySync(srcFile, destFile, { overwrite: true });
            const stats = fs.statSync(srcFile);
            totalSize += stats.size;
            copiedFiles++;
            return true;
          } catch (err) {
            errorCount++;
            logToFile('warn', 'Yedekleme', `Dosya kopyalama hatası: ${path.basename(srcFile)}`, err.message);
            return false;
          }
        } else {
          skippedFiles++;
          return false;
        }
      } catch (error) {
        errorCount++;
        logToFile('error', 'Yedekleme', `Dosya kontrol hatası: ${srcFile}`, error.message);
        return false;
      }
    };

    const copyDirectoryRecursive = async (src, dest, depth = 0) => {
      // Çok derin özyinelemlemeleri engelle (güvenlik ve performans)
      if (depth > 20) {
        logToFile('warn', 'Yedekleme', `Maksimum klasör derinliğine ulaşıldı: ${src}`);
        return;
      }

      try {
        fs.ensureDirSync(dest);
        const entries = fs.readdirSync(src, { withFileTypes: true });
        
        for (const entry of entries) {
          try {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            
            if (entry.isDirectory()) {
              // Batch işlemeyi kontrol et
              if (batch.length > 0) {
                await Promise.all(batch);
                batch = [];
              }
              
              await copyDirectoryRecursive(srcPath, destPath, depth + 1);
            } else if (entry.isFile()) {
              // Batch'e dosya ekle
              batch.push(copyFileIfNecessary(srcPath, destPath));
              
              // Batch dolunca işle
              if (batch.length >= MAX_BATCH_SIZE) {
                await Promise.all(batch);
                batch = [];
              }
            }
          } catch (err) {
            errorCount++;
            logToFile('warn', 'Yedekleme', `Dosya işleme hatası: ${entry.name}`, err.message);
          }
        }
        
        // Kalan batch'i işle
        if (batch.length > 0) {
          await Promise.all(batch);
          batch = [];
        }
      } catch (error) {
        logToFile('error', 'Yedekleme', `Klasör kopyalama hatası: ${src}`, error.message);
        throw error;
      }
    };

    // Hedef klasörün varlığını kontrol et ve oluştur
    try {
      fs.ensureDirSync(destinationPath);
    } catch (err) {
      return { success: false, error: `Hedef klasörü oluşturulamadı: ${err.message}` };
    }
    
    // Dosyaları kopyala
    try {
      await copyDirectoryRecursive(sourcePath, destinationPath);
    } catch (err) {
      return { success: false, error: `Kopyalama hatası: ${err.message}` };
    }
    
    const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
    
    logToFile('success', 'Yedekleme', `Yedekleme tamamlandı. ${copiedFiles} yeni dosya kopyalandı, ${skippedFiles} dosya atlandı, ${errorCount} hata. Toplam boyut: ${sizeInMB} MB`);
    
    // ✅ Yedekleme aktivitesini kaydet
    const backupActivities = store.get('backupActivities', []);
    backupActivities.unshift({
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      type: 'manual', // 'manual' veya 'automatic'
      sourcePath: sourcePath,
      destinationPath: destinationPath,
      status: 'success',
      copiedFiles: copiedFiles,
      skippedFiles: skippedFiles,
      errorCount: errorCount,
      totalSize: sizeInMB + ' MB',
      message: `${copiedFiles} dosya yedeklendi`
    });
    
    // Maksimum 200 aktivite sakla (eski olanları sil)
    if (backupActivities.length > 200) {
      backupActivities.splice(200);
    }
    
    store.set('backupActivities', backupActivities);
    
    return { 
      success: true, 
      message: `Yedekleme tamamlandı`,
      stats: {
        copiedFiles,
        skippedFiles,
        errorCount,
        totalFiles: copiedFiles + skippedFiles + errorCount,
        totalSize: sizeInMB + ' MB'
      }
    };
    
  } catch (error) {
    logToFile('error', 'Yedekleme', 'Yedekleme hatası', error.message);
    
    // ✅ Başarısız yedekleme aktivitesini kaydet
    try {
      const backupActivities = store.get('backupActivities', []);
      backupActivities.unshift({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        type: 'manual',
        sourcePath: sourcePath,
        destinationPath: destinationPath,
        status: 'error',
        copiedFiles: 0,
        skippedFiles: 0,
        errorCount: 1,
      totalSize: '0 MB',
      message: `Hata: ${error.message}`
    });
    
    if (backupActivities.length > 200) {
      backupActivities.splice(200);
    }
    
    store.set('backupActivities', backupActivities);
    } catch (storeError) {
      logToFile('error', 'Yedekleme', 'Aktivite kaydı hatası', storeError.message);
    }
    
    return { 
      success: false, 
      error: error.message || 'Yedekleme sırasında bir hata oluştu',
      stats: {
        copiedFiles: 0,
        skippedFiles: 0,
        errorCount: 1,
        totalFiles: 1,
        totalSize: '0 MB'
      }
    };
  }
});

// ========== RAPOR HANDLER'LARI ==========

// Rapor oluştur
ipcMain.handle('generate-report', async (event, data, filePath) => {
  try {
    // Eğer filePath verilmemişse kullanıcıya sor
    let reportPath = filePath;
    if (!reportPath) {
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: path.join(require('os').homedir(), 'Desktop', `GIB-Raporu-${new Date().toISOString().split('T')[0]}.xlsx`),
        filters: [
          { name: 'Excel Files', extensions: ['xlsx'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Kayıt yeri seçilmedi' };
      }
      
      reportPath = result.filePath;
    }

    const excelData = data.map(item => ({
      'Şirket Adı': item.companyName,
      'Vergi/TC No': item.companyId,
      'Yıl': item.year,
      'Ay': item.month.toString().padStart(2, '0'),
      'KB Dosyası': item.gibFileStatus?.hasKB ? 'Mevcut' : 'Eksik',
      'YB Dosyası': item.gibFileStatus?.hasYB ? 'Mevcut' : 'Eksik',
      'Durum': item.status === 'complete' ? 'Tamamlandı' : 
               item.status === 'incomplete' ? 'Eksik Dosya' : 'Klasör Yok',
      'Son Kontrol': new Date(item.lastCheck).toLocaleString('tr-TR'),
      'Klasör Yolu': item.folderPath || ''
    }));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('GIB Raporu');
    
    // Başlıkları ekle
    const headers = Object.keys(excelData[0] || {});
    worksheet.addRow(headers);
    
    // Veri satırlarını ekle
    excelData.forEach(row => {
      worksheet.addRow(Object.values(row));
    });
    
    // Sütun genişliklerini otomatik ayarla
    worksheet.columns.forEach(column => {
      column.width = 15;
    });
    
    await workbook.xlsx.writeFile(reportPath);
    
    logToFile('success', 'Rapor', `Excel raporu oluşturuldu: ${reportPath}`);
    return { success: true, filePath: reportPath };
    
  } catch (error) {
    logToFile('error', 'Rapor', 'Rapor oluşturma hatası', error.message);
    return { success: false, error: error.message };
  }
});

// Detaylı GIB raporu oluştur (dosya detayları ile birlikte)
ipcMain.handle('generate-detailed-gib-report', async (event, data, filePath, metadata) => {
  try {
    logToFile('info', 'Rapor', `Detaylı GIB raporu oluşturuluyor: ${data.length} kayıt`);

    const workbook = new ExcelJS.Workbook();
    
    // Ana veri sayfası
    const worksheet = workbook.addWorksheet('GIB Detay Raporu');
    
    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      worksheet.addRow(headers);
      
      data.forEach(row => {
        worksheet.addRow(Object.values(row));
      });
      
      // Sütun genişliklerini ayarla
      worksheet.columns.forEach(column => {
        column.width = 15;
      });
    }
    
    // Özet sayfası oluştur
    const summaryWorksheet = workbook.addWorksheet('Rapor Özeti');
    const summaryData = [
      ['DETAYLI GIB RAPORU ÖZETİ', ''],
      ['Rapor Tarihi', new Date().toLocaleString('tr-TR')],
      ['Toplam Sistem Kayıtları', metadata.totalRecords || 0],
      ['Filtrelenmiş Kayıtlar', metadata.filteredRecords || 0],
      ['', ''],
      ['FİLTRE BİLGİLERİ', ''],
      ['Seçilen Yıl', metadata.filters?.year === 'all' ? 'Tüm Yıllar' : metadata.filters?.year || '-'],
      ['Seçilen Ay', metadata.filters?.month === 'all' ? 'Tüm Aylar' : metadata.filters?.month || '-'],
      ['Rapor Türü', metadata.filters?.type || '-'],
      ['Arama Terimi', metadata.filters?.search || 'Yok'],
      ['', ''],
      ['DURUM İSTATİSTİKLERİ', ''],
    ];

    // İstatistikleri hesapla
    const stats = {
      complete: data.filter(d => d.Durum === 'Tamamlandı').length,
      incomplete: data.filter(d => d.Durum === 'Eksik Dosya').length,
      missing: data.filter(d => d.Durum === 'Klasör/Dosya Yok').length,
      kbMissing: data.filter(d => d['KB Dosyası Durumu'] === 'Eksik').length,
      ybMissing: data.filter(d => d['YB Dosyası Durumu'] === 'Eksik').length,
      companies: new Set(data.map(d => d['Vergi/TC No'])).size
    };

    summaryData.push(
      ['Tamamlanan Kayıtlar', stats.complete],
      ['Eksik Dosya Kayıtları', stats.incomplete], 
      ['Eksik Klasör Kayıtları', stats.missing],
      ['Eksik KB Dosyaları', stats.kbMissing],
      ['Eksik YB Dosyaları', stats.ybMissing],
      ['Toplam Şirket Sayısı', stats.companies],
      ['', ''],
      ['DOSYA BİLGİLERİ', ''],
      ['Mevcut KB Dosyaları', data.filter(d => d['KB Dosyası Durumu'] === 'Mevcut').length],
      ['Mevcut YB Dosyaları', data.filter(d => d['YB Dosyası Durumu'] === 'Mevcut').length],
      ['Ortalama Tamamlanma Oranı', `${Math.round(data.reduce((sum, d) => sum + (d['Tamamlanma Oranı (%)'] || 0), 0) / data.length || 0)}%`]
    );

    summaryData.forEach(row => {
      summaryWorksheet.addRow(row);
    });
    
    summaryWorksheet.columns.forEach(column => {
      column.width = 25;
    });

    // Eksik dosyalar için ayrı sayfa
    const missingFiles = data.filter(d => d.Durum !== 'Tamamlandı');
    if (missingFiles.length > 0) {
      const missingWorksheet = workbook.addWorksheet('Eksik Dosyalar');
      
      if (missingFiles.length > 0) {
        const headers = Object.keys(missingFiles[0]);
        missingWorksheet.addRow(headers);
        
        missingFiles.forEach(row => {
          missingWorksheet.addRow(Object.values(row));
        });
        
        missingWorksheet.columns.forEach(column => {
          column.width = 15;
        });
      }
    }
    
    await workbook.xlsx.writeFile(filePath);
    
    logToFile('success', 'Rapor', `Detaylı GIB raporu oluşturuldu: ${filePath} (${data.length}/${metadata.totalRecords} kayıt)`);
    return { success: true, filePath: filePath };
    
  } catch (error) {
    logToFile('error', 'Rapor', 'Detaylı GIB raporu oluşturma hatası', error.message);
    return { success: false, error: error.message };
  }
});

// Sistem aktiviteleri getir
ipcMain.handle('get-system-activities', async (event, startDate, endDate, category) => {
  try {
    const appPath = app.getPath('userData');
    const logDir = path.join(appPath, 'logs');
    
    if (!fs.existsSync(logDir)) {
      return { success: true, data: [] };
    }

    const activities = [];
    const files = fs.readdirSync(logDir).filter(file => file.endsWith('.txt'));
    
    // ✅ 30 günlük veri saklama (daha önce 7 gün idi)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    for (const file of files) {
      const filePath = path.join(logDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        
        for (const line of lines) {
          if (!line.trim() || line.startsWith('===')) continue;
          
          const logMatch = line.match(/^(\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2}) - \[(\w+)\] ([^:]+): (.+?)(?:\s-\s(.+))?$/);
          if (!logMatch) continue;
          
          const [, dateTimeStr, level, categoryName, message, details] = logMatch;
          
          try {
            const [datePart, timePart] = dateTimeStr.split(' ');
            const [day, month, year] = datePart.split('.');
            const logDate = new Date(`${year}-${month}-${day} ${timePart}`);
            
            if (isNaN(logDate.getTime()) || logDate < thirtyDaysAgo) continue;
            if (startDate && logDate < new Date(startDate)) continue;
            if (endDate && logDate > new Date(endDate + ' 23:59:59')) continue;
            if (category && category !== 'all' && !categoryName.toLowerCase().includes(category.toLowerCase())) continue;
            
            activities.push({
              id: `${logDate.getTime()}-${Math.random()}`,
              date: logDate.toISOString(),
              dateStr: dateTimeStr,
              level: level.toLowerCase(),
              category: categoryName,
              message: String(message || '').trim(),
              details: String(details || '').trim(),
              source: file
            });
          } catch (parseError) {
            console.warn(`Log parsing hatası: ${line.substring(0, 100)}...`, parseError.message);
          }
        }
      } catch (fileError) {
        console.warn(`Log dosyası okunma hatası: ${file}`, fileError.message);
      }
    }
    
    // Tarihe göre sırala (en yeni en üstte)
    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const limitedActivities = activities.slice(0, 200);
    logToFile('success', 'Rapor', `Sistem aktiviteleri raporu oluşturuldu: ${limitedActivities.length} kayıt`);
    
    return { success: true, data: limitedActivities };
  } catch (error) {
    logToFile('error', 'Rapor', 'Sistem aktiviteleri raporu hatası', error.message);
    return { success: false, error: error.message };
  }
});

// E-posta aktiviteleri raporu oluştur
ipcMain.handle('generate-activities-report', async (event, activities, filters) => {
  try {
    logToFile('info', 'Rapor', 'E-posta aktiviteleri raporu oluşturma isteği alındı');
    
    if (!activities || activities.length === 0) {
      return { 
        success: false, 
        error: 'Rapor oluşturmak için aktivite verisi bulunamadı',
        filePath: null 
      };
    }
    
    // Excel dosyasını oluştur
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('E-posta Aktiviteleri');
    
    // Başlık satırı
    worksheet.columns = [
      { header: 'Tarih', key: 'dateStr', width: 20 },
      { header: 'Saat', key: 'time', width: 12 },
      { header: 'Durum', key: 'level', width: 12 },
      { header: 'Kategori', key: 'category', width: 20 },
      { header: 'Mesaj', key: 'message', width: 40 },
      { header: 'Detaylar', key: 'details', width: 50 }
    ];
    
    // Başlık stilini ayarla
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'center' };
    
    // Aktiviteleri ekle
    activities.forEach(activity => {
      const dateStr = activity.dateStr || '';
      const [datePart, timePart] = dateStr.split(' ');
      
      worksheet.addRow({
        dateStr: datePart || '',
        time: timePart || '',
        level: (activity.level || '').toUpperCase(),
        category: activity.category || '',
        message: activity.message || '',
        details: activity.details || ''
      });
    });
    
    // Başarı durumuna göre renk kodlaması
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Başlık satırını atla
      
      const levelCell = row.getCell('level');
      const levelValue = (levelCell.value || '').toString().toUpperCase();
      
      if (levelValue === 'SUCCESS') {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
        levelCell.font = { color: { argb: 'FF70AD47' }, bold: true };
      } else if (levelValue === 'ERROR') {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
        levelCell.font = { color: { argb: 'FFC5504A' }, bold: true };
      } else if (levelValue === 'WARNING') {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF8D3' } };
        levelCell.font = { color: { argb: 'FFE0A024' }, bold: true };
      } else if (levelValue === 'INFO') {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEEAF6' } };
        levelCell.font = { color: { argb: 'FF4472C4' }, bold: true };
      }
      
      row.alignment = { wrapText: true, vertical: 'top' };
    });
    
    // Sütun genişliklerini optimize et
    worksheet.columns.forEach(column => {
      column.width = Math.min(column.width || 20, 50);
    });
    
    // Dosya adı ve yolu
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const reportFileName = `E-Posta-Raporu-${timestamp}.xlsx`;
    
    // Dialog ile dosya yolunu sor
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: path.join(require('os').homedir(), 'Desktop', reportFileName),
      filters: [
        { name: 'Excel Files', extensions: ['xlsx'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (result.canceled) {
      logToFile('info', 'Rapor', 'E-posta raporu indir işlemi iptal edildi');
      return { 
        success: false, 
        error: 'İşlem iptal edildi',
        filePath: null 
      };
    }
    
    // Excel dosyasını kaydet
    await workbook.xlsx.writeFile(result.filePath);
    
    logToFile('success', 'Rapor', `E-posta raporu oluşturuldu: ${result.filePath} (${activities.length} aktivite)`);
    
    return { 
      success: true, 
      filePath: result.filePath,
      message: `${activities.length} aktivite içeren rapor başarıyla oluşturuldu`
    };
    
  } catch (error) {
    logToFile('error', 'Rapor', 'E-posta raporu oluşturma hatası', error.message);
    return { 
      success: false, 
      error: `Rapor oluşturma hatası: ${error.message}`,
      filePath: null 
    };
  }
});

// ========== EMAIL TEMPLATE BUILDER ==========

function createProfessionalEmailTemplate(selectedPeriods, companyName = '') {
  const currentYear = new Date().getFullYear();
  const periodsText = selectedPeriods ? selectedPeriods.map(p => `${p.month}/${p.year}`).join(', ') : 'Belirtilen dönemler';
  
  return `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>E-Defter Dosyaları</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #2c3e50;
            background-color: #f8f9fa;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .period-info {
            background: rgba(255,255,255,0.1);
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
            font-size: 16px;
        }
        .content {
            padding: 40px;
        }
        .section {
            margin-bottom: 35px;
        }
        .section h2 {
            color: #1e3c72;
            border-left: 4px solid #3498db;
            padding-left: 15px;
            margin-bottom: 20px;
            font-size: 20px;
        }
        .highlight-box {
            background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .warning-box {
            background: linear-gradient(135deg, #fd79a8 0%, #e84393 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .info-box {
            background: #f1f2f6;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            margin: 15px 0;
        }
        .backup-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .backup-item {
            background: white;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            transition: all 0.3s ease;
        }
        .backup-item:hover {
            border-color: #3498db;
            transform: translateY(-2px);
        }
        .backup-item h4 {
            color: #2980b9;
            margin-bottom: 10px;
        }
        ul {
            padding-left: 20px;
        }
        li {
            margin-bottom: 8px;
        }
        .footer {
            background: #34495e;
            color: white;
            padding: 30px;
            text-align: center;
        }
        .company-highlight {
            color: #e74c3c;
            font-weight: bold;
        }
        .period-highlight {
            background: #f39c12;
            color: white;
            padding: 3px 8px;
            border-radius: 4px;
            font-weight: bold;
        }
        .link-button {
            display: inline-block;
            background: #3498db;
            color: white;
            padding: 12px 25px;
            text-decoration: none;
            border-radius: 6px;
            margin: 5px;
            font-weight: bold;
        }
        .link-button:hover {
            background: #2980b9;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>📊 E-Defter Dosyaları Teslimi</h1>
            <div class="period-info">
                <strong>Dönem:</strong> <span class="period-highlight">${periodsText}</span>
                ${companyName ? `<br><strong>Şirket:</strong> <span class="company-highlight">${companyName}</span>` : ''}
            </div>
        </div>

        <!-- Ana İçerik -->
        <div class="content">
            
            <!-- Giriş -->
            <div class="section">
                <h2>� Giriş</h2>
                <p>Sayın ${companyName ? companyName : 'Firma Yetkilisi'},</p>
                <p>Ekte <strong>${periodsText} dönemine</strong> ait e-defter klasörünüzü bulabilirsiniz. Bu klasör, yasal mevzuat gereği oluşturulması ve saklanması zorunlu olan e-defter dosyalarını içermektedir.</p>
            </div>

            <!-- E-Defter Nedir -->
            <div class="section">
                <h2>📚 E-Defter Nedir?</h2>
                <div class="info-box">
                    <p><strong>e-Defter</strong>, Vergi Usul Kanunu ve Türk Ticaret Kanunu gereğince tutulması zorunlu olan defterlerin, belirlenen standartlara uygun olarak <strong>elektronik ortamda oluşturulması, kaydedilmesi, saklanması ve ibraz edilmesini</strong> sağlayan bir sistemdir.</p>
                    <p>Bu sistem, vergi mükelleflerine kağıt defterlerin yerini alacak şekilde elektronik defter tutma imkanı sunar.</p>
                </div>
            </div>

            <!-- Mevzuat Bilgisi -->
            <div class="section">
                <h2>⚖️ Mevzuat Bilgisi</h2>
                <div class="warning-box">
                    <h3 style="margin: 0 0 15px 0;">⚠️ ÖNEMLİ UYARI</h3>
                    <p><strong>Bu evrakların saklanması, yasal mevzuat gereği sizin sorumluluğunuzdadır.</strong> Aşağıdaki mevzuat bilgilerini dikkatlice okuyunuz.</p>
                </div>
                <ul>
                    <li><strong>Vergi Usul Kanunu (VUK):</strong> VUK'un 242. maddesi ve ilgili tebliğler çerçevesinde e-Defterlerin tutulması zorunludur.</li>
                    <li><strong>Türk Ticaret Kanunu (TTK):</strong> TTK'nın 64. maddesi ve ilgili hükümleri uyarınca, ticari defterlerin elektronik ortamda tutulması mümkündür.</li>
                    <li><strong>Saklama Süresi:</strong> 6102 sayılı TTK ve 213 sayılı VUK hükümlerine göre, <span class="company-highlight">defter ve belgelerin 10 yıl süreyle saklanması zorunludur.</span></li>
                </ul>
            </div>

            <!-- Cezai Durumlar -->
            <div class="section">
                <h2>⚠️ Cezai Durumlar</h2>
                <div class="warning-box">
                    <p><strong>e-defterlerin ibraz edilmemesi durumunda</strong> Vergi Usul Kanunu'nun mükerrer 355. maddesi uyarınca:</p>
                    <ul>
                        <li>📋 Özel usulsüzlük cezası</li>
                        <li>📊 Resen vergi tarhiyatı (VUK 30/3, 341, 344/2 maddeleri)</li>
                        <li>💰 3 kat vergi ziya cezası</li>
                        <li>🚫 KDV indirimlerinin reddi (3065 sayılı KDV kanunu 29/3, 34/1)</li>
                        <li>⚖️ Vergi suçu raporuyla savcılığa suç duyurusunda bulunulması (VUK 359/a-2 ve 367. maddeleri)</li>
                    </ul>
                </div>
            </div>

            <!-- Saklama Talimatları -->
            <div class="section">
                <h2>💾 Saklama Talimatları</h2>
                
                <h3>🔄 Çoklu Yedekleme (Önemli!)</h3>
                <p>e-Defter klasörlerinizi birden fazla yerde yedeklemeniz önemlidir:</p>
                
                <div class="backup-grid">
                    <div class="backup-item">
                        <h4>💻 Bilgisayar Yedekleme</h4>
                        <p>Birden fazla bilgisayarda yedekleme</p>
                    </div>
                    <div class="backup-item">
                        <h4>🔌 Taşınabilir Depolama</h4>
                        <p>Harici disk veya USB bellek</p>
                    </div>
                    <div class="backup-item">
                        <h4>☁️ Bulut Depolama</h4>
                        <p>Google Drive, Dropbox, OneDrive vb.</p>
                    </div>
                    <div class="backup-item">
                        <h4>🏢 Profesyonel Hizmetler</h4>
                        <p>İşnet, UyumYedek gibi firmalar</p>
                    </div>
                </div>

                <h3>🔗 Önerilen Ücretli Yedekleme Hizmetleri:</h3>
                <div style="text-align: center; margin: 20px 0;">
                    <a href="https://www.nettearsiv.com/arsivTanitim/" class="link-button">NETTEarşiv</a>
                    <a href="https://istedefterim.com/" class="link-button">İsteDefterim</a>
                    <a href="https://www.uyumsoft.com/uyumyedek" class="link-button">UyumYedek</a>
                </div>

                <div class="info-box">
                    <h4>📋 Önemli Hatırlatmalar:</h4>
                    <ul>
                        <li><strong>Saklama Süresi:</strong> e-Defterlerinizi en az <span class="company-highlight">10 yıl süreyle</span> saklamanız gerekmektedir.</li>
                        <li><strong>Dosya Bütünlüğü:</strong> Bu süre boyunca dosyaların bozulmaması ve erişilebilir olması sağlanmalıdır.</li>
                        <li><strong>Güvenlik:</strong> Saklanan dosyaların güvenliğinin sağlanması, yetkisiz erişimlere karşı korunması gerekmektedir.</li>
                        <li><strong>Güçlü Parolalar:</strong> Özellikle bulut depolama hizmetleri kullanıyorsanız, güçlü parolalar kullanarak hesap güvenliğinizi artırın.</li>
                    </ul>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>📧 Bu e-posta otomatik otomasyon sistemi tarafından gönderilmiştir.</p>
            <p>⏰ Gönderim Tarihi: ${new Date().toLocaleString('tr-TR')}</p>
            <p style="font-size: 12px; opacity: 0.8;">E-Defter Otomasyon Sistemi v1.0 • ${currentYear}</p>
        </div>
    </div>
</body>
</html>`;
}

// ========== EMAIL HANDLERS ==========

// Email bağlantı testi
ipcMain.handle('test-email-connection', async (event, smtpConfig) => {
  try {
    logToFile('info', 'Email', 'Email bağlantı testi başlatılıyor');
    
    if (!smtpConfig) {
      return { success: false, error: 'SMTP yapılandırması bulunamadı' };
    }

    // Frontend'den gelen property isimleri: smtpHost, smtpPort, fromEmail, password, fromName
    const host = smtpConfig.smtpHost || smtpConfig.host;
    const port = smtpConfig.smtpPort || smtpConfig.port || 587;
    const user = smtpConfig.fromEmail || smtpConfig.user;
    const pass = smtpConfig.password || smtpConfig.pass;
    const fromName = smtpConfig.fromName || 'E-Defter Sistemi';

    if (!host || !user || !pass) {
      return { success: false, error: 'SMTP bilgileri eksik: host, user veya pass gerekli' };
    }

    const transporter = nodemailer.createTransport({
      host: host,
      port: port,
      secure: port === 465,
      auth: {
        user: user,
        pass: pass
      }
    });

    // TEST MAİLİ GÖNDER (sadece verify değil)
    const testEmailHtml = `
      <!DOCTYPE html>
      <html dir="ltr" lang="tr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>SMTP Test Başarılı</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #2c3e50; line-height: 1.6; background: #f8f9fa; }
            .email-container { max-width: 600px; margin: 0 auto; background: #ffffff; }
            
            /* Header with gradient */
            .header { 
              background: linear-gradient(135deg, #27ae60 0%, #229954 50%, #1e8449 100%);
              padding: 40px 30px;
              text-align: center;
              color: white;
            }
            .header h1 { font-size: 32px; font-weight: 700; margin-bottom: 10px; letter-spacing: -0.5px; }
            .header p { font-size: 14px; opacity: 0.95; font-weight: 300; }
            
            /* Main content */
            .content { 
              padding: 40px 30px;
              background: #ffffff;
            }
            .greeting { font-size: 16px; color: #2c3e50; margin-bottom: 20px; font-weight: 500; }
            .success-message { 
              background: #d5f4e6;
              border-left: 5px solid #27ae60;
              padding: 20px;
              margin: 25px 0;
              border-radius: 4px;
              color: #145a32;
            }
            .success-message strong { color: #0b5345; }
            
            /* Info box */
            .info-section { 
              background: linear-gradient(135deg, #ecf0f1 0%, #f8f9fa 100%);
              border-left: 5px solid #3498db;
              padding: 20px;
              margin: 25px 0;
              border-radius: 4px;
            }
            .info-section strong { color: #2980b9; display: block; margin-bottom: 12px; font-size: 14px; }
            .info-item { 
              padding: 8px 0;
              font-size: 14px;
              color: #34495e;
              border-bottom: 1px solid #ecf0f1;
            }
            .info-item:last-child { border-bottom: none; }
            .info-label { color: #7f8c8d; font-size: 13px; }
            .info-value { color: #2980b9; font-weight: 600; }
            
            /* Action info */
            .action-info { 
              background: #e8f8f5;
              border: 1px solid #a3e4d7;
              padding: 15px;
              border-radius: 4px;
              margin: 20px 0;
              text-align: center;
              color: #186a3b;
            }
            
            /* Notes */
            .notes { 
              font-size: 14px;
              color: #7f8c8d;
              margin-top: 25px;
              padding-top: 20px;
              border-top: 1px solid #ecf0f1;
            }
            .notes ul { margin-left: 20px; margin-top: 10px; }
            .notes li { margin: 5px 0; }
            
            /* Signature */
            .signature { 
              margin-top: 30px;
            }
            .signature .sign-name { 
              color: #2c3e50;
              font-weight: 600;
              font-size: 15px;
              margin-bottom: 5px;
            }
            .signature .sign-system { 
              color: #95a5a6;
              font-size: 13px;
            }
            
            /* Footer */
            .footer { 
              background: #2c3e50;
              color: #ecf0f1;
              text-align: center;
              padding: 25px 30px;
              font-size: 12px;
              border-top: 3px solid #27ae60;
            }
            .footer p { margin: 5px 0; }
            
            /* Responsive */
            @media (max-width: 600px) {
              .content { padding: 25px 20px; }
              .header { padding: 30px 20px; }
              .header h1 { font-size: 24px; }
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <!-- Header -->
            <div class="header">
              <h1>✅ Bağlantı Başarılı!</h1>
              <p>E-Defter Otomasyon Sistemi Test Maili</p>
            </div>
            
            <!-- Content -->
            <div class="content">
              <p class="greeting">👋 Merhaba,</p>
              
              <!-- Success Message -->
              <div class="success-message">
                <p><strong>✓ Harika!</strong> SMTP bağlantısı başarıyla sınanmıştır.</p>
                <p style="margin-top: 10px;">E-Defter Otomasyon Sisteminiz düzgün şekilde çalışıyor ve e-postalar gönderilmeye hazır!</p>
              </div>
              
              <!-- Connection Info -->
              <div class="info-section">
                <strong>🔐 Bağlantı Bilgileri:</strong>
                <div class="info-item">
                  <div class="info-label">📧 SMTP Sunucu:</div>
                  <div class="info-value">${host}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">🔌 Port Numarası:</div>
                  <div class="info-value">${port}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">👤 Kullanıcı Adı:</div>
                  <div class="info-value">${user}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">✉️ Gönderen Adı:</div>
                  <div class="info-value">${fromName}</div>
                </div>
              </div>
              
              <!-- Action Info -->
              <div class="action-info">
                <p>🚀 <strong>Sonraki Adım:</strong> Artık e-defter klasörlerini müşterilerinize gönderebilirsiniz!</p>
              </div>
              
              <!-- Notes -->
              <div class="notes">
                <p><strong>📌 Hatırlatmalar:</strong></p>
                <ul>
                  <li>Bu test maili gönderen adresine gönderilmiştir</li>
                  <li>Ayarlarınız başarıyla kaydedilmiştir</li>
                  <li>Sorun yaşarsanız ayarları kontrol edin</li>
                </ul>
              </div>
              
              <!-- Signature -->
              <div class="signature">
                <p class="sign-name">Başarılar Dileriz,</p>
                <p class="sign-system">E-Defter Otomasyon Sistemi</p>
              </div>
            </div>
            
            <!-- Footer -->
            <div class="footer">
              <p><strong>E-Defter Otomasyon Sistemi</strong></p>
              <p>Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayınız.</p>
              <p style="margin-top: 15px; border-top: 1px solid #34495e; padding-top: 15px;">
                &copy; 2025 E-Defter Otomasyon. Tüm hakları saklıdır.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: `${fromName} <${user}>`,
      to: user,  // Kendi e-postasına gönder
      subject: '✅ E-Defter Otomasyon - SMTP Bağlantı Testi Başarılı',
      html: testEmailHtml
    };

    const info = await transporter.sendMail(mailOptions);
    
    if (info) {
      logToFile('success', 'Email', `Test maili gönderildi: ${user} (MessageID: ${info.messageId})`);
      return { success: true, message: 'Test maili başarıyla gönderildi! (Gelen kutunuzu kontrol edin)' };
    } else {
      logToFile('error', 'Email', 'Test maili gönderilemedi');
      return { success: false, error: 'Test maili gönderilemedi' };
    }
  } catch (error) {
    logToFile('error', 'Email', 'Email bağlantı test hatası', error.message);
    return { success: false, error: error.message };
  }
});

// Manuel email gönderimi
ipcMain.handle('send-manual-email', async (event, emailData) => {
  try {
    logToFile('info', 'Email', `Manuel email gönderimi başlatılıyor: ${emailData.to}`);
    
    if (!emailData || !emailData.to || !emailData.subject) {
      return { success: false, error: 'E-mail, konu gerekli' };
    }

    // SMTP yapılandırmasını yükle
    const smtpConfig = store.get('emailSettings', {});
    
    if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
      return { success: false, error: 'Email yapılandırması tamamlanmamış' };
    }

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port || 587,
      secure: smtpConfig.secure || false,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass
      }
    });

    // Email gönder
    const mailOptions = {
      from: smtpConfig.user,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html || emailData.body || '',
      attachments: emailData.attachments || []
    };

    const info = await transporter.sendMail(mailOptions);
    
    // Gönderimi logla
    const sentEmails = store.get('sentEmails', []);
    sentEmails.push({
      to: emailData.to,
      subject: emailData.subject,
      sentAt: new Date().toISOString(),
      messageId: info.messageId
    });
    store.set('sentEmails', sentEmails);
    
    logToFile('success', 'Email', `Email başarıyla gönderildi: ${emailData.to} (ID: ${info.messageId})`);
    return { success: true, message: 'Email başarıyla gönderildi', messageId: info.messageId };
  } catch (error) {
    logToFile('error', 'Email', 'Manuel email gönderimi hatası', error.message);
    return { success: false, error: error.message };
  }
});



// Şirket ZIP oluştur
ipcMain.handle('create-company-zip', async (event, companyData, selectedMonths, customMessage) => {
  try {
    logToFile('info', 'ZIP', `Şirket ZIP oluşturuluyor: ${companyData?.name || 'Bilinmeyen'}`);
    
    if (!companyData || !companyData.name) {
      logToFile('error', 'ZIP', 'companyData eksik:', JSON.stringify(companyData));
      return { success: false, error: 'Şirket bilgisi eksik' };
    }

    // Eğer folderPath yoksa, monitoring-settings'ten sourcePath al
    let folderPath = companyData.folderPath;
    let hasFiles = false;
    
    if (!folderPath) {
      try {
        const monitoringSettings = store.get('monitoring-settings', {});
        const sourcePath = monitoringSettings.sourcePath;
        
        if (sourcePath && fs.existsSync(sourcePath)) {
          // ✅ DÜZELTME: Tarama ile aynı priorityOrder mantığını kullan
          const priorityOrder = [];
          
          // TC varsa en başa ekle (öncelikli)
          if (companyData.tcNumber) {
            priorityOrder.push(String(companyData.tcNumber));
          }
          // Sonra vergi numarası
          if (companyData.taxNumber) {
            priorityOrder.push(String(companyData.taxNumber));
          }
          
          if (priorityOrder.length === 0) {
            logToFile('warn', 'ZIP', `Şirket ID bulunamadı: ${companyData.name}`);
            folderPath = null; // Boş ZIP oluştur
          } else {
            // İlk klasörü bulan ID'yi kullan (TC veya Vergi)
            let foundCompanyPath = null;
            
            for (const id of priorityOrder) {
              const companyPath = path.join(sourcePath, id);
              if (fs.existsSync(companyPath)) {
                foundCompanyPath = companyPath;
                logToFile('info', 'ZIP', `Şirket klasörü bulundu: ${id} (${id.length === 11 ? 'TC' : 'Vergi'}) -> ${companyPath}`);
                hasFiles = true;
                break;
              }
            }
            
            if (foundCompanyPath) {
              folderPath = foundCompanyPath;
            } else {
              // Alternatif: şirket adıyla da dene
              const companyNamePath = path.join(sourcePath, companyData.name);
              if (fs.existsSync(companyNamePath)) {
                folderPath = companyNamePath;
                logToFile('info', 'ZIP', `Şirket adıyla klasör bulundu: ${folderPath}`);
                hasFiles = true;
              } else {
                logToFile('warn', 'ZIP', `Klasör bulunamadı, boş ZIP oluşturuluyor: ${companyData.name} - Denenen: ${priorityOrder.join(', ')}`);
                folderPath = null; // Boş ZIP oluştur
              }
            }
          }
        } else {
          logToFile('warn', 'ZIP', `Monitoring settings bulunamadı veya sourcePath boş, boş ZIP oluşturuluyor`);
          folderPath = null; // Boş ZIP oluştur
        }
      } catch (err) {
        logToFile('warn', 'ZIP', 'Monitoring-settings yüklenirken hata, boş ZIP oluşturuluyor', err.message);
        folderPath = null; // Boş ZIP oluştur
      }
    } else {
      hasFiles = fs.existsSync(folderPath);
    }

    // ZIP dosya adı: ShirketAdi-Donem.zip format
    let periodString = '';
    if (selectedMonths && selectedMonths.length > 0) {
      // İlk ayı al örnek olarak
      const firstMonth = selectedMonths[0];
      const month = firstMonth.month || 1;
      const year = firstMonth.year || new Date().getFullYear();
      periodString = `-${year}${String(month).padStart(2, '0')}`;
    }
    
    // ✅ ZIP dosya adı: sadece şirket adı ve dönem (tam path değil!)
    const zipFileName = `${(companyData.name || 'archive').replace(/[/\\:*?"<>|]/g, '_')}${periodString}.zip`;
    const zipPath = path.join(app.getPath('temp'), zipFileName);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);

    // Eğer klasör yoksa veya boşsa, yine de README ekle
    if (!hasFiles) {
      logToFile('warn', 'ZIP', `Klasör yok/boş, sadece README ile ZIP oluşturuluyor: ${companyData.name}`);
      if (customMessage) {
        archive.append(customMessage, { name: 'README.txt' });
      } else {
        archive.append(`${companyData.name} dönemine ait dosya bulunamadı.`, { name: 'NOT.txt' });
      }
      await archive.finalize();
      
      await new Promise((resolve, reject) => {
        output.on('close', resolve);
        output.on('error', reject);
      });
      
      logToFile('info', 'ZIP', `Boş ZIP oluşturuldu: ${zipFileName}`);
      return { success: true, zipPath: zipPath, zipFileName: zipFileName, isEmpty: true };
    }

    // ✅ Seçili ayları ZIP'e ekle - edefter klasörü içine koy
    let filesAdded = 0;
    if (selectedMonths && selectedMonths.length > 0) {
      for (const month of selectedMonths) {
        let monthPath = null;
        
        const monthNum = (typeof month === 'object' && month.month) ? month.month : null;
        const year = (typeof month === 'object' && month.year) ? month.year : null;
        
        if (monthNum && year) {
          try {
            const yearFolders = fs.readdirSync(folderPath).filter(f => {
              const fullPath = path.join(folderPath, f);
              try {
                return fs.statSync(fullPath).isDirectory();
              } catch {
                return false;
              }
            });
            
            // Eşleşen yıl klasörünü bul - DOĞRU REGEX: 01.01.2025-31.12.2025 formatı
            for (const yearFolder of yearFolders) {
              const yearMatch = yearFolder.match(/^\d{2}\.\d{2}\.(\d{4})-\d{2}\.\d{2}\.(\d{4})$/);
              if (yearMatch) {
                const startYear = parseInt(yearMatch[1]);
                const endYear = parseInt(yearMatch[2]);
                
                if (year >= startYear && year <= endYear) {
                  const monthPath_check = path.join(folderPath, yearFolder, String(monthNum).padStart(2, '0'));
                  if (fs.existsSync(monthPath_check)) {
                    monthPath = monthPath_check;
                    logToFile('info', 'ZIP', `Yıl klasörü bulundu: ${yearFolder}, ay klasörü: ${monthNum}`);
                    break;
                  }
                }
              }
            }
          } catch (err) {
            logToFile('warn', 'ZIP', `Ay klasörü araması hatası: ${err.message}`);
          }
        }
        
        if (monthPath && fs.existsSync(monthPath)) {
          // ✅ DÜZELTME: Ay klasörü içeriğini kontrol et ve detaylı log
          const monthFiles = fs.readdirSync(monthPath);
          logToFile('info', 'ZIP', `Ay klasörü bulundu: ${monthPath}, içerik: ${monthFiles.length} dosya/klasör`);
          
          if (monthFiles.length === 0) {
            logToFile('warn', 'ZIP', `Ay klasörü boş: ${monthPath}`);
          } else {
            // Klasör içeriğini logla
            logToFile('info', 'ZIP', `Ay klasörü içeriği: ${monthFiles.slice(0, 10).join(', ')}${monthFiles.length > 10 ? '...' : ''}`);
          }
          
          // ✅ DÜZELTME: edefter/ klasörü içine ay klasörünü koy
          const monthName = path.basename(monthPath); // Örn: "01"
          const targetPath = `edefter/${monthName}`;
          
          // Archive.directory ile tüm alt klasörleri dahil et
          archive.directory(monthPath, targetPath);
          filesAdded++;
          logToFile('success', 'ZIP', `Klasör eklendi: ${monthPath} -> ZIP'de ${targetPath} (${monthFiles.length} dosya)`);
        } else {
          // Ay klasörü bulunamadı - alternatif yolları dene
          logToFile('warn', 'ZIP', `Ay klasörü bulunamadı: ${monthNum}/${year}, folderPath: ${folderPath}`);
          
          // Alternatif: Direkt ay adıyla klasör ara
          const directMonthPath = path.join(folderPath, String(monthNum).padStart(2, '0'));
          if (fs.existsSync(directMonthPath)) {
            const monthFiles = fs.readdirSync(directMonthPath);
            logToFile('info', 'ZIP', `Alternatif ay klasörü bulundu: ${directMonthPath}, ${monthFiles.length} dosya`);
            
            const targetPath = `edefter/${String(monthNum).padStart(2, '0')}`;
            archive.directory(directMonthPath, targetPath);
            filesAdded++;
            logToFile('success', 'ZIP', `Alternatif klasör eklendi: ${directMonthPath} -> ${targetPath}`);
          } else {
            logToFile('error', 'ZIP', `Hiçbir ay klasörü bulunamadı: ${monthNum}/${year} (${folderPath})`);
          }
        }
      }
    }

    // README dosyası her zaman ekle (ZIP'in root'unda)
    if (customMessage) {
      archive.append(customMessage, { name: 'README.txt' });
      logToFile('info', 'ZIP', `README.txt eklendi`);
    }

    if (filesAdded === 0) {
      logToFile('warn', 'ZIP', `Hiç dosya eklenmedi, boş ZIP: ${companyData.name}`);
    } else {
      logToFile('success', 'ZIP', `${filesAdded} ay klasörü eklendi: ${companyData.name}`);
    }

    await archive.finalize();

    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
    });

    logToFile('success', 'ZIP', `Şirket ZIP başarıyla oluşturuldu: ${zipFileName} (${filesAdded} ay)`);
    // ✅ zipFileName da return et (sadece dosya adı, tam path değil)
    return { success: true, zipPath: zipPath, zipFileName: zipFileName };
  } catch (error) {
    logToFile('error', 'ZIP', 'Şirket ZIP oluşturma hatası', error.message);
    return { success: false, error: error.message };
  }
});

// Email şablonu oluştur
ipcMain.handle('create-email-template', async (event, selectedPeriods, companyName) => {
  try {
    const htmlTemplate = createProfessionalEmailTemplate(selectedPeriods, companyName);
    logToFile('success', 'Email', 'Profesyonel email şablonu oluşturuldu');
    return { success: true, htmlTemplate: htmlTemplate };
  } catch (error) {
    logToFile('error', 'Email', 'Email şablonu oluşturma hatası', error.message);
    return { success: false, error: error.message };
  }
});

// Email gönder
ipcMain.handle('send-email', async (event, emailConfig, recipients, subject, attachments, customMessage, selectedMonths) => {
  try {
    logToFile('info', 'Email', `Email gönderimi başlatılıyor: ${recipients.length} alıcı`);
    logToFile('info', 'Email', `Email config anahtarları: ${Object.keys(emailConfig || {}).join(', ')}`);
    
    if (!nodemailer) {
      return { success: false, error: 'Nodemailer modülü yüklenemedi' };
    }
    
    if (!emailConfig || !recipients || recipients.length === 0) {
      logToFile('error', 'Email', 'Email config veya alıcıları eksik', JSON.stringify({hasConfig: !!emailConfig, recipientCount: recipients?.length}));
      return { success: false, error: 'Email konfigürasyonu veya alıcıları eksik' };
    }

    // Frontend'den gelen property isimleri: smtpServer, port, username, password, fromEmail, fromName
    const host = emailConfig.smtpServer || emailConfig.host;
    const port = emailConfig.port || 587;
    const user = emailConfig.username || emailConfig.fromEmail || emailConfig.user;
    const pass = emailConfig.password || emailConfig.pass;
    const fromEmail = emailConfig.fromEmail || user;
    const fromName = emailConfig.fromName || 'E-Defter Otomasyon';

    logToFile('info', 'Email', `SMTP config: host=${host?.slice(0, 20)}..., port=${port}, user=${user?.slice(0, 10)}..., pass=${pass ? 'YET' : 'YOK'}`);

    if (!host || !user || !pass) {
      logToFile('error', 'Email', 'Email yapılandırması eksik', {host: !!host, user: !!user, pass: !!pass});
      return { success: false, error: 'Email yapılandırması eksik: host, user veya pass gerekli' };
    }

    let transporter;
    try {
      transporter = nodemailer.createTransport({
        host: host,
        port: port,
        secure: port === 465,
        auth: {
          user: user,
          pass: pass
        }
      });
      logToFile('info', 'Email', 'Transporter başarıyla oluşturuldu');
    } catch (err) {
      logToFile('error', 'Email', 'Transporter oluşturulamadı', err.message);
      return { success: false, error: `Transporter hatası: ${err.message}` };
    }

    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    const sentEmailDetails = []; // Email raporlaması için detaylar

    for (const recipient of recipients) {
      try {
        // Attachments'i düzelt - string yollara dönüştür
        let processedAttachments = [];
        let attachmentNames = []; // Dosya adlarını kaydet
        if (attachments && Array.isArray(attachments)) {
          processedAttachments = attachments.map(att => {
            // Eğer string ise (dosya yolu), obje'ye dönüştür
            if (typeof att === 'string') {
              // Dosya adını çıkar (path'ten)
              const filename = path.basename(att);
              attachmentNames.push(filename);
              return { path: att };
            }
            // Zaten obje ise olduğu gibi döndür
            return att;
          });
        }

        const mailOptions = {
          from: `${fromName} <${fromEmail || user}>`,
          to: recipient,
          subject: subject,
          html: customMessage || '<p>E-Defter dosyaları ektedir.</p>',
          attachments: processedAttachments
        };

        logToFile('info', 'Email', `Mail seçenekleri hazırlandı: ${recipient}, ${processedAttachments.length} ek`);

        const info = await transporter.sendMail(mailOptions);
        
        logToFile('success', 'Email', `Mail gönderimi başarılı: ${recipient}, MessageID: ${info.messageId}`);
        
        // Email aktivitesini detaylı kaydet (raporlama için)
        const emailActivity = {
          timestamp: new Date().toISOString(),
          to: recipient,
          subject: subject,
          level: 'success',
          status: 'Başarılı',
          attachments: attachmentNames.join(', '),
          messageId: info.messageId
        };
        
        sentEmailDetails.push(emailActivity);
        
        // Gönderimi logla (atomic işlem - fresh data al)
        const freshSentEmails = store.get('sentEmails', []);
        freshSentEmails.push({
          to: recipient,
          subject: subject,
          sentAt: new Date().toISOString(),
          messageId: info.messageId,
          attachments: attachmentNames,
          status: 'success'
        });
        store.set('sentEmails', freshSentEmails);
        
        // Log dosyasına da kaydet
        logToFile('success', 'Email', `Email gönderildi: ${recipient} | Konusu: ${subject} | Ekler: ${attachmentNames.join(', ') || 'Yok'}`);
        
        successCount++;
      } catch (err) {
        // Başarısız email aktivitesini kaydet
        const failedActivity = {
          timestamp: new Date().toISOString(),
          to: recipient,
          subject: subject,
          level: 'error',
          status: 'Başarısız',
          error: err.message
        };
        
        sentEmailDetails.push(failedActivity);
        
        errorCount++;
        errors.push(`${recipient}: ${err.message}`);
        logToFile('error', 'Email', `Email gönderilemedi: ${recipient} | Konusu: ${subject} | Hata: ${err.message}`, err);
      }
    }

    logToFile('info', 'Email', `Email gönderimi tamamlandı: ${successCount} başarılı, ${errorCount} hata`);
    
    return { 
      success: errorCount === 0, 
      successCount: successCount,
      errorCount: errorCount,
      errors: errors,
      sentEmailDetails: sentEmailDetails // Raporlama için döndür
    };
  } catch (error) {
    logToFile('error', 'Email', 'Email gönderimi hatası', error.message);
    return { success: false, error: error.message };
  }
});

// ========== APP EVENT HANDLERS ==========

// App başlatıldığında pencereyi oluştur
app.whenReady().then(() => {
  createWindow();
  logToFile('info', 'Sistem', 'App başlatıldı ve pencere açıldı');
}).catch(err => {
  logToFile('error', 'Sistem', 'App başlatma hatası', err.message);
  console.error('App başlatma hatası:', err);
});

// macOS için: tüm pencereler kapatıldığında app'i kapatma
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// macOS için: app yeniden aktif edildiğinde pencereyi aç
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// App çıkışı
app.on('before-quit', () => {
  logToFile('info', 'Sistem', 'Uygulama kapatılıyor');
  
  // ✅ Tüm interval ve timeout'ları temizle
  if (triggerScanTimeout) {
    clearTimeout(triggerScanTimeout);
    triggerScanTimeout = null;
  }
  if (folderWatcher) {
    folderWatcher.close();
    folderWatcher = null;
  }
  if (backgroundInterval) {
    clearInterval(backgroundInterval);
    backgroundInterval = null;
  }
});

// Log kaydını dosyaya kaydet
ipcMain.handle('save-log-entry', async (event, logEntry) => {
  try {
    if (!logEntry || !logEntry.level || !logEntry.category) {
      return { success: false, error: 'Log verisi eksik' };
    }

    // Backend'de logToFile fonksiyonunu kullan
    logToFile(logEntry.level, logEntry.category, logEntry.message, logEntry.details);
    
    return { success: true, message: 'Log kaydedildi' };
  } catch (error) {
    console.error('Log kaydı hatası:', error);
    return { success: false, error: error.message };
  }
});

// ✅ YENİ: Yedekleme Aktivitelerini Getir (Manuel + Otomasyon)
ipcMain.handle('get-backup-activities', async (event) => {
  try {
    const logDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logDir)) {
      return { success: true, data: [] };
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activities = [];
    const files = fs.readdirSync(logDir).sort().reverse(); // Newest first

    for (const file of files) {
      if (!file.startsWith('edefter-log-') || !file.endsWith('.txt')) continue;

      const filePath = path.join(logDir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.mtime < sevenDaysAgo) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      for (const line of lines) {
        // Line format: "DATE TIME - [LEVEL] CATEGORY: MESSAGE - DETAILS"
        // Example: "2025-12-18 15:45:30 - [SUCCESS] Yedekleme: Yedekleme tamamlandı. 5 yeni dosya kopyalandı - 123MB"
        const match = line.match(/^(.*?)\s*-\s*\[(.*?)\]\s*(.*?):\s*(.*?)(?:\s*-\s*(.*))?$/);
        
        if (!match) continue;

        const [, dateTime, level, category, message, details] = match;

        // Sadece "Yedekleme" kategorisine ait girişleri göster
        const categoryLower = (category || '').toLowerCase();
        if (!categoryLower.includes('yedekle')) {
          continue;
        }

        activities.push({
          id: `${file}-${activities.length}`,
          dateStr: dateTime.trim(),
          level: level.trim().toLowerCase(),
          category: category.trim(),
          message: message.trim(),
          details: details ? details.trim() : ''
        });
      }
    }
    
    // Tarih sırasına göre ters sırala (en yeni en başta)
    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const limitedActivities = activities.slice(0, 200);
    logToFile('success', 'Rapor', `Sistem aktiviteleri raporu oluşturuldu: ${limitedActivities.length} kayıt`);
    
    return { success: true, data: limitedActivities };
  } catch (error) {
    logToFile('error', 'Rapor', 'Sistem aktiviteleri raporu hatası', error.message);
    return { success: false, error: error.message };
  }
});

// ✅ YENİ: Email Aktivitelerini Getir - IMPROVED ERROR REPORTING
ipcMain.handle('get-email-activities', async (event) => {
  try {
    const logDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logDir)) {
      return { success: true, data: [] };
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activities = [];

    // Log dosyalarını oku
    const logFiles = fs.readdirSync(logDir)
      .filter(f => f.startsWith('edefter-log-') && f.endsWith('.txt'))
      .sort((a, b) => b.localeCompare(a)); // En yeni dosya önce

    for (const file of logFiles) {
      try {
        const filePath = path.join(logDir, file);
        const fileTime = fs.statSync(filePath).mtime;

        // Son 7 gün içindeki dosyaları kontrol et
        if (fileTime >= sevenDaysAgo) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n').filter(line => line.trim());

          for (const line of lines) {
            // E-posta ile ilgili logları bul
            if (line.includes('E-posta:') || line.includes('[E-posta]')) {
              try {
                // Log formatı: "DD.MM.YYYY HH:mm:ss - [LEVEL] E-posta: message"
                const dateMatch = line.match(/^(\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2})/);
                const levelMatch = line.match(/\[(SUCCESS|ERROR|INFO|WARN)\]/i);
                const messageMatch = line.match(/E-posta:\s*(.+)$/);

                if (dateMatch && messageMatch) {
                  const timestamp = dateMatch[1];
                  const level = levelMatch ? levelMatch[1].toLowerCase() : 'info';
                  const message = messageMatch[1];

                  // Tarih parse et
                  const [datePart, timePart] = timestamp.split(' ');
                  const [day, month, year] = datePart.split('.');
                  const [hour, minute, second] = timePart.split(':');
                  const parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));

                  const isToday = new Date().toDateString() === parsedDate.toDateString();

                  // Email detaylarını çıkar
                  let operation = 'Bilinmeyen işlem';
                  let details = message;
                  let status = 'Bilgi';
                  
                  if (message.includes('Email gönderildi:')) {
                    operation = 'Email Gönderildi';
                    status = 'Başarılı';
                    details = message.replace('Email gönderildi:', '').trim();
                  } else if (message.includes('Email gönderilemedi:')) {
                    operation = 'Email Gönderim Hatası';
                    status = 'Başarısız';
                    details = message.replace('Email gönderilemedi:', '').trim();
                  } else if (message.includes('ZIP oluşturuldu:')) {
                    operation = 'ZIP Oluşturuldu';
                    status = 'Başarılı';
                    details = message.replace('ZIP oluşturuldu:', '').trim();
                  } else if (message.includes('ZIP oluşturulamadı:')) {
                    operation = 'ZIP Oluşturma Hatası';
                    status = 'Başarısız';
                    details = message.replace('ZIP oluşturulamadı:', '').trim();
                  } else if (message.includes('Otomatik email tamamlandı:')) {
                    operation = 'Otomatik Email Tamamlandı';
                    status = message.includes('başarılı, 0 başarısız') ? 'Başarılı' : 'Kısmi Başarısız';
                    details = message.replace('Otomatik email tamamlandı:', '').trim();
                  } else if (message.includes('email gönderme hatası:')) {
                    operation = 'Email Gönderim Hatası';
                    status = 'Başarısız';
                    details = message;
                  } else if (level === 'success') {
                    status = 'Başarılı';
                    operation = 'Email İşlemi';
                  } else if (level === 'error') {
                    status = 'Başarısız';
                    operation = 'Email Hatası';
                  } else if (level === 'info') {
                    status = 'Bilgi';
                    operation = 'Email Bilgisi';
                  }

                  // Activity objesini oluştur
                  activities.push({
                    timestamp: parsedDate.toISOString(),
                    date: parsedDate.toLocaleDateString('tr-TR'),
                    time: parsedDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
                    operation: operation,
                    status: status,
                    details: details,
                    level: level,
                    message: message,
                    isToday: isToday,
                    rawLine: line // Debug için
                  });
                }
              } catch (parseErr) {
                // Log satırı parse hatasını atla ama kaydet
                logToFile('warn', 'Email', `Email log parse hatası: ${parseErr.message}`, line);
              }
            }
          }
        }
      } catch (fileErr) {
        logToFile('warn', 'Email', `Email aktiviteleri dosyası okunurken hata: ${file}`, fileErr.message);
      }
    }

    // Tarih sırasına göre ters sırala (en yeni en başta)
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Debug için ilk birkaç activity'yi logla
    if (activities.length > 0) {
      logToFile('info', 'Email', `Email aktiviteleri yüklendi: ${activities.length} kayıt bulundu`);
    } else {
      logToFile('warn', 'Email', 'Hiç email aktivitesi bulunamadı - log dosyaları kontrol edilsin');
    }

    return { success: true, data: activities };
  } catch (error) {
    logToFile('error', 'Email', 'Email aktiviteleri alınırken hata', error.message);
    return { success: false, error: error.message, data: [] };
  }
});

// Geçici dosyaları temizle
ipcMain.handle('cleanup-temp-files', async (event, filePaths) => {
  try {
    if (!filePaths || !Array.isArray(filePaths)) {
      return { success: false, error: 'Dosya yolları dizisi gerekli' };
    }

    let deletedCount = 0;
    const errors = [];

    for (const filePath of filePaths) {
      try {
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          deletedCount++;
          logToFile('info', 'Temizlik', `Geçici dosya silindi: ${path.basename(filePath)}`);
        } else if (filePath) {
          logToFile('warn', 'Temizlik', `Silinecek dosya bulunamadı: ${filePath}`);
        }
      } catch (err) {
        errors.push(`${filePath}: ${err.message}`);
        logToFile('warn', 'Temizlik', `Dosya silme hatası: ${filePath}`, err.message);
      }
    }

    logToFile('info', 'Temizlik', `${deletedCount}/${filePaths.length} geçici dosya silindi`);
    
    return { 
      success: deletedCount === filePaths.length, 
      deletedCount: deletedCount,
      totalFiles: filePaths.length,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    logToFile('error', 'Temizlik', 'Geçici dosya temizleme hatası', error.message);
    return { success: false, error: error.message };
  }
});
