import React, { useState, useEffect, useCallback } from 'react';
import { 
  Mail, 
  Send, 
  Settings, 
  TestTube, 
  AlertCircle, 
  CheckCircle, 
  X, 
  Calendar, 
  Plus, 
  Trash2, 
  User,
  Building,
  Eye,
  EyeOff,
  AtSign,
  Globe,
  Shield,
  Zap,
  Users,
  FileText,
  Search,
  CheckSquare,
  Square,
  Download
} from 'lucide-react';
import { ElectronService } from '../services/electronService';
import { logService } from '../services/logService';

interface EmailSettings {
  smtpServer: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

interface Company {
  id: string;
  name: string;
  email: string;
  taxNumber?: string;
  tcNumber?: string;
  status: string;
}

interface SelectedPeriod {
  year: number;
  month: number;
}

interface CustomRecipient {
  id: string;
  email: string;
  name: string;
}

interface EmailSystemProps {
  triggerScan?: number;
}

export const EmailSystem: React.FC<EmailSystemProps> = ({ triggerScan = 0 }) => {
  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    smtpServer: '',
    port: 587,
    username: '',
    password: '',
    fromEmail: '',
    fromName: ''
  });
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedPeriods, setSelectedPeriods] = useState<SelectedPeriod[]>([]);
  const [customRecipients, setCustomRecipients] = useState<CustomRecipient[]>([]);
  const [emailSubject, setEmailSubject] = useState('E-Defter Klasörleri');
  const [isSending, setIsSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [creatingZip, setCreatingZip] = useState(false);

  // Yıl ve ay seçimi için state'ler
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  
  // Özel alıcı ekleme
  const [newRecipientEmail, setNewRecipientEmail] = useState('');
  const [newRecipientName, setNewRecipientName] = useState('');

  // Tek şirket seçimi için
  const [singleCompanyMode, setSingleCompanyMode] = useState(false);
  const [selectedSingleCompany, setSelectedSingleCompany] = useState<string>('');

  // Arama ve toplu işlemler için
  const [searchTerm, setSearchTerm] = useState('');

  // E-posta raporları
  interface EmailReport {
    timestamp: string;
    recipientEmail: string;
    recipientName: string;
    status: 'success' | 'failed';
    periods: string;
    attachmentCount: number;
    errorMessage?: string;
    isAutomated?: boolean;
  }
  const [emailReports, setEmailReports] = useState<EmailReport[]>([]);
  
  // ✅ YENİ: SentEmails yönetimi için state
  const [showSentEmailsModal, setShowSentEmailsModal] = useState(false);
  const [sentEmailsList, setSentEmailsList] = useState<any[]>([]);

  const monthNames = [
    '', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 10 }, (_, i) => currentYear - i);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
    logService.log(type === 'success' ? 'success' : 'error', 'E-posta', message);
  };

  const loadEmailSettings = async () => {
    try {
      // ✅ SettingsPage.tsx ile aynı key kullan: email-config
      // İlk olarak yeni key'i (email-config) kontrol et
      let result = await ElectronService.loadData('email-config', null);
      
      if (result.success && result.data) {
        // email-config formatını EmailSettings formatına dönüştür
        const config = result.data;
        setEmailSettings({
          smtpServer: config.smtpServer || '',
          port: config.smtpPort || 465,
          username: config.senderEmail || '',
          password: config.senderPassword || '',
          fromEmail: config.senderEmail || '',
          fromName: 'E-Defter Otomasyon'
        });
        logService.log('success', 'E-posta', 'E-posta ayarları yüklendi (Sistem Ayarları\'ndan)');
        return;
      }
      
      // Fallback: Eski email-settings key'ini kontrol et (compatibility)
      result = await ElectronService.loadData('email-settings', null);
      if (result.success && result.data) {
        setEmailSettings(result.data);
        logService.log('success', 'E-posta', 'E-posta ayarları yüklendi (legacy)');
      }
    } catch (error) {
      logService.log('error', 'E-posta', 'E-posta ayarları yüklenirken hata', error);
    }
  };

  // ✅ HELPER FUNCTIONS
  const loadSentEmails = async (): Promise<Set<string>> => {
    try {
      const result = await ElectronService.loadData('sent-emails-registry', []);
      return new Set(result.success ? result.data : []);
    } catch (error) {
      console.warn('Sent emails registry yüklenemedi:', error);
      return new Set();
    }
  };

  const saveSentEmails = async (sentSet: Set<string>) => {
    try {
      await ElectronService.saveData('sent-emails-registry', Array.from(sentSet));
    } catch (error) {
      console.warn('Sent emails registry kaydedilemedi:', error);
    }
  };

  const createEmailHash = (companyId: string, period: { month: number, year: number }, recipientEmail: string): string => {
    // ✅ DÖNEM BAZLI HASH - Complete durum (KB+YB) bir kez gönderilir
    return `${companyId}_${period.year}_${String(period.month).padStart(2, '0')}_${recipientEmail.toLowerCase()}`;
  };

  // ✅ Backend'den email aktivitelerini yükle (manuel + otomatik)
  const loadEmailActivities = async () => {
    try {
      // sentEmails verisini de al (email adresleri için)
      let sentEmailsData = [];
      try {
        const sentEmailsResult = await ElectronService.getSentEmails();
        sentEmailsData = sentEmailsResult.success && sentEmailsResult.data ? sentEmailsResult.data : [];
      } catch (err) {
        console.warn('getSentEmails hatası (devam ediyor):', err);
      }
      
      const result = await ElectronService.getEmailActivities();
      if (result.success && result.data && Array.isArray(result.data)) {
        // Backend'den gelen aktiviteleri emailReports formatına dönüştür
        const formattedReports: EmailReport[] = result.data
          .filter((activity: any) => 
            // Sadece email gönderim kayıtlarını göster
            activity.operation && (
              activity.operation.includes('Email Gönderildi') ||
              activity.operation.includes('Email Hatası')
            )
          )
          .map((activity: any) => {
            // Otomatik ve Manuel email formatları farklı parse ediliyor
            const isAutomated = activity.isAutomated || false;
            
            if (isAutomated) {
              // Otomatik: "ODAP ENERJI LIMITED SIRKETI - Kasım 2025 (2 dosya) | Email: firma@example.com"
              const companyName = activity.details.split(' - ')[0]?.trim() || 'Bilinmiyor';
              const periodMatch = activity.details.match(/(Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)\s+(\d{4})/);
              const period = periodMatch ? `${periodMatch[1]} ${periodMatch[2]}` : '-';
              
              // Email adresini | Email: sonrasından al
              let email = 'Bilinmiyor';
              const emailMatch = activity.details.match(/\|\s*Email:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
              if (emailMatch) {
                email = emailMatch[1];
              } else {
                // Eski loglarda email yok, sentEmails'den cross-reference yap
                const monthMap: { [key: string]: number } = {
                  'Ocak': 1, 'Şubat': 2, 'Mart': 3, 'Nisan': 4, 'Mayıs': 5, 'Haziran': 6,
                  'Temmuz': 7, 'Ağustos': 8, 'Eylül': 9, 'Ekim': 10, 'Kasım': 11, 'Aralık': 12
                };
                const month = periodMatch ? monthMap[periodMatch[1]] : 0;
                const year = periodMatch ? parseInt(periodMatch[2]) : 0;
                
                // sentEmails'de aynı şirket ve dönemi bul
                const matchingSent = sentEmailsData.find((sent: any) => 
                  sent.companyName === companyName && 
                  sent.month === month && 
                  sent.year === year
                );
                if (matchingSent) {
                  email = matchingSent.recipientEmail;
                }
              }
              
              return {
                timestamp: `${activity.date} ${activity.time}`,
                recipientEmail: email,
                recipientName: companyName,
                status: activity.status === 'Başarılı' ? 'success' as const : 'failed' as const,
                periods: period,
                attachmentCount: activity.details.includes('dosya') ? 1 : 0,
                errorMessage: activity.status === 'Başarısız' ? activity.details : undefined,
                isAutomated: true
              };
            } else {
              // Manuel: "atamuhasebe34@gmail.com | Konusu: E-Defter Dosyaları | Ekler: ..."
              const email = activity.details.split('|')[0]?.trim() || 'Bilinmiyor';
              const subject = activity.details.split('Konusu:')[1]?.split('|')[0]?.trim() || '-';
              const periodMatch = activity.details.match(/(\d{1,2})\/(\d{4})/);
              const period = periodMatch ? `${periodMatch[1]}/${periodMatch[2]}` : '-';
              
              return {
                timestamp: `${activity.date} ${activity.time}`,
                recipientEmail: email,
                recipientName: subject,
                status: activity.status === 'Başarılı' ? 'success' as const : 'failed' as const,
                periods: period,
                attachmentCount: activity.details.includes('ZIP') ? 1 : 0,
                errorMessage: activity.status === 'Başarısız' ? activity.details : undefined,
                isAutomated: false
              };
            }
          });
        
        setEmailReports(formattedReports);
        logService.log('success', 'E-posta', `${formattedReports.length} email aktivitesi yüklendi`);
      }
    } catch (error) {
      console.error('Email aktiviteleri yüklenemedi:', error);
      logService.log('error', 'E-posta', 'Email aktiviteleri yüklenirken hata', error);
    }
  };
  
  // ✅ YENİ: SentEmails kayıtlarını yükle
  const loadSentEmailsList = async () => {
    try {
      const result = await ElectronService.loadData('sentEmails', []);
      if (result.success && Array.isArray(result.data)) {
        setSentEmailsList(result.data);
        logService.log('success', 'E-posta', `${result.data.length} gönderilmiş email kaydı yüklendi`);
      }
    } catch (error) {
      console.error('SentEmails yüklenemedi:', error);
      logService.log('error', 'E-posta', 'SentEmails yüklenirken hata', error);
    }
  };
  
  // ✅ YENİ: SentEmails kayıtlarını temizle
  const clearSentEmails = async () => {
    if (!confirm('⚠️ Tüm gönderilmiş email kayıtları silinecek ve tekrar email gönderimi yapılabilir. Emin misiniz?')) {
      return;
    }
    
    try {
      await ElectronService.saveData('sentEmails', []);
      setSentEmailsList([]);
      showNotification('success', '✅ Gönderilmiş email kayıtları temizlendi');
      logService.log('success', 'E-posta', 'SentEmails kayıtları temizlendi');
    } catch (error) {
      console.error('SentEmails temizlenemedi:', error);
      showNotification('error', '❌ Kayıtlar temizlenirken hata oluştu');
      logService.log('error', 'E-posta', 'SentEmails temizleme hatası', error);
    }
  };
  
  // ✅ YENİ: Tek bir sentEmail kaydını sil
  const deleteSentEmail = async (index: number) => {
    try {
      const newList = [...sentEmailsList];
      newList.splice(index, 1);
      await ElectronService.saveData('sentEmails', newList);
      setSentEmailsList(newList);
      showNotification('success', '✅ Kayıt silindi');
      logService.log('success', 'E-posta', 'SentEmail kaydı silindi');
    } catch (error) {
      console.error('SentEmail silinemedi:', error);
      showNotification('error', '❌ Kayıt silinirken hata oluştu');
      logService.log('error', 'E-posta', 'SentEmail silme hatası', error);
    }
  };

  // ✅ GLOBAL AUTOMATED EMAIL SENDING FUNCTION
  const performEmailSending = useCallback(async () => {
    try {
      logService.log('info', 'E-posta Otomasyonu', '📧 Otomatik email kontrolü başlatıldı');
      
      // 1. Otomasyon ayarlarını yükle
      const automationSettings = await ElectronService.loadData('automation-settings', {});
      if (!automationSettings.success || !automationSettings.data) {
        logService.log('error', 'E-posta', 'Otomasyon ayarları yüklenemedi');
        return;
      }
      
      const settings = automationSettings.data;
      
      // 2. Email otomasyonu kontrolü
      if (!settings.emailConfig?.enabled) {
        logService.log('info', 'E-posta', 'Email otomasyonu kapalı');
        return;
      }
      
      logService.log('info', 'E-posta', `✅ Email otomasyonu aktif, başlangıç: ${settings.startYear}/${settings.startMonth}`);
      
      // 3. Başlangıç tarihini hesapla
      const startYear = settings.startYear || 0;
      const startMonth = settings.startMonth || 0;
      
      if (!startYear || !startMonth) {
        logService.log('warning', 'E-posta', 'Başlangıç tarihi ayarlanmamış, tüm dönemler taranacak');
      }
      
      // 4. Monitoring data'yı yükle
      const monitoringResult = await ElectronService.loadData('monitoring-data', []);
      if (!monitoringResult.success) {
        logService.log('error', 'E-posta', 'Monitoring verisi yüklenemedi');
        return;
      }
      
      const allMonitoringData = monitoringResult.data || [];
      logService.log('info', 'E-posta', `Toplam ${allMonitoringData.length} monitoring kaydı bulundu`);
      
      // 5. Başlangıç tarihinden sonraki complete dönemleri filtrele
      const qualifyingRecords = allMonitoringData.filter((record: any) => {
        if (record.status !== 'complete') return false;
        
        // Başlangıç tarihi kontrolü
        if (startYear && startMonth) {
          if (record.year < startYear) return false;
          if (record.year === startYear && record.month < startMonth) return false;
        }
        
        return true;
      });
      
      logService.log('info', 'E-posta', `${qualifyingRecords.length} adet gönderilmeye uygun dönem tespit edildi`);
      
      if (qualifyingRecords.length === 0) {
        logService.log('info', 'E-posta', 'Gönderilecek dönem bulunamadı');
        return;
      }
      
      // 6. Companies ve email settings'i yükle
      const companiesResult = await ElectronService.loadData('companies', []);
      const emailSettingsResult = await ElectronService.loadData('email-settings', {});
      
      const allCompanies = companiesResult.success ? (companiesResult.data || []) : [];
      const emailSettings = emailSettingsResult.success ? emailSettingsResult.data : {};
      const emailSubject = emailSettings.subject || 'E-Defter Klasörleri';
      
      logService.log('info', 'E-posta', `Toplam ${allCompanies.length} şirket kaydı mevcut`);
      
      // 7. Sent emails registry'yi yükle
      const sentEmails = await loadSentEmails();
      logService.log('info', 'E-posta', `Mevcut gönderilmiş email sayısı: ${sentEmails.size}`);
      
      // 8. Her qualifying record için email hazırla
      const pendingEmails: {company: any, period: SelectedPeriod, hash: string, record: any}[] = [];
      
      for (const record of qualifyingRecords) {
        // ✅ SADECE COMPLETE DURUMLARI İŞLE (KB+YB var)
        if (record.status !== 'complete') {
          logService.log('debug', 'E-posta', `SKIP: ${record.companyName} - ${record.month}/${record.year} (Status: ${record.status}, KB+YB gerekli)`);
          continue;
        }
        
        // Şirket bilgilerini bul
        const company = allCompanies.find((c: any) => c.id === record.companyId);
        
        if (!company) {
          // Bu normal: Monitoring-data'da var ama companies'de yok (silinmiş/devre dışı)
          // logService.log('debug', 'E-posta', `Şirket bulunamadı: ${record.companyId} (${record.companyName})`);
          continue;
        }
        
        if (!company.email) {
          logService.log('warning', 'E-posta', `Email adresi yok: ${company.name}`);
          continue;
        }
        
        // Period objesi oluştur
        const period: SelectedPeriod = { month: record.month, year: record.year };
        
        // Hash kontrolü (mükerrer gönderim engelleme) - DÖNEM BAZLI
        const hash = createEmailHash(record.companyId, period, company.email);
        
        if (sentEmails.has(hash)) {
          logService.log('info', 'E-posta', `SKIP: ${company.name} - ${period.month}/${period.year} (Complete klasör zaten gönderilmiş)`);
          continue;
        }
        
        const fileInfo = record.fileCount ? ` (${record.fileCount} dosya)` : '';
        pendingEmails.push({ company, period, hash, record });
        logService.log('info', 'E-posta', `QUEUE: ${company.name} - ${period.month}/${period.year} - Complete klasör${fileInfo}`);
      }
      
      if (pendingEmails.length === 0) {
        logService.log('info', 'E-posta', '✅ Gönderilecek yeni email yok (tümü zaten gönderilmiş)');
        return;
      }
      
      logService.log('success', 'E-posta', `🚀 ${pendingEmails.length} email gönderilecek`);
      
      // 9. Email gönderme işlemini başlat
      setTimeout(async () => {
        const newSentHashes: string[] = [];
        const tempZips: string[] = [];
        let successCount = 0;
        let failCount = 0;
        
        for (const emailItem of pendingEmails) {
          try {
            const { company, period, hash } = emailItem;
            
            logService.log('info', 'E-posta', `📦 ZIP oluşturuluyor: ${company.name} - ${period.month}/${period.year}`);
            
            const zipResult = await ElectronService.createCompanyZip(
              company,
              [period],
              emailSettings.customMessage || ''
            );
            
            if (!zipResult.success || !zipResult.zipPath) {
              logService.log('error', 'E-posta', `❌ ZIP oluşturma hatası: ${company.name}`);
              failCount++;
              continue;
            }
            
            tempZips.push(zipResult.zipPath);
            
            logService.log('info', 'E-posta', `📧 Email gönderiliyor: ${company.email}`);
            
            const sendResult = await ElectronService.sendEmail(
              emailSettings,
              company.email, // ✅ Sadece email adresi string olarak
              emailSubject,
              [zipResult.zipPath],
              emailSettings.customMessage || '',
              [period]
            );
            
            if (sendResult.success) {
              newSentHashes.push(hash);
              sentEmails.add(hash);
              successCount++;
              logService.log('success', 'E-posta', `✅ Email gönderildi: ${company.name} (${period.month}/${period.year})`);
            } else {
              failCount++;
              logService.log('error', 'E-posta', `❌ Email gönderilemedi: ${company.name} - ${sendResult.error || 'Bilinmeyen hata'}`);
            }
            
          } catch (err) {
            failCount++;
            logService.log('error', 'E-posta', `❌ Email gönderme hatası: ${String(err)}`);
          }
        }
        
        // 10. Sent emails registry'yi güncelle
        if (newSentHashes.length > 0) {
          await saveSentEmails(sentEmails);
          logService.log('success', 'E-posta', `💾 ${newSentHashes.length} email hash'i kalıcı olarak kaydedildi`);
        }
        
        // 11. Sonuç raporu
        const totalMsg = `🎯 Otomatik email tamamlandı: ${successCount}/${pendingEmails.length} başarılı, ${failCount} başarısız`;
        if (successCount > 0) {
          logService.log('success', 'E-posta', totalMsg);
        } else if (failCount > 0) {
          logService.log('error', 'E-posta', totalMsg);
        }
        
        // 12. Geçici dosyaları temizle
        if (tempZips.length > 0) {
          try {
            await ElectronService.cleanupTempFiles(tempZips);
            logService.log('info', 'E-posta', `🗑️ ${tempZips.length} ZIP dosyası temizlendi`);
          } catch (err) {
            logService.log('warning', 'E-posta', `⚠️ ZIP temizleme hatası: ${String(err)}`);
          }
        }
        
        // ✅ Email aktivitelerini yeniden yükle
        await loadEmailActivities();
      }, 0);
      
    } catch (error) {
      logService.log('error', 'E-posta', `performEmailSending hatası: ${String(error)}`);
    }
  }, []); // Dependency array boş - stable function

  const loadCompanies = async () => {
    try {
      const result = await ElectronService.loadData('companies', []);
      if (result.success) {
        const activeCompanies = (result.data || []).filter((company: any) => company.status === 'active');
        setCompanies(activeCompanies);
        logService.log('success', 'E-posta', `${activeCompanies.length} aktif şirket yüklendi`);
      }
    } catch (error) {
      logService.log('error', 'E-posta', 'Şirketler yüklenirken hata', error);
    }
  };

  // ✅ useEffect'leri burada tanımla - fonksiyonlardan SONRA
  useEffect(() => {
    loadEmailSettings();
    loadCompanies();
    loadEmailActivities(); // ✅ Backend'den email aktivitelerini yükle
    logService.log('info', 'E-posta', 'E-posta sistemi başlatıldı');
  }, []); // Empty dependency array - only run once!

  // ✅ GLOBAL TRIGGER - App.tsx'ten gelen trigger'a tepki ver
  useEffect(() => {
    if (triggerScan > 0) {
      logService.log('info', 'E-posta', '🎯 Global trigger alındı, email kontrolü başlatılıyor');
      performEmailSending();
    }
  }, [triggerScan, performEmailSending]);

  const saveEmailSettings = async () => {
    try {
      // ✅ Email ayarları + Seçili şirketler + Seçili dönemler + Konu
      
      // Validasyon
      if (!emailSettings.smtpServer || !emailSettings.username || !emailSettings.password) {
        showNotification('error', '❌ Lütfen tüm SMTP ayarlarını doldurun');
        logService.log('error', 'E-posta', 'Eksik SMTP ayarları - Kaydedilemedi');
        return;
      }
      
      // ✅ SMTP ayarlarını SettingsPage.tsx ile aynı format: email-config key'inde kaydet
      const smtpConfig = {
        smtpServer: emailSettings.smtpServer,
        smtpPort: emailSettings.port,
        useSSL: emailSettings.port === 465, // 465 = SSL, 587 = TLS
        senderEmail: emailSettings.username,
        senderPassword: emailSettings.password
      };
      
      await ElectronService.saveData('email-config', smtpConfig);
      logService.log('success', 'E-posta', 'SMTP ayarları kaydedildi (Sistem Ayarları ile senkron)');
      
      // ✅ Otomasyonun seçili şirketler ve dönemleri email-settings key'inde sakla
      const automationSettings = {
        selectedCompanies: selectedCompanies,
        selectedPeriods: selectedPeriods,
        subject: emailSubject,
        enabled: true
      };
      
      await ElectronService.saveData('email-settings', automationSettings);
      logService.log('success', 'E-posta', `Otomasyon ayarları kaydedildi: ${selectedCompanies.length} şirket, ${selectedPeriods.length} dönem`);
      
      setShowSettings(false);
      showNotification('success', '✅ E-posta ayarları kaydedildi (Sistem Ayarları ile senkron)');
    } catch (error) {
      logService.log('error', 'E-posta', 'Ayar kaydedilirken hata', error);
      showNotification('error', 'E-posta ayarları kaydedilemedi!');
    }
  };

  const testEmailConnection = async () => {
    setTestResult(null);
    
    try {
      logService.log('info', 'E-posta', 'SMTP bağlantı testi başlatıldı');
      
      if (!ElectronService.isElectron()) {
        throw new Error('Bu özellik sadece desktop uygulamasında çalışır');
      }
      
      // ✅ ADIM 1: Kaydedilmiş email ayarlarını yükle
      // İlk olarak email-config key'ini kontrol et (SettingsPage.tsx'de kaydedilen)
      let savedSettingsResult = await ElectronService.loadData('email-config', null);
      let settingsToTest = emailSettings;
      
      if (savedSettingsResult.success && savedSettingsResult.data) {
        // email-config formatını EmailSettings formatına dönüştür
        const config = savedSettingsResult.data;
        settingsToTest = {
          smtpServer: config.smtpServer || '',
          port: config.smtpPort || 465,
          username: config.senderEmail || '',
          password: config.senderPassword || '',
          fromEmail: config.senderEmail || '',
          fromName: 'E-Defter Otomasyon'
        };
        logService.log('info', 'E-posta', 'Kaydedilmiş SMTP ayarları yüklendi (Sistem Ayarları\'ndan)');
      } else {
        // Fallback: email-settings key'ini kontrol et (legacy)
        savedSettingsResult = await ElectronService.loadData('email-settings', null);
        if (savedSettingsResult.success && savedSettingsResult.data) {
          settingsToTest = savedSettingsResult.data;
          logService.log('info', 'E-posta', 'Kaydedilmiş email ayarları yüklendi (legacy)');
        }
      }
      
      // ✅ ADIM 2: Gerekli alanları kontrol et
      if (!settingsToTest.smtpServer || !settingsToTest.username || !settingsToTest.password) {
        setTestResult({
          success: false,
          message: '❌ Lütfen Sistem Ayarları → E-Posta (SMTP) Ayarları bölümünde tüm e-posta ayarlarını doldurup KAYDET butonuna tıklayın!\n\nGereken:\n• SMTP Sunucu (örn: smtp.gmail.com)\n• Gönderen Email\n• Şifre (Gmail için App Password)'
        });
        logService.log('error', 'E-posta', 'Eksik e-posta ayarları - Test edilemedi');
        return;
      }
      
      // GERÇEK SMTP BAĞLANTI TESTİ
      const result = await ElectronService.testEmailConnection({
        smtpHost: settingsToTest.smtpServer,
        smtpPort: settingsToTest.port,
        fromEmail: settingsToTest.username,
        password: settingsToTest.password,
        fromName: settingsToTest.fromName
      });
      
      setTestResult(result);
      
      // Test sonucunu 8 saniye sonra otomatik temizle
      setTimeout(() => {
        setTestResult(null);
      }, 8000);
      
      if (result.success) {
        logService.log('success', 'E-posta', 'SMTP bağlantı testi başarılı');
      } else {
        logService.log('error', 'E-posta', 'SMTP bağlantı testi başarısız', result.message);
      }
      
    } catch (error: any) {
      const errorMsg = error.message || 'Bilinmeyen hata';
      setTestResult({
        success: false,
        message: `❌ SMTP Bağlantı Hatası:\n\n${errorMsg}\n\n💡 Öneriler:\n• SMTP ayarlarını kontrol edin (Sistem Ayarları → E-Posta)\n• Gmail kullanıyorsanız "Uygulama Şifresi" oluşturun\n• Port 465 (SSL) veya 587 (TLS) olmalı`
      });
      logService.log('error', 'E-posta', 'SMTP test hatası', error);
    }
  };

  const addPeriod = () => {
    const newPeriod = { year: selectedYear, month: selectedMonth };
    const exists = selectedPeriods.some(p => p.year === newPeriod.year && p.month === newPeriod.month);
    
    if (!exists) {
      setSelectedPeriods([...selectedPeriods, newPeriod]);
      logService.log('info', 'E-posta', `Dönem eklendi: ${monthNames[newPeriod.month]} ${newPeriod.year}`);
    }
  };

  const removePeriod = (year: number, month: number) => {
    setSelectedPeriods(selectedPeriods.filter(p => !(p.year === year && p.month === month)));
    logService.log('info', 'E-posta', `Dönem kaldırıldı: ${monthNames[month]} ${year}`);
  };

  const addCustomRecipient = () => {
    if (newRecipientEmail && newRecipientName) {
      const newRecipient: CustomRecipient = {
        id: Date.now().toString(),
        email: newRecipientEmail,
        name: newRecipientName
      };
      setCustomRecipients([...customRecipients, newRecipient]);
      setNewRecipientEmail('');
      setNewRecipientName('');
      logService.log('info', 'E-posta', `Özel alıcı eklendi: ${newRecipient.name} (${newRecipient.email})`);
    }
  };

  const removeCustomRecipient = (id: string) => {
    setCustomRecipients(customRecipients.filter(r => r.id !== id));
    logService.log('info', 'E-posta', 'Özel alıcı kaldırıldı');
  };

  // Yeni yardımcı fonksiyonlar
  const filteredCompanies = companies.filter(company =>
    (company.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (company.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectAllCompanies = () => {
    const allFilteredIds = filteredCompanies.map(c => c.id);
    setSelectedCompanies([...new Set([...selectedCompanies, ...allFilteredIds])]);
    logService.log('info', 'E-posta', `${allFilteredIds.length} şirket toplu seçildi`);
  };

  const deselectAllCompanies = () => {
    const filteredIds = filteredCompanies.map(c => c.id);
    setSelectedCompanies(selectedCompanies.filter(id => !filteredIds.includes(id)));
    logService.log('info', 'E-posta', 'Toplu seçim temizlendi');
  };

  const sendEmails = async () => {
    setIsSending(true);
    logService.log('info', 'E-posta', 'E-posta gönderimi başlatıldı');
    
    let tempZipFiles: string[] = [];

    // ✅ FIX #1 & #4: Mail konusu - şirket adı ve dönem ekle
    const getEmailSubject = (companyName: string, periods: SelectedPeriod[]) => {
      if (periods.length === 0) return emailSubject;
      const periodTexts = periods.map(p => `${monthNames[p.month]} ${p.year}`).join(', ');
      return `${emailSubject} - ${companyName} (${periodTexts})`;
    };

    try {
      const recipients: Array<{email: string, name: string}> = [];

      // Şirket seçimi kontrolü
      if (singleCompanyMode && selectedSingleCompany) {
        const company = companies.find(c => c.id === selectedSingleCompany);
        if (company) {
          recipients.push({
            email: company.email,
            name: company.name
          });
        }
      } else {
        selectedCompanies.forEach(companyId => {
          const company = companies.find(c => c.id === companyId);
          if (company) {
            recipients.push({
              email: company.email,
              name: company.name
            });
          }
        });
      }

      // Özel alıcıları ekle
      customRecipients.forEach(recipient => {
        recipients.push({
          email: recipient.email,
          name: recipient.name
        });
      });

      if (recipients.length === 0) {
        showNotification('error', 'Lütfen en az bir alıcı seçin!');
        return;
      }

      if (selectedPeriods.length === 0) {
        showNotification('error', 'Lütfen en az bir dönem seçin!');
        return;
      }

      // Her şirket için ayrı ayrı e-posta gönder
      setCreatingZip(true);
      
      let successCount = 0;
      let failCount = 0;
      
      // ✅ DÜZELTME: Manuel send de setTimeout ile arka planda yap (UI donmasın)
      setTimeout(async () => {
        logService.log('info', 'E-posta', 'Manuel e-posta gönderme başlıyor (arka planda)...');
        
        try {
          // Her alıcı için ayrı ayrı işlem yap
          for (const recipient of recipients) {
            try {
              // E-posta hazırlanıyor
              logService.log('info', 'E-posta', `${recipient.name} için e-posta hazırlanıyor`);
              
              // Şirket verilerini bul
              const company = companies.find(c => c.name === recipient.name);
              if (!company) {
                logService.log('warning', 'E-posta', `Şirket bulunamadı: ${recipient.name}`);
                failCount++;
                continue;
              }
              
              // ✅ YENİ: Profesyonel email şablonu oluştur
              const emailTemplateResult = await ElectronService.createEmailTemplate(selectedPeriods, company.name);
              const dynamicMessage = emailTemplateResult.success && emailTemplateResult.htmlTemplate ? 
                emailTemplateResult.htmlTemplate : 
                `Bu e-posta otomatik otomasyon sistemi tarafından gönderilmiştir.\n\nDönem: ${selectedPeriods.map((p) => `${p.month}/${p.year}`).join(', ')}`;
              
              // Bu şirket için ZIP oluştur
              logService.log('info', 'E-posta', `ZIP oluşturuluyor: ${company.name}`);
              const zipResult = await ElectronService.createCompanyZip(
                {
                  name: company.name,
                  taxNumber: company.taxNumber,
                  tcNumber: company.tcNumber,
                  email: recipient.email
                },
                selectedPeriods,
                dynamicMessage // Artık kesinlikle string
              );
              
              // ZIP kontrol et
              logService.log('info', 'E-posta', `ZIP sonucu: success=${zipResult?.success}, path=${zipResult?.zipPath ? zipResult.zipPath.slice(-30) : 'Yok'}`);
              
              // ZIP başarılı mı kontrol et
              const recipientAttachments: string[] = [];
              if (zipResult?.success && zipResult?.zipPath) {
                recipientAttachments.push(zipResult.zipPath);
                tempZipFiles.push(zipResult.zipPath);
                logService.log('success', 'E-posta', `ZIP eklendi: ${zipResult.fileName || zipResult.zipPath.split(/[\\/]/).pop()}`);
              } else {
                // ZIP oluşturulamazsa hatayı log'la ama devam et
                const errorMsg = zipResult?.error || 'Bilinmeyen ZIP hatası';
                logService.log('error', 'E-posta', `ZIP oluşturulamadı: ${recipient.name} - ${errorMsg}`);
                failCount++;
                continue; // Bu alıcıyı atla
              }
              
              // Mail konusu ve content
              const individualSubject = getEmailSubject(company.name, selectedPeriods);
              
              // E-postayı gönder
              logService.log('info', 'E-posta', `Email gönderiliyor: ${recipient.email}`);
              const individualResult = await ElectronService.sendEmail(
                emailSettings,
                [recipient.email],
                individualSubject,
                recipientAttachments,
                dynamicMessage,
                selectedPeriods
              );
              
              if (individualResult?.success) {
                successCount++;
                logService.log('success', 'E-posta', `${recipient.name} adresine e-posta gönderildi`);
              } else {
                failCount++;
                const errorMsg = individualResult?.error || 'Bilinmeyen hata';
                logService.log('error', 'E-posta', `${recipient.name} adresine e-posta gönderilemedi: ${errorMsg}`);
              }
              
            } catch (recipientError) {
              failCount++;
              const errorMsg = String(recipientError);
              logService.log('error', 'E-posta', `${recipient.name} için işlem hatası: ${errorMsg}`);
            }
          }
        } catch (error) {
          logService.log('error', 'E-posta', 'Manuel e-posta gönderme hatası', error);
          failCount = recipients.length;
        }
        
        // Sonuçları değerlendir
        const result = { 
          success: successCount > 0,
          successCount,
          failCount,
          total: recipients.length
        };

        setCreatingZip(false);
        setIsSending(false);

        // UI güncelle
        if (result.success) {
          const attachmentInfo = tempZipFiles.length > 0 ? ` (${tempZipFiles.length} ek dosya ile)` : '';
          if (result.failCount > 0) {
            showNotification('success', `${result.successCount}/${result.total} e-posta başarıyla gönderildi${attachmentInfo}`);
            logService.log('warning', 'E-posta', `${result.successCount}/${result.total} e-posta gönderildi, ${result.failCount} hata`);
          } else {
            showNotification('success', `Tüm e-postalar başarıyla gönderildi! (${result.successCount} alıcı)${attachmentInfo}`);
            logService.log('success', 'E-posta', `${result.successCount} alıcıya e-posta başarıyla gönderildi${attachmentInfo}`);
          }
          
          // ✅ Email aktivitelerini yeniden yükle
          await loadEmailActivities();
          
          // Formu temizle
          setSelectedCompanies([]);
          setSelectedSingleCompany('');
          setCustomRecipients([]);
          setSelectedPeriods([]);
        } else {
          showNotification('error', `E-posta gönderim hatası! ${result.failCount}/${result.total} e-posta gönderilemedi`);
          logService.log('error', 'E-posta', `E-posta gönderim hatası: ${result.failCount}/${result.total} başarısız`);
          
          // ✅ Email aktivitelerini yeniden yükle (hata durumunda da)
          await loadEmailActivities();
        }
        
        // Geçici dosyaları temizle
        if (tempZipFiles.length > 0) {
          try {
            await ElectronService.cleanupTempFiles(tempZipFiles);
            logService.log('info', 'E-posta', `${tempZipFiles.length} geçici ZIP dosyası temizlendi`);
          } catch (cleanupError) {
            logService.log('warning', 'E-posta', 'Geçici dosya temizleme hatası', cleanupError);
          }
        }
      }, 0); // ✅ setTimeout 0ms delay
      
    } catch (error) {
      logService.log('error', 'E-posta', 'E-posta gönderimi sırasında hata oluştu!', error);
      showNotification('error', 'E-posta gönderimi sırasında hata oluştu!');
      setIsSending(false);
      setCreatingZip(false);
    }
  };

  // Settings Modal
  if (showSettings) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-3xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">E-posta Ayarları</h2>
                  <p className="text-blue-100">SMTP bağlantı ayarlarını yapılandırın</p>
                </div>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Notification */}
          {notification && (
            <div className={`mx-6 mt-6 p-4 rounded-xl ${
              notification.type === 'success' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'
            } border`}>
              <div className="flex items-center space-x-2">
                {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                <span className="font-medium">{notification.message}</span>
              </div>
            </div>
          )}

          {/* Bilgi Mesajı */}
          <div className="mx-6 mt-6 p-4 rounded-xl bg-blue-50 border border-blue-200">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">💡 Ayarlar Sistem Ayarları ile Senkronize</p>
                <p>Burada yaptığınız SMTP ayarları "Sistem Ayarları → E-Posta (SMTP) Ayarları" bölümüne kaydedilir. Her iki yerden de kullanılabilir.</p>
              </div>
            </div>
          </div>

          {/* Settings Form */}
          <div className="p-6 space-y-6">
            {/* SMTP Server */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 flex items-center">
                  <Globe className="w-4 h-4 mr-2 text-blue-600" />
                  SMTP Sunucu
                </label>
                <input
                  type="text"
                  value={emailSettings.smtpServer}
                  onChange={(e) => setEmailSettings({...emailSettings, smtpServer: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="smtp.gmail.com"
                />
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 flex items-center">
                  <Shield className="w-4 h-4 mr-2 text-green-600" />
                  Port
                </label>
                <input
                  type="number"
                  value={emailSettings.port}
                  onChange={(e) => setEmailSettings({...emailSettings, port: parseInt(e.target.value)})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="587"
                />
              </div>
            </div>

            {/* Credentials */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 flex items-center">
                  <AtSign className="w-4 h-4 mr-2 text-purple-600" />
                  Kullanıcı Adı
                </label>
                <input
                  type="text"
                  value={emailSettings.username}
                  onChange={(e) => setEmailSettings({...emailSettings, username: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="ornek@gmail.com"
                />
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Şifre</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={emailSettings.password}
                    onChange={(e) => setEmailSettings({...emailSettings, password: e.target.value})}
                    className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* From Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 flex items-center">
                  <Mail className="w-4 h-4 mr-2 text-orange-600" />
                  Gönderen E-posta
                </label>
                <input
                  type="email"
                  value={emailSettings.fromEmail}
                  onChange={(e) => setEmailSettings({...emailSettings, fromEmail: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="gonderici@sirket.com"
                />
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 flex items-center">
                  <User className="w-4 h-4 mr-2 text-indigo-600" />
                  Gönderen Adı
                </label>
                <input
                  type="text"
                  value={emailSettings.fromName}
                  onChange={(e) => setEmailSettings({...emailSettings, fromName: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="E-Defter Sistemi"
                />
              </div>
            </div>

            {/* Test Connection */}
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center">
                  <TestTube className="w-5 h-5 mr-2 text-blue-600" />
                  Bağlantı Testi
                </h3>
                <button
                  onClick={testEmailConnection}
                  className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center space-x-2 shadow-lg hover:shadow-xl"
                >
                  <Zap className="w-4 h-4" />
                  <span>Test Et</span>
                </button>
              </div>
              
              {testResult && (
                <div className={`p-4 rounded-xl border ${testResult.success 
                  ? 'bg-green-100 text-green-800 border-green-200' 
                  : 'bg-red-100 text-red-800 border-red-200'
                }`}>
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {testResult.success ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 whitespace-pre-wrap break-words text-sm font-medium">
                      {testResult.message}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 p-6 rounded-b-3xl border-t border-gray-200">
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowSettings(false)}
                className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors font-medium"
              >
                İptal
              </button>
              <button
                onClick={saveEmailSettings}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl font-medium"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main Interface
  return (
    <div className="w-full px-4 py-4">
      {/* Notification */}
      {notification && (
        <div className="fixed top-6 right-6 z-50 animate-slide-down">
          <div className={`p-4 rounded-2xl shadow-2xl border ${
            notification.type === 'success' 
              ? 'bg-green-100 text-green-800 border-green-200' 
              : 'bg-red-100 text-red-800 border-red-200'
          }`}>
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {notification.type === 'success' ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  <AlertCircle className="w-6 h-6" />
                )}
              </div>
              <span className="font-medium">{notification.message}</span>
            </div>
          </div>
        </div>
      )}

      <div className="w-full px-6 py-8">
        {/* Compact Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-lg">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">📧 E-posta Sistemi</h1>
              <p className="text-gray-600">E-defter klasörlerini müşterilerinize gönderin</p>
            </div>
          </div>
          
          {/* Settings Button */}
          <button
            onClick={() => setShowSettings(true)}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg space-x-2"
          >
            <Settings className="w-4 h-4" />
            <span>Ayarlar</span>
          </button>
        </div>

        {/* Main Content Grid - Left & Right Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Left Column - Recipients */}
          <div className="space-y-6">
            
            {/* Company Selection */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-teal-500 text-white p-4">
                <h3 className="text-lg font-bold flex items-center">
                  <Building className="w-5 h-5 mr-2" />
                  Şirket Seçimi ({selectedCompanies.length})
                </h3>
              </div>
              
              <div className="p-4">
                {/* Mode Selection */}
                <div className="flex space-x-2 mb-4">
                  <button
                    onClick={() => {setSingleCompanyMode(false); setSelectedSingleCompany('');}}
                    className={`flex-1 p-2 rounded-lg text-sm border-2 transition-all ${
                      !singleCompanyMode 
                        ? 'border-green-500 bg-green-50 text-green-800' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Users className="w-4 h-4 mx-auto mb-1" />
                    <div className="font-medium">Çoklu</div>
                  </button>
                  <button
                    onClick={() => {setSingleCompanyMode(true); setSelectedCompanies([]);}}
                    className={`flex-1 p-2 rounded-lg text-sm border-2 transition-all ${
                      singleCompanyMode 
                        ? 'border-green-500 bg-green-50 text-green-800' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <User className="w-4 h-4 mx-auto mb-1" />
                    <div className="font-medium">Tekli</div>
                  </button>
                </div>

                {/* Search & Bulk Actions */}
                {!singleCompanyMode && (
                  <div className="space-y-3 mb-4">
                    {/* Search */}
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Şirket ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm"
                      />
                    </div>
                    
                    {/* Bulk Actions */}
                    <div className="flex space-x-2">
                      <button
                        onClick={selectAllCompanies}
                        className="flex-1 px-3 py-2 text-xs bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors flex items-center justify-center space-x-1"
                      >
                        <CheckSquare className="w-3 h-3" />
                        <span>Tümünü Seç</span>
                      </button>
                      <button
                        onClick={deselectAllCompanies}
                        className="flex-1 px-3 py-2 text-xs bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center space-x-1"
                      >
                        <Square className="w-3 h-3" />
                        <span>Seçimi Temizle</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Company List */}
                {singleCompanyMode ? (
                  <select
                    value={selectedSingleCompany}
                    onChange={(e) => setSelectedSingleCompany(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm"
                  >
                    <option value="">Şirket seçin...</option>
                    {filteredCompanies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name} ({company.email})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {filteredCompanies.map((company) => (
                      <label key={company.id} className="flex items-center p-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedCompanies.includes(company.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCompanies([...selectedCompanies, company.id]);
                            } else {
                              setSelectedCompanies(selectedCompanies.filter(id => id !== company.id));
                            }
                          }}
                          className="w-4 h-4 text-green-600 rounded focus:ring-green-500 mr-2"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white text-sm truncate">{company.name}</div>
                          <div className="text-xs text-gray-500 truncate">{company.email}</div>
                        </div>
                      </label>
                    ))}
                    {filteredCompanies.length === 0 && (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        {searchTerm ? 'Aramanızla eşleşen şirket bulunamadı' : 'Henüz şirket eklenmemiş'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Period Selection */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4">
                <h3 className="text-lg font-bold flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  Dönem Seçimi ({selectedPeriods.length})
                </h3>
              </div>
              
              <div className="p-4">
                {/* Period Selector */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm"
                  >
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm"
                  >
                    {monthNames.slice(1).map((month, index) => (
                      <option key={index + 1} value={index + 1}>{month}</option>
                    ))}
                  </select>
                  
                  <button
                    onClick={addPeriod}
                    className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center space-x-1 text-sm"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Ekle</span>
                  </button>
                </div>

                {/* Selected Periods */}
                {selectedPeriods.length > 0 && (
                  <div>
                    <div className="flex flex-wrap gap-1">
                      {selectedPeriods.map((period, index) => (
                        <div
                          key={index}
                          className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-800 rounded-lg border border-orange-200 text-sm"
                        >
                          <span className="font-medium">{monthNames[period.month]} {period.year}</span>
                          <button
                            onClick={() => removePeriod(period.year, period.month)}
                            className="ml-1 text-orange-600 hover:text-orange-800 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Message & Actions */}
          <div className="space-y-6">
            
            {/* Custom Recipients */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4">
                <h3 className="text-lg font-bold flex items-center">
                  <AtSign className="w-5 h-5 mr-2" />
                  Özel Alıcılar ({customRecipients.length})
                </h3>
              </div>
              
              <div className="p-4 space-y-3">
                {/* Add Recipient Form */}
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newRecipientName}
                    onChange={(e) => setNewRecipientName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm"
                    placeholder="Alıcı adı"
                  />
                  <input
                    type="email"
                    value={newRecipientEmail}
                    onChange={(e) => setNewRecipientEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm"
                    placeholder="E-posta adresi"
                  />
                  <button
                    onClick={addCustomRecipient}
                    disabled={!newRecipientEmail || !newRecipientName}
                    className="w-full px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 transition-colors flex items-center justify-center space-x-1 text-sm"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Alıcı Ekle</span>
                  </button>
                </div>

                {/* Recipients List */}
                {customRecipients.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {customRecipients.map((recipient) => (
                      <div
                        key={recipient.id}
                        className="flex items-center justify-between p-2 bg-purple-50 rounded-lg border border-purple-200"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-purple-900 text-sm truncate">{recipient.name}</div>
                          <div className="text-xs text-purple-700 truncate">{recipient.email}</div>
                        </div>
                        <button
                          onClick={() => removeCustomRecipient(recipient.id)}
                          className="text-purple-600 hover:text-purple-800 transition-colors p-1 ml-2"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Message Configuration */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white p-4">
                <h3 className="text-lg font-bold flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Mesaj Ayarları
                </h3>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Subject */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">E-posta Konusu</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                    placeholder="E-posta konusu"
                  />
                </div>

                {/* Info Box */}
                <div className="p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
                  <div className="font-medium text-green-900 text-sm">✅ Yeni Email Şablonu</div>
                  <div className="text-xs text-green-700">Profesyonel mevzuat uyumlu şablon otomatik kullanılıyor</div>
                </div>
              </div>
            </div>

            {/* Send Button */}
            <button
              onClick={sendEmails}
              disabled={isSending || creatingZip || (
                (singleCompanyMode ? !selectedSingleCompany : selectedCompanies.length === 0) && 
                customRecipients.length === 0
              ) || selectedPeriods.length === 0}
              className={`w-full py-3 px-4 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl ${
                isSending || creatingZip
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-teal-600 text-white hover:from-green-700 hover:to-teal-700'
              }`}
            >
              {creatingZip ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent" />
                  <span>ZIP Oluşturuluyor...</span>
                </div>
              ) : isSending ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent" />
                  <span>Gönderiliyor...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <Send className="w-4 h-4" />
                  <span>E-postaları Gönder</span>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Email Reports Section - FULL WIDTH at Bottom */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Gönderim Aktivite Raporları</h3>
              <p className="text-sm text-gray-500 mt-1">E-posta gönderim geçmişi ve durumu</p>
            </div>
            {emailReports.length > 0 && (
              <div className="flex gap-3">
                {/* SentEmails Yönetimi Butonu */}
                <button
                  onClick={() => {
                    loadSentEmailsList();
                    setShowSentEmailsModal(true);
                  }}
                  className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2 text-sm"
                  title="Gönderilmiş email kayıtlarını görüntüle"
                >
                  <Settings className="w-4 h-4" />
                  <span>Email Geçmişi ({sentEmailsList.length})</span>
                </button>
                
                {/* Excel İndirme Butonu */}
                <button
                  onClick={async () => {
                    try {
                      // HTML table formatı - Excel'in native desteği var
                      const headers = ['Tarih & Saat', 'Alıcı Adı', 'E-posta', 'Dönemler', 'Durum', 'Tip', 'Hata Mesajı'];
                      const rows = emailReports.map(r => [
                        r.timestamp,
                        r.recipientName,
                        r.recipientEmail,
                        r.periods,
                        r.status === 'success' ? 'Başarılı' : 'Başarısız',
                        r.isAutomated ? 'Otomatik' : 'Manuel',
                        r.errorMessage || '-'
                      ]);
                      
                      // HTML table oluştur
                      const htmlContent = `
                        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                        <head>
                          <meta charset="utf-8">
                          <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
                          <x:Name>Email Raporları</x:Name>
                          <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
                          </x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
                        </head>
                        <body>
                          <table border="1">
                            <thead>
                              <tr>
                                ${headers.map(h => `<th>${h}</th>`).join('')}
                              </tr>
                            </thead>
                            <tbody>
                              ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('\n')}
                            </tbody>
                          </table>
                        </body>
                        </html>
                      `;
                      
                      const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
                      const link = document.createElement('a');
                      const url = URL.createObjectURL(blob);
                      link.setAttribute('href', url);
                      link.setAttribute('download', `email-raporlari-${new Date().toISOString().split('T')[0]}.xls`);
                      link.style.visibility = 'hidden';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      showNotification('success', '✅ Excel rapor indirildi');
                    } catch (error) {
                      showNotification('error', 'Rapor indirme hatası');
                      logService.log('error', 'E-posta', 'Excel raporu hatası', error);
                    }
                  }}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 text-sm"
                  title="Excel formatında rapor indir"
                >
                  <FileText className="w-4 h-4" />
                  <span>Excel</span>
                </button>

                {/* CSV İndirme Butonu */}
                <button
                  onClick={async () => {
                    try {
                      const headers = ['Tarih & Saat', 'Alıcı Adı', 'E-posta', 'Dönemler', 'Durum', 'Tip', 'Hata Mesajı'];
                      const rows = emailReports.map(r => [
                        r.timestamp,
                        r.recipientName,
                        r.recipientEmail,
                        r.periods,
                        r.status === 'success' ? 'Başarılı' : 'Başarısız',
                        r.isAutomated ? 'Otomatik' : 'Manuel',
                        r.errorMessage || '-'
                      ]);
                      
                      const csvContent = [
                        headers.join(','),
                        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
                      ].join('\n');
                      
                      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                      const link = document.createElement('a');
                      const url = URL.createObjectURL(blob);
                      link.setAttribute('href', url);
                      link.setAttribute('download', `email-raporlari-${new Date().toISOString().split('T')[0]}.csv`);
                      link.style.visibility = 'hidden';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      showNotification('success', '✅ CSV rapor indirildi');
                    } catch (error) {
                      showNotification('error', 'Rapor indirme hatası');
                      logService.log('error', 'E-posta', 'CSV raporu hatası', error);
                    }
                  }}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 text-sm"
                  title="CSV formatında rapor indir"
                >
                  <Download className="w-4 h-4" />
                  <span>CSV</span>
                </button>
              </div>
            )}
          </div>
          
          {emailReports.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Mail className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">E-posta Gönderimi Bulunmuyor</p>
              <p className="text-sm">Henüz e-posta gönderilmemiş</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-96 border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alıcı</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dönem</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tip</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Durum</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {emailReports.map((report, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {report.recipientName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {report.periods}
                      </td>
                      <td className="px-4 py-3">
                        {report.isAutomated ? (
                          <span className="inline-flex items-center px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-md font-medium">
                            🤖 Otomatik
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-md font-medium">
                            👤 Manuel
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {report.recipientEmail}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {report.timestamp}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {report.status === 'success' ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-800">
                            ✅ Başarılı
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium bg-red-100 text-red-800">
                              ❌ Başarısız
                            </span>
                            {report.errorMessage && (
                              <div className="text-xs text-red-600 font-medium">⚠️ {report.errorMessage}</div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
                </div>
      </div>
      
      {/* ✅ YENİ: SentEmails Modal */}
      {showSentEmailsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900">📨 Gönderilmiş Email Kayıtları</h3>
                <p className="text-sm text-gray-500 mt-1">Otomatik email sisteminin tekrar gönderim engellemesi için tutulan kayıtlar</p>
              </div>
              <button
                onClick={() => setShowSentEmailsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6">
              {sentEmailsList.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Mail className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">Kayıt Bulunmuyor</p>
                  <p className="text-sm mt-2">Henüz otomatik email gönderimi yapılmamış</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex justify-between items-center">
                    <p className="text-sm text-gray-600">
                      Toplam <strong>{sentEmailsList.length}</strong> kayıt bulunuyor
                    </p>
                    <button
                      onClick={clearSentEmails}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Tüm Kayıtları Temizle</span>
                    </button>
                  </div>
                  
                  <div className="overflow-y-auto max-h-96 border border-gray-200 rounded-lg">
                    <table className="w-full">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Şirket</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dönem</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dosyalar</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">İşlem</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {sentEmailsList.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {item.companyName || 'Bilinmiyor'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {item.month}/{item.year}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs font-medium">
                                {item.fileCount || 0} dosya
                              </span>
                              {item.fileList && item.fileList.length > 0 && (
                                <div className="text-xs text-gray-500 mt-1" title={item.fileList.join(', ')}>
                                  {item.fileList.slice(0, 2).join(', ')}
                                  {item.fileList.length > 2 && '...'}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {item.recipientEmail || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {item.sentDate ? new Date(item.sentDate).toLocaleString('tr-TR') : '-'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => deleteSentEmail(index)}
                                className="text-red-600 hover:text-red-800 p-1"
                                title="Bu kaydı sil"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      <strong>⚠️ DİKKAT:</strong> Bu kayıtlar silindiğinde, aynı dönemler için tekrar email gönderimi yapılabilir. 
                      Test amaçlı kullanın.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

