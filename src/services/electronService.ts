// Güvenli hata mesajı çıkarma fonksiyonu
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Bilinmeyen bir hata oluştu';
}

declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<string | null>;
      checkPathExists: (path: string) => Promise<boolean>;
      selectExcelFile: () => Promise<{success: boolean, data?: any[], error?: string, filePath?: string}>;
      selectSaveLocation: (defaultFileName: string) => Promise<{success: boolean, filePath?: string, error?: string}>;
      scanFolderStructure: (sourcePath: string, selectedYear?: string) => Promise<{success: boolean, data?: any[], error?: string}>;
      backupFiles: (sourcePath: string, destinationPath: string, isAutomated?: boolean) => Promise<{success: boolean, message?: string, error?: string, stats?: {copiedFiles: number, skippedFiles: number, totalFiles: number, totalSize: string}}>;
      createZip: (folderPath: string, outputPath: string) => Promise<{success: boolean, size?: number, error?: string}>;
      sendEmail: (emailConfig: any, recipients: any[], subject: string, attachments: string[], customMessage: string, selectedMonths: any[]) => Promise<{success: boolean, results?: any[], error?: string}>;
      createCompanyZip: (companyData: any, selectedMonths: any[], customMessage: string) => Promise<{success: boolean, zipPath?: string, fileName?: string, error?: string}>;
      createEmailTemplate: (selectedPeriods: any[], companyName?: string) => Promise<{success: boolean, htmlTemplate?: string, error?: string}>;
      cleanupTempFiles: (filePaths: string[]) => Promise<{success: boolean, error?: string}>;
      startFolderMonitoring: (sourcePath: string, interval: number) => Promise<{success: boolean, message?: string, error?: string}>;
      stopFolderMonitoring: () => Promise<{success: boolean, message?: string, error?: string}>;
      startBackgroundService: () => Promise<{success: boolean, message?: string, error?: string}>;
      stopBackgroundService: () => Promise<{success: boolean, message?: string, error?: string}>;
      getBackgroundServiceStatus: () => Promise<{success: boolean, isRunning?: boolean, lastCheck?: Date, error?: string}>;
      saveData: (key: string, data: any) => Promise<{success: boolean, error?: string}>;
      loadData: (key: string, defaultValue?: any) => Promise<{success: boolean, data?: any, error?: string}>;
      generateReport: (data: any[], filePath: string) => Promise<{success: boolean, filePath?: string, error?: string}>;
      generateDetailedGIBReport: (data: any[], filePath: string, metadata: any) => Promise<{success: boolean, filePath?: string, error?: string}>;
      createExcelTemplate: (data: any[][], options?: any) => Promise<{success: boolean, filePath?: string, error?: string}>;
      onFolderAdded: (callback: (event: any, path: string) => void) => void;
      onFileAdded: (callback: (event: any, path: string) => void) => void;
      onTriggerScan: (callback: (event: any) => void) => void;
      onScanStatusChange: (callback: (event: any, data: { scanning: boolean; message: string }) => void) => void;
      onAutoStartAutomation: (callback: (event: any) => void) => void;
      onPerformAutomatedScan: (callback: (event: any) => void) => void;
      onAutomationStateChanged?: (callback: (event: any, settings: any) => void) => void;
      startAutomationEngine: (sourcePath: string) => Promise<{success: boolean, message?: string, error?: string}>;
      stopAutomationEngine: () => Promise<{success: boolean, message?: string, error?: string}>;
      removeAllListeners: (channel: string) => void;
      isElectron: () => boolean;
      saveLogEntry: (logData: any) => Promise<{success: boolean, error?: string}>;
      getLogHistory: () => Promise<{success: boolean, logs?: string[], error?: string}>;
      getSystemActivities: (startDate?: string, endDate?: string, category?: string) => Promise<{success: boolean, data?: any[], error?: string}>;
      generateActivitiesReport: (activities: any[], filters: any) => Promise<{success: boolean, filePath?: string, error?: string}>;
      getBackupActivities: () => Promise<{success: boolean, data?: any[], error?: string}>;
      getEmailActivities: () => Promise<{success: boolean, data?: any[], error?: string}>;
      getSentEmails: () => Promise<{success: boolean, data?: any[], error?: string}>;
      runPowerShellScript: (scriptPath: string, args?: string[]) => Promise<{success: boolean, data?: any, error?: string}>;
      testEmailConnection: (emailConfig: any) => Promise<{success: boolean, message: string}>;
      sendTestEmailNotification: (accountantEmail: string) => Promise<{success: boolean, error?: string}>;
      checkTrialStatus: () => Promise<{success: boolean, trialInfo?: {isDemo: boolean, daysLeft: number, expiryDate: string, isExpired: boolean}, error?: string}>;
      checkLicenseStatus: () => Promise<{success: boolean, valid?: boolean, reason?: string, hardwareId?: string, licensePath?: string, license?: any, error?: string}>;
      getLicenseHardwareId: () => Promise<{success: boolean, hardwareId?: string, error?: string}>;
      triggerEmailCheck: () => Promise<{success: boolean, message?: string, error?: string}>;
    };
  }
}

