const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Klasör ve dosya işlemleri
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  checkPathExists: (path) => ipcRenderer.invoke('check-path-exists', path),
  selectExcelFile: () => ipcRenderer.invoke('select-excel-file'),
  selectSaveLocation: (defaultFileName) => ipcRenderer.invoke('select-save-location', defaultFileName),
  scanFolderStructure: (sourcePath, selectedYear) => ipcRenderer.invoke('scan-folder-structure', sourcePath, selectedYear),
  
  // Yedekleme işlemleri
  backupFiles: (sourcePath, destinationPath, isAutomated) => ipcRenderer.invoke('backup-files', sourcePath, destinationPath, isAutomated),
  createZip: (folderPath, outputPath) => ipcRenderer.invoke('create-zip', folderPath, outputPath),
  
  // E-posta işlemleri - DÜZELTİLDİ
  sendEmail: (emailConfig, recipients, subject, attachments, customMessage, selectedMonths) =>
    ipcRenderer.invoke('send-email', emailConfig, recipients, subject, attachments, customMessage, selectedMonths),
  createEmailTemplate: (selectedPeriods, companyName) =>
    ipcRenderer.invoke('create-email-template', selectedPeriods, companyName),
  
  // ZIP oluşturma ve temizleme
  createCompanyZip: (companyData, selectedMonths, customMessage) =>
    ipcRenderer.invoke('create-company-zip', companyData, selectedMonths, customMessage),
  cleanupTempFiles: (filePaths) =>
    ipcRenderer.invoke('cleanup-temp-files', filePaths),
  
  // Klasör izleme
  startFolderMonitoring: (sourcePath, interval) => 
    ipcRenderer.invoke('start-folder-monitoring', sourcePath, interval),
  stopFolderMonitoring: () => ipcRenderer.invoke('stop-folder-monitoring'),
  
  // Arka plan servisi
  startBackgroundService: () => ipcRenderer.invoke('start-background-service'),
  stopBackgroundService: () => ipcRenderer.invoke('stop-background-service'),
  getBackgroundServiceStatus: () => ipcRenderer.invoke('get-background-service-status'),
  
  // Veri saklama
  saveData: (key, data) => ipcRenderer.invoke('save-data', key, data),
  loadData: (key, defaultValue) => ipcRenderer.invoke('load-data', key, defaultValue),
  
  // Rapor oluşturma
  generateReport: (data, filePath) => ipcRenderer.invoke('generate-report', data, filePath),
  generateDetailedGIBReport: (data, filePath, metadata) => ipcRenderer.invoke('generate-detailed-gib-report', data, filePath, metadata),
  
  // Excel şablon oluşturma
  createExcelTemplate: (data, options) => ipcRenderer.invoke('create-excel-template', data, options),
  
  // Event listeners
  onFolderAdded: (callback) => ipcRenderer.on('folder-added', callback),
  onFileAdded: (callback) => ipcRenderer.on('file-added', callback),
  onTriggerScan: (callback) => ipcRenderer.on('trigger-scan', callback),
  onScanStatusChange: (callback) => ipcRenderer.on('scan-status-change', callback),
  onAutoStartAutomation: (callback) => ipcRenderer.on('auto-start-automation', callback),
  onPerformAutomatedScan: (callback) => ipcRenderer.on('perform-automated-scan', callback),
  onAutomationStateChanged: (callback) => ipcRenderer.on('automation-state-changed', callback),
  onPeriodMarkedCompleted: (callback) => ipcRenderer.on('period-marked-completed', callback),
  
  // Otomasyon Engine
  startAutomationEngine: (sourcePath) => ipcRenderer.invoke('start-automation-engine', sourcePath),
  stopAutomationEngine: () => ipcRenderer.invoke('stop-automation-engine'),
  onGIBFileProcessed: (callback) => ipcRenderer.on('gib-file-processed', callback),
  
  // Event listener temizleme
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // Platform kontrolü
  isElectron: () => true,
  
  // Log sistemi
  saveLogEntry: (logData) => ipcRenderer.invoke('save-log-entry', logData),
  getLogHistory: () => ipcRenderer.invoke('get-log-history'),
  
  // Sistem aktiviteleri
  getSystemActivities: (startDate, endDate, category) => 
    ipcRenderer.invoke('get-system-activities', startDate, endDate, category),
  generateActivitiesReport: (activities, filters) => 
    ipcRenderer.invoke('generate-activities-report', activities, filters),
  getBackupActivities: () => ipcRenderer.invoke('get-backup-activities'),
  getEmailActivities: () => ipcRenderer.invoke('get-email-activities'),
  
  // ✅ YENİ: E-posta bağlantı testi
  testEmailConnection: (emailConfig) => ipcRenderer.invoke('test-email-connection', emailConfig),
  
  // ✅ Test Email Notification - Email bildirimleri sistemini test et
  sendTestEmailNotification: (accountantEmail) => ipcRenderer.invoke('send-test-email-notification', accountantEmail),
  
  // ✅ Trial Status - Demo süresi bilgisi
  checkTrialStatus: () => ipcRenderer.invoke('check-trial-status')
});