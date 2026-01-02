export interface Company {
  id: string;
  name: string;
  taxNumber?: string;
  tcNumber?: string;
  email: string;
  status: 'active' | 'inactive';
  lastCheck?: Date;
  companyType?: 'gelir-vergisi' | 'kurumlar-vergisi'; // Gelir Vergisi Mükellefi (11 haneli TC) veya Kurumlar Vergisi Mükellefi (Ltd, A.Ş.)
  reportingPeriod?: 'aylık' | '3-aylık'; // Aylık veya 3 aylık raporlama
}

export interface DeadlineInfo {
  period: string; // '01', '02', '03' veya '01-03', '04-06' vs
  deadline: string; // 'YYYY-MM-DD' formatı
  companyType: 'gelir-vergisi' | 'kurumlar-vergisi';
  reportingPeriod: 'aylık' | '3-aylık';
}

export interface FilingDeadlineTracker {
  id: string;
  companyId: string;
  companyName: string;
  companyType: 'gelir-vergisi' | 'kurumlar-vergisi';
  reportingPeriod: 'aylık' | '3-aylık';
  period: string; // '01', '02', '03' veya '01-03', '04-06' vs
  deadline: string; // İnsan okunabilir format: 'DD.MM.YYYY'
  deadlineDate: Date;
  isCompleted: boolean;
  completionDate?: Date;
  remainingDays: number;
  status: 'completed' | 'on-time' | 'due-soon' | 'overdue'; // Tamamlandı, Zamanında, Yaklaşıyor, Gecikmiş
  // Son yüklenen e-defter bilgileri
  lastUploadedPeriod?: string; // Son yüklenen dönem: '01', '02' vs
  lastUploadedDate?: Date; // Son yüklenen tarih
  // Yüklenecek olan sonraki dönem
  nextPeriod?: string; // Sonraki dönem: '02', '03' vs
  nextDeadline?: string; // Sonraki tarihe kadar gün: 'DD.MM.YYYY'
  nextDeadlineDate?: Date;
  nextRemainingDays?: number;
}

export interface FolderStructure {
  companyId: string;
  year: number;
  month: number;
  exists: boolean;
  requiredFiles: FileCheck[];
  lastUpdated: Date;
}

export interface FileCheck {
  fileName: string;
  required: boolean;
  exists: boolean;
  format: string;
  lastModified?: Date;
}

export interface BackupConfig {
  sourcePath: string;
  destinationPath: string;
  enabled: boolean;
  schedule?: 'daily' | 'weekly' | 'monthly';
}

export interface EmailConfig {
  smtpServer: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  enabled: boolean;
}

export interface AutomationSettings {
  enabled: boolean;
  checkInterval: number; // minutes
  autoBackup: boolean;
  autoEmail: boolean;
  autoReport: boolean;
}

export interface MonitoringStatus {
  totalCompanies: number;
  activeMonitoring: number;
  completeFolders: number;
  missingFolders: number;
  lastScan: Date;
}