export class ElectronService {
  static isElectron(): boolean {
    return typeof window !== 'undefined' && 
           window.electronAPI !== undefined && 
           typeof window.electronAPI.isElectron === 'function' && 
           window.electronAPI.isElectron();
  }

  static async selectFolder(): Promise<string | null> {
    if (!this.isElectron()) {
      throw new Error('Bu özellik sadece Electron uygulamasında çalışır');
    }
    try {
      return await window.electronAPI.selectFolder();
    } catch (error: unknown) {
      console.error('Klasör seçimi hatası:', error);
      throw error;
    }
  }

  static async selectExcelFile(): Promise<{success: boolean, data?: any[], error?: string, filePath?: string}> {
    if (!this.isElectron()) {
      throw new Error('Excel dosyası seçme sadece Electron uygulamasında çalışır');
    }
    try {
      return await window.electronAPI.selectExcelFile();
    } catch (error: unknown) {
      console.error('Excel dosyası seçimi hatası:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async scanFolderStructure(sourcePath: string, selectedYear?: string): Promise<{success: boolean, data?: any[], error?: string}> {
    if (!this.isElectron()) {
      throw new Error('GIB klasör taraması sadece Electron uygulamasında çalışır');
    }
    try {
      return await window.electronAPI.scanFolderStructure(sourcePath, selectedYear);
    } catch (error: unknown) {
      console.error('Klasör yapısı tarama hatası:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async startFolderMonitoring(sourcePath: string, interval: number): Promise<{success: boolean, message?: string, error?: string}> {
    if (!this.isElectron()) {
      throw new Error('Klasör izleme sadece Electron uygulamasında çalışır');
    }
    try {
      return await window.electronAPI.startFolderMonitoring(sourcePath, interval);
    } catch (error: unknown) {
      console.error('Klasör izleme başlatma hatası:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async stopFolderMonitoring(): Promise<{success: boolean, message?: string, error?: string}> {
    if (!this.isElectron()) {
      throw new Error('Klasör izleme durdurma sadece Electron uygulamasında çalışır');
    }
    try {
      return await window.electronAPI.stopFolderMonitoring();
    } catch (error: unknown) {
      console.error('Klasör izleme durdurma hatası:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async saveData(key: string, data: any): Promise<{success: boolean, error?: string}> {
    if (!this.isElectron()) {
      throw new Error('Veri kaydetme sadece Electron uygulamasında çalışır');
    }
    try {
      return await window.electronAPI.saveData(key, data);
    } catch (error: unknown) {
      console.error('Veri kaydetme hatası:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async loadData(key: string, defaultValue?: any): Promise<{success: boolean, data?: any, error?: string}> {
    if (!this.isElectron()) {
      throw new Error('Veri yükleme sadece Electron uygulamasında çalışır');
    }
    try {
      return await window.electronAPI.loadData(key, defaultValue);
    } catch (error: unknown) {
      console.error('Veri yükleme hatası:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static removeAllListeners(channel: string): void {
    if (!this.isElectron()) {
      console.warn('Dinleyici kaldırma sadece Electron uygulamasında çalışır');
      return;
    }
    try {
      window.electronAPI.removeAllListeners(channel);
    } catch (error: unknown) {
      console.error('Dinleyici kaldırma hatası:', error);
    }
  }

  static onFolderAdded(callback: (event: any, path: string) => void): void {
    if (!this.isElectron()) {
      console.warn('Klasör izleme sadece Electron uygulamasında çalışır');
      return;
    }
    try {
      window.electronAPI.onFolderAdded(callback);
    } catch (error: unknown) {
      console.error('Klasör ekleme dinleyicisi kurma hatası:', error);
    }
  }

  static onFileAdded(callback: (event: any, path: string) => void): void {
    if (!this.isElectron()) {
      console.warn('Dosya izleme sadece Electron uygulamasında çalışır');
      return;
    }
    try {
      window.electronAPI.onFileAdded(callback);
    } catch (error: unknown) {
      console.error('Dosya ekleme dinleyicisi kurma hatası:', error);
    }
  }

  static onTriggerScan(callback: (event: any) => void): void {
    if (!this.isElectron()) {
      console.warn('Tarama tetikleme sadece Electron uygulamasında çalışır');
      return;
    }
    try {
      window.electronAPI.onTriggerScan(callback);
    } catch (error: unknown) {
      console.error('Tarama tetikleme dinleyicisi kurma hatası:', error);
    }
  }

  static onScanStatusChange(callback: (event: any, data: { scanning: boolean; message: string }) => void): void {
    if (!this.isElectron()) {
      console.warn('Tarama durum değişikliği izleme sadece Electron uygulamasında çalışır');
      return;
    }
    try {
      window.electronAPI.onScanStatusChange(callback);
    } catch (error: unknown) {
      console.error('Tarama durum değişikliği dinleyicisi kurma hatası:', error);
    }
  }

  static async createExcelTemplate(data: any[][], options?: any): Promise<{success: boolean, filePath?: string, error?: string}> {
    if (!this.isElectron()) {
      throw new Error('Excel şablonu oluşturma sadece Electron uygulamasında çalışır');
    }
    try {
      return await window.electronAPI.createExcelTemplate(data, options);
    } catch (error: unknown) {
      console.error('Excel şablonu oluşturma hatası:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async generateDetailedGIBReport(data: any[], _filePath: string, _metadata: any): Promise<{success: boolean, filePath?: string, error?: string}> {
    if (!this.isElectron()) {
      throw new Error('GIB raporu oluşturma sadece Electron uygulamasında çalışır');
    }
    try {
      return await window.electronAPI.createExcelTemplate(data, { isTemplate: false, reportName: 'GIB_Dosyalari_Raporu' });
    } catch (error: unknown) {
      console.error('GIB raporu oluşturma hatası:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async generateActivitiesReport(activities: any[], _filters: any, reportType: string = 'Sistem_Aktiviteleri_Raporu'): Promise<{success: boolean, filePath?: string, error?: string}> {
    if (!this.isElectron()) {
      throw new Error('Aktivite raporu oluşturma sadece Electron uygulamasında çalışır');
    }
    try {
      const reportData = activities.map((activity: any) => [
        activity.category || 'N/A',
        activity.message || activity.operation || 'N/A',
        activity.details || '',
        activity.dateStr || activity.date || 'N/A',
        activity.level || activity.status || 'N/A'
      ]);
      return await window.electronAPI.createExcelTemplate(reportData, { isTemplate: false, reportName: reportType });
    } catch (error: unknown) {
      console.error('Aktivite raporu oluşturma hatası:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async getBackupActivities(): Promise<{success: boolean, data?: any[], error?: string}> {
    if (!this.isElectron()) {
      throw new Error('Yedekleme aktiviteleri sadece Electron uygulamasında çalışır');
    }
    try {
      return await window.electronAPI.getBackupActivities();
    } catch (error: unknown) {
      console.error('Yedekleme aktiviteleri hatası:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async getEmailActivities(): Promise<{success: boolean, data?: any[], error?: string}> {
    if (!this.isElectron()) {
      throw new Error('E-posta aktiviteleri sadece Electron uygulamasında çalışır');
    }
    try {
      return await window.electronAPI.getEmailActivities();
    } catch (error: unknown) {
      console.error('E-posta aktiviteleri hatası:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async getSentEmails(): Promise<{success: boolean, data?: any[], error?: string}> {
    if (!this.isElectron()) {
      throw new Error('SentEmails sadece Electron uygulamasında çalışır');
    }
    try {
      return await window.electronAPI.getSentEmails();
    } catch (error: unknown) {
      console.error('SentEmails hatası:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static onPerformAutomatedScan(callback: (event: any) => void): void {
    if (!this.isElectron()) {
      console.warn('Otomatik tarama dinleme sadece Electron uygulamasında çalışır');
      return;
    }
    try {
      window.electronAPI.onPerformAutomatedScan(callback);
    } catch (error: unknown) {
      console.error('Otomatik tarama dinleyicisi kurma hatası:', error);
    }
  }

  static onAutomationStateChanged(callback: (event: any, settings: any) => void): void {
    if (!this.isElectron()) {
      console.warn('Otomasyon durum değişikliği dinleme sadece Electron uygulamasında çalışır');
      return;
    }
    try {
      window.electronAPI.onAutomationStateChanged?.(callback);
    } catch (error: unknown) {
      console.error('Otomasyon durum değişikliği dinleyicisi kurma hatası:', error);
    }
  }

  static async checkPathExists(path: string): Promise<boolean> {
    if (!this.isElectron()) {
      throw new Error('Path kontrolü sadece Electron uygulamasında çalışır');
    }
    try {
      return await window.electronAPI.checkPathExists(path);
    } catch (error: unknown) {
      console.error('Path kontrol hatası:', error);
      return false;
    }
  }

  static async startBackgroundService(): Promise<{success: boolean, message?: string, error?: string}> {
    if (!this.isElectron()) {
      return { success: false, error: 'Arka plan servisi sadece Electron uygulamasında çalışır' };
    }
    try {
      return await window.electronAPI.startBackgroundService();
    } catch (error: unknown) {
      console.error('Arka plan servisi başlatma hatası:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async stopBackgroundService(): Promise<{success: boolean, message?: string, error?: string}> {
    if (!this.isElectron()) {
      return { success: false, error: 'Arka plan servisi durdurma sadece Electron uygulamasında çalışır' };
    }
    try {
      return await window.electronAPI.stopBackgroundService();
    } catch (error: unknown) {
      console.error('Arka plan servisi durdurma hatası:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async startAutomationEngine(sourcePath: string): Promise<{success: boolean, message?: string, error?: string}> {
    if (!this.isElectron()) {
      return { success: false, error: 'Otomasyon engine sadece Electron uygulamasında çalışır' };
    }
    try {
      return await window.electronAPI.startAutomationEngine(sourcePath);
    } catch (error: unknown) {
      console.error('Otomasyon engine başlatma hatası:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async stopAutomationEngine(): Promise<{success: boolean, message?: string, error?: string}> {
    if (!this.isElectron()) {
      return { success: false, error: 'Otomasyon engine durdurma sadece Electron uygulamasında çalışır' };
    }
    try {
      return await window.electronAPI.stopAutomationEngine();
    } catch (error: unknown) {
      console.error('Otomasyon engine durdurma hatası:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async runPowerShellScript(scriptPath: string, args?: string[]): Promise<{success: boolean, data?: any, error?: string}> {
    if (!this.isElectron()) {
      return { success: false, error: 'PowerShell scripti çalıştırma sadece Electron uygulamasında çalışır' };
    }
    try {
      return await window.electronAPI.runPowerShellScript(scriptPath, args);
    } catch (error: unknown) {
      console.error('PowerShell scripti çalıştırma hatası:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async backupFiles(sourcePath: string, destinationPath: string, isAutomated?: boolean): Promise<{success: boolean, message?: string, error?: string, stats?: {copiedFiles: number, skippedFiles: number, totalFiles: number, totalSize: string}}> {
    if (!this.isElectron()) {
      return { success: false, error: 'Dosya yedekleme sadece Electron uygulamasında çalışır' };
    }
    try {
      return await window.electronAPI.backupFiles(sourcePath, destinationPath, isAutomated);
    } catch (error: unknown) {
      console.error('Dosya yedekleme hatası:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async getSystemActivities(startDate?: string, endDate?: string, category?: string): Promise<{success: boolean, data?: any[], error?: string}> {
    if (!this.isElectron()) {
      return { success: false, error: 'Sistem aktiviteleri sadece Electron uygulamasında çalışır' };
    }
    try {
      return await window.electronAPI.getSystemActivities(startDate, endDate, category);
    } catch (error: unknown) {
      console.error('Sistem aktiviteleri yükleme hatası:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async testEmailConnection(emailConfig: any): Promise<{success: boolean, message: string}> {
    if (!this.isElectron()) {
      return { success: false, message: 'Email bağlantı testi sadece Electron uygulamasında çalışır' };
    }
    try {
      return await window.electronAPI.testEmailConnection(emailConfig);
    } catch (error: unknown) {
      console.error('Email bağlantı testi hatası:', error);
      return { success: false, message: getErrorMessage(error) };
    }
  }

  static async createEmailTemplate(selectedPeriods: any[], companyName?: string): Promise<{success: boolean, htmlTemplate?: string, error?: string}> {
    if (!this.isElectron()) {
      return { success: false, error: 'Email şablonu oluşturma sadece Electron uygulamasında çalışır' };
    }
    try {
      return await window.electronAPI.createEmailTemplate(selectedPeriods, companyName);
    } catch (error: unknown) {
      console.error('Email şablonu oluşturma hatası:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async createCompanyZip(companyData: any, selectedMonths: any[], customMessage: string): Promise<{success: boolean, zipPath?: string, fileName?: string, error?: string}> {
    if (!this.isElectron()) {
      return { success: false, error: 'ZIP oluşturma sadece Electron uygulamasında çalışır' };
    }
    try {
      return await window.electronAPI.createCompanyZip(companyData, selectedMonths, customMessage);
    } catch (error: unknown) {
      console.error('Şirket ZIP oluşturma hatası:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async sendEmail(emailConfig: any, recipients: string[], subject: string, attachments: string[], customMessage: string, selectedMonths: any[]): Promise<{success: boolean, results?: any[], error?: string}> {
    if (!this.isElectron()) {
      return { success: false, error: 'Email gönderimi sadece Electron uygulamasında çalışır' };
    }
    try {
      return await window.electronAPI.sendEmail(emailConfig, recipients, subject, attachments, customMessage, selectedMonths);
    } catch (error: unknown) {
      console.error('Email gönderimi hatası:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async sendTestEmailNotification(accountantEmail: string): Promise<{success: boolean, error?: string}> {
    if (!this.isElectron()) {
      return { success: false, error: 'Test email gönderimi sadece Electron uygulamasında çalışır' };
    }
    try {
      const result = await window.electronAPI.sendTestEmailNotification?.(accountantEmail);
      return result || { success: false, error: 'Test email fonksiyonu bulunmuyor' };
    } catch (error: unknown) {
      console.error('Test email gönderimi hatası:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async cleanupTempFiles(filePaths: string[]): Promise<{success: boolean, error?: string}> {
    if (!this.isElectron()) {
      return { success: false, error: 'Geçici dosya temizleme sadece Electron uygulamasında çalışır' };
    }
    try {
      return await window.electronAPI.cleanupTempFiles(filePaths);
    } catch (error: unknown) {
      console.error('Geçici dosya temizleme hatası:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async checkTrialStatus(): Promise<{success: boolean, trialInfo?: {isDemo: boolean, daysLeft: number, expiryDate: string, isExpired: boolean}, error?: string}> {
    if (!this.isElectron()) {
      return { success: false, error: 'Bu özellik sadece Electron uygulamasında çalışır' };
    }
    try {
      return await window.electronAPI.checkTrialStatus();
    } catch (error: unknown) {
      console.error('Trial bilgisi yüklenemedi:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async triggerEmailCheck(): Promise<{success: boolean, message?: string, error?: string}> {
    if (!this.isElectron()) {
      return { success: false, error: 'Bu özellik sadece Electron uygulamasında çalışır' };
    }
    try {
      return await window.electronAPI.triggerEmailCheck();
    } catch (error: unknown) {
      console.error('Email kontrolü tetiklenemedi:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async checkLicenseStatus(): Promise<{success: boolean, valid?: boolean, reason?: string, hardwareId?: string, licensePath?: string, license?: any, error?: string}> {
    if (!this.isElectron()) {
      return { success: false, error: 'Bu özellik sadece Electron uygulamasında çalışır' };
    }
    try {
      return await window.electronAPI.checkLicenseStatus();
    } catch (error: unknown) {
      console.error('Lisans bilgisi yüklenemedi:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async getLicenseHardwareId(): Promise<{success: boolean, hardwareId?: string, error?: string}> {
    if (!this.isElectron()) {
      return { success: false, error: 'Bu özellik sadece Electron uygulamasında çalışır' };
    }
    try {
      return await window.electronAPI.getLicenseHardwareId();
    } catch (error: unknown) {
      console.error('Cihaz lisans kimliği alınamadı:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }
}
