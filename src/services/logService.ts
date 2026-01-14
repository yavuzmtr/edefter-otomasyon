export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success';
  category: string;
  message: string;
  details?: any;
}

class LogService {
  private logs: LogEntry[] = [];
  private systemActivities: any[] = [];
  private maxLogs = 500; // Reduced for better performance
  private maxActivities = 200; // Reduced for better performance
  
  constructor() {
    // Başlangıç aktivitesi ekle (throttled)
    setTimeout(() => {
      this.addSystemActivity('system', 'Sistem Başlatıldı', 'LogService başlatıldı ve hazır', 'info');
    }, 100);
  }
  
  // Sistem aktivitesi ekleme
  addSystemActivity(type: string, title: string, description: string, status: 'success' | 'error' | 'info' = 'info', details?: any) {
    // Gereksiz logları filtrele - sadece önemli işlemleri kaydet
    const irrelevantPatterns = [
      /Veri yüklendi:/i,
      /Dashboard/i,
      /Sistem Başlatıldı/i,
      /LogService/i,
      /monitoring-data/i,
      /email-notification/i,
      /activity-logs/i
    ];

    const shouldIgnore = irrelevantPatterns.some(pattern => 
      pattern.test(title) || pattern.test(description)
    );

    if (shouldIgnore) {
      return;
    }

    const activity = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      type,
      title,
      description,
      status,
      details: details || {}
    };

    this.systemActivities.unshift(activity);
    
    // Maksimum aktivite sayısını aş
    if (this.systemActivities.length > this.maxActivities) {
      this.systemActivities = this.systemActivities.slice(0, this.maxActivities);
    }

    // Electron ortamında dosyaya kaydet
    this.saveActivityToFile(activity);
  }

  // Sistem aktivitelerini getir
  getSystemActivities(): any[] {
    return [...this.systemActivities];
  }

  // Aktiviteleri kategoriye göre filtrele
  getActivitiesByType(type: string): any[] {
    return this.systemActivities.filter(activity => activity.type === type);
  }

  // Aktiviteleri duruma göre filtrele
  getActivitiesByStatus(status: string): any[] {
    return this.systemActivities.filter(activity => activity.status === status);
  }

  private async saveActivityToFile(activity: any) {
    try {
      if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.saveLogEntry === 'function') {
        // Activity details'i güvenli şekilde stringify yap (error handling için)
        try {
          JSON.parse(JSON.stringify(activity.details || {}));
        } catch (e) {
          // Details serialization hatası - görmezden gel
        }
        
        // Sadece başlık ve açıklama kaydet, teknik detayları hariç tut
        const activityData = {
          timestamp: activity.timestamp?.toISOString?.() || new Date().toISOString(),
          type: String(activity.type || ''),
          title: String(activity.title || ''),
          description: String(activity.description || ''),
          status: String(activity.status || 'info')
        };
        
        await window.electronAPI.saveLogEntry({
          level: activity.status === 'error' ? 'error' : activity.status === 'success' ? 'success' : 'info',
          category: 'Sistem Aktivitesi',
          message: String(activity.title || '') + ': ' + String(activity.description || ''),
          details: activityData
        });
      }
    } catch (error) {
      // Sessiz kalın
    }
  }

  // Manuel işlem logları için özel metod
  logManualAction(action: string, details: string, result: 'success' | 'error' = 'success') {
    this.log(result, 'Manuel İşlem', action, details);
    this.addSystemActivity('manual', action, details, result);
  }
  
  // Sistem işlem logları için özel metod
  logSystemAction(action: string, details: string, result: 'success' | 'error' | 'info' = 'info') {
    this.log(result, 'Sistem İşlemi', action, details);
    this.addSystemActivity('system', action, details, result);
  }
  
  // E-posta işlem logları için özel metod
  logEmailAction(action: string, details: string, result: 'success' | 'error' = 'success') {
    this.log(result, 'E-posta İşlemi', action, details);
    this.addSystemActivity('email', action, details, result);
  }
  
  // Yedekleme işlem logları için özel metod
  logBackupAction(action: string, details: string, result: 'success' | 'error' = 'success') {
    this.log(result, 'Yedekleme İşlemi', action, details);
    this.addSystemActivity('backup', action, details, result);
  }
  
  // Şirket işlem logları için özel metod
  logCompanyAction(action: string, details: string, result: 'success' | 'error' = 'success') {
    this.log(result, 'Şirket İşlemi', action, details);
    this.addSystemActivity('company', action, details, result);
  }
  
  // Monitoring işlem logları için özel metod
  logMonitoringAction(action: string, details: string, result: 'success' | 'error' | 'info' = 'info') {
    this.log(result, 'İzleme İşlemi', action, details);
    this.addSystemActivity('monitoring', action, details, result);
  }

  log(level: 'info' | 'warning' | 'error' | 'success', category: string, message: string, details?: any) {
    const entry: LogEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      level,
      category,
      message,
      details
    };

    this.logs.unshift(entry);
    
    // Maksimum log sayısını aş
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Console'a da yazdır
    const logMessage = `[${level.toUpperCase()}] ${category}: ${message}`;
    switch (level) {
      case 'error':
        console.error(logMessage, details);
        break;
      case 'warning':
        console.warn(logMessage, details);
        break;
      case 'success':
        console.log(`✅ ${logMessage}`, details);
        break;
      default:
        console.log(logMessage, details);
    }

    // Electron ortamında dosyaya kaydet
    this.saveToFile(entry);
  }

  private async saveToFile(entry: LogEntry) {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const logData = {
          timestamp: entry.timestamp.toISOString(),
          level: entry.level,
          category: entry.category,
          message: entry.message,
          details: entry.details
        };
        
        await window.electronAPI.saveLogEntry(logData);
      }
    } catch (error) {
      console.error('Log dosyaya kaydedilemedi:', error);
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }

  getLogsByCategory(category: string): LogEntry[] {
    return this.logs.filter(log => log.category === category);
  }

  getLogsByLevel(level: string): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }
}

export const logService = new LogService();