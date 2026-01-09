import React, { useState, useEffect } from 'react';
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
  Square
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

export const EmailSystem: React.FC = () => {
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
  }
  const [emailReports, setEmailReports] = useState<EmailReport[]>([]);

  const monthNames = [
    '', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 10 }, (_, i) => currentYear - i);

  useEffect(() => {
    loadEmailSettings();
    loadCompanies();
    logService.log('info', 'E-posta', 'E-posta sistemi başlatıldı');
  }, []); // Empty dependency array - only run once!

  // ✅ SEPARATE useEffect for automation event listener 
  useEffect(() => {
    // ✅ KALıCI BENZERSİZ KOD SİSTEMİ: Her şirket-dönem için benzersiz hash
    let emailDebounceTimer: NodeJS.Timeout | null = null;
    const loadSentEmails = async (): Promise<Set<string>> => {
      try {
        const result = await ElectronService.loadData('sent-emails-registry', []);
        return new Set(result.success ? result.data : []);
      } catch (error) {
        console.warn('Sent emails registry yüklenemedi:', error);
        return new Set();
      }
    };

    // ✅ Gönderilmiş email'leri kaydet
    const saveSentEmails = async (sentSet: Set<string>) => {
      try {
        await ElectronService.saveData('sent-emails-registry', Array.from(sentSet));
      } catch (error) {
        console.warn('Sent emails registry kaydedilemedi:', error);
      }
    };

    // ✅ Benzersiz hash oluştur: şirket_ID + dönem + email
    const createEmailHash = (companyId: string, period: { month: number, year: number }, recipientEmail: string): string => {
      return `${companyId}_${period.year}_${String(period.month).padStart(2, '0')}_${recipientEmail.toLowerCase()}`;
    };
    
    // ✅ OTOMATİK EMAIL - Background service'in perform-automated-scan event'ini dinle
    const handleAutomatedScan = async () => {
      try {
        logService.log('info', 'E-posta', 'Otomasyon tarafından otomatik email tetiklendi');
        
        // ✅ DEBOUNCE: Aynı anda çoklu tetikleme engelle
        if (emailDebounceTimer) {
          clearTimeout(emailDebounceTimer);
        }
        
        emailDebounceTimer = setTimeout(async () => {
          await performEmailSending();
        }, 2000); // 2 saniye bekle, yeni tetikleme gelirse iptal et
        
      } catch (error) {
        logService.log('error', 'E-posta', `Otomatik email tetikleme hatası: ${String(error)}`);
      }
    };
    
    const performEmailSending = async () => {
      try {
        // Otomasyon ve Email ayarlarını kontrol et
        const automationSettings = await ElectronService.loadData('automation-settings', {});
        const emailSettings = await ElectronService.loadData('email-settings', {});
        
        if (!automationSettings.success) {
          logService.log('error', 'E-posta', 'Otomasyon ayarları yüklenemedi');
          return;
        }
        
        // Email otomasyonu açık mı?
        const emailConfigEnabled = automationSettings.data?.emailConfig?.enabled;
        
        if (!emailConfigEnabled) {
          logService.log('info', 'E-posta', 'Email otomasyonu kapalı');
          return;
        }
        
        // ✅ CRİTİCAL FİX: Companies'i her seferinde fresh olarak yükle
        const companiesResult = await ElectronService.loadData('companies', []);
        const freshCompanies = companiesResult.success ? 
          (companiesResult.data || []).filter((company: any) => company.status === 'active') : [];
        
        // ✅ FİX: Kaydedilmiş ayarları kullan, yoksa mevcut state'i kullan
        let selectedComps: string[] = [];
        let selectedPers: SelectedPeriod[] = [];
        let emailSubject_final: string = 'E-Defter Klasörleri';
        
        // İlk olarak kaydedilmiş ayarları yükle
        if (emailSettings.success && emailSettings.data) {
          selectedComps = emailSettings.data.selectedCompanies || [];
          selectedPers = emailSettings.data.selectedPeriods || [];
          emailSubject_final = emailSettings.data.subject || 'E-Defter Klasörleri';
        }
        
        // Eğer kaydedilmiş ayarlar boşsa, mevcut state'ten kullan
        if (selectedComps.length === 0 && selectedCompanies.length > 0) {
          selectedComps = selectedCompanies;
          logService.log('info', 'E-posta', 'Kaydedilmiş ayarlar boş, mevcut UI seçimleri kullanılıyor');
        }
        
        if (selectedPers.length === 0 && selectedPeriods.length > 0) {
          selectedPers = selectedPeriods;
          logService.log('info', 'E-posta', 'Kaydedilmiş dönemler boş, mevcut UI seçimleri kullanılıyor');
        }
        
        logService.log('info', 'E-posta', `Kaydedilen ayarlar: ${selectedComps.length} şirket, ${selectedPers.length} dönem`);
        
        // ✅ DEBUGGING: Seçili dönemleri detaylı logla
        if (selectedPers && selectedPers.length > 0) {
          const periodsStr = selectedPers.map((p: SelectedPeriod) => `${p.month}/${p.year}`).join(', ');
          logService.log('info', 'E-posta', `Seçili dönemler: [${periodsStr}]`);
        } else {
          logService.log('warning', 'E-posta', 'Seçili dönem listesi boş veya null!');
        }
        
        if (!selectedComps?.length) {
          logService.log('warning', 'E-posta', 'Seçilmiş şirket yok');
          return;
        }
        
        if (!selectedPers?.length) {
          logService.log('warning', 'E-posta', 'Seçilmiş dönem yok');
          return;
        }
        
        logService.log('info', 'E-posta', `Otomatik email gönderimi başlatılıyor: ${selectedComps.length} şirket, ${selectedPers.length} dönem`);
        
        // ✅ KALıCI BENZERSİZ KOD KONTROLÜ: Daha önce gönderilmiş mi?
        const sentEmailsRegistry = await loadSentEmails();
        
        // Gönderilmemiş şirket-dönem kombinasyonlarını filtrele
        const pendingEmails: Array<{companyId: string, periods: Array<{month: number, year: number}>, recipients: Array<{email: string, name: string}>}> = [];
        
        for (const companyId of selectedComps) {
          const company = freshCompanies.find((c: any) => c.id === companyId);
          if (!company) continue;

          const recipient = { email: company.email, name: company.name };
          const availablePeriods: Array<{month: number, year: number}> = [];

          for (const period of selectedPers) {
            const emailHash = createEmailHash(companyId, period, recipient.email);
            
            if (sentEmailsRegistry.has(emailHash)) {
              logService.log('info', 'E-posta', `${company.name} (${period.month}/${period.year}) zaten gönderilmiş - atlanıyor`);
            } else {
              availablePeriods.push(period);
            }
          }

          if (availablePeriods.length > 0) {
            pendingEmails.push({
              companyId,
              periods: availablePeriods,
              recipients: [recipient]
            });
          }
        }

        if (pendingEmails.length === 0) {
          logService.log('info', 'E-posta', 'Tüm email\'ler zaten gönderilmiş - işlem durduruluyor');
          setIsSending(false);
          showNotification('success', 'Tüm seçili email\'ler zaten gönderilmiş');
          return;
        }

        logService.log('info', 'E-posta', `${pendingEmails.length} yeni email gönderilecek`);
        
        // ✅ DÜZELTME: Otomasyon işi arka planda yapıl, UI donmasın  
        // setTimeout ile UI thread'i bloke etme (setImmediate yerine)
        setTimeout(async () => {
          logService.log('info', 'E-posta', 'Otomatik email gönderme başlıyor (arka planda)...');
          
          let successCount = 0;
          let failCount = 0;
          const tempZips: string[] = [];
          const newSentHashes: string[] = [];
          
          // Her şirket-dönem kombinasyonu için email gönder
          for (const emailGroup of pendingEmails) {
            let recipient = emailGroup.recipients[0]; // İlk (ve tek) alıcı - scope'u genişlet
            try {
              // Şirketi bul (fresh companies'dan)
              const company = freshCompanies.find((c: any) => c.id === emailGroup.companyId);
              
              if (!company) {
                logService.log('warning', 'E-posta', `Şirket bulunamadı: ${emailGroup.companyId}`);
                failCount++;
                continue;
              }
              
              logService.log('info', 'E-posta', `ZIP oluşturuluyor: ${company.name} (${emailGroup.periods.length} dönem)`);
              
              // ✅ YENİ: Profesyonel email şablonu oluştur
              const emailTemplateResult = await ElectronService.createEmailTemplate(emailGroup.periods, company.name);
              const professionalEmailContent = emailTemplateResult.success && emailTemplateResult.htmlTemplate ? 
                emailTemplateResult.htmlTemplate : 
                `Bu e-posta otomatik otomasyon sistemi tarafından gönderilmiştir.\n\nDönem: ${emailGroup.periods.map((p) => `${p.month}/${p.year}`).join(', ')}`;
              
              // ZIP oluştur
              const zipResult = await ElectronService.createCompanyZip(
                {
                  name: company.name,
                  taxNumber: company.taxNumber,
                  tcNumber: company.tcNumber,
                  email: recipient.email
                },
                emailGroup.periods,
                professionalEmailContent // Artık kesinlikle string
              );
              
              if (!zipResult?.success || !zipResult?.zipPath) {
                logService.log('error', 'E-posta', `ZIP oluşturulamadı: ${recipient.name} - ${zipResult?.error || 'Bilinmeyen hata'}`);
                failCount++;
                continue;
              }
              
              // ZIP başarılı - artık zipResult.zipPath kesinlikle string
              tempZips.push(zipResult.zipPath);
              logService.log('success', 'E-posta', `ZIP oluşturuldu: ${zipResult.fileName || 'ZIP dosyası'}`);
              
              // Email gönder
              logService.log('info', 'E-posta', `Email gönderiliyor: ${recipient.email}`);
              const emailResult = await ElectronService.sendEmail(
                emailSettings,
                [recipient.email],
                emailSubject_final,
                [zipResult.zipPath], // Artık string olarak garanti
                professionalEmailContent, // ✅ Profesyonel HTML şablonu kullan
                emailGroup.periods
              );
              
              if (emailResult?.success) {
                successCount++;
                logService.log('success', 'E-posta', `Email gönderildi: ${recipient.name} (${emailGroup.periods.length} dönem)`);
                
                // ✅ BAŞARILI GÖNDERİM: Hash'leri kayıt için ekle
                for (const period of emailGroup.periods) {
                  const emailHash = createEmailHash(emailGroup.companyId, period, recipient.email);
                  newSentHashes.push(emailHash);
                }
              } else {
                failCount++;
                logService.log('error', 'E-posta', `Email gönderilemedi: ${recipient.name} - ${emailResult?.error || 'Bilinmeyen hata'}`);
              }
              
            } catch (error) {
              failCount++;
              logService.log('error', 'E-posta', `${recipient?.name || 'Bilinmeyen alıcı'} için email gönderme hatası: ${String(error)}`);
            }
          }
          
          // ✅ KALıCI KAYIT: Başarılı gönderilen email hash'lerini kaydet
          if (newSentHashes.length > 0) {
            const currentRegistry = await loadSentEmails();
            newSentHashes.forEach(hash => currentRegistry.add(hash));
            await saveSentEmails(currentRegistry);
            logService.log('success', 'E-posta', `${newSentHashes.length} email hash'i kalıcı olarak kaydedildi`);
          }
          
          // Sonuç logu
          const totalMsg = `Otomatik email tamamlandı: ${successCount}/${pendingEmails.length} başarılı, ${failCount} başarısız`;
          if (successCount > 0) {
            logService.log('success', 'E-posta', totalMsg);
            
          } else if (failCount > 0) {
            logService.log('error', 'E-posta', totalMsg);
          }
          
          // Geçici dosyaları temizle
          if (tempZips.length > 0) {
            try {
              await ElectronService.cleanupTempFiles(tempZips);
              logService.log('info', 'E-posta', `${tempZips.length} ZIP dosyası temizlendi`);
            } catch (err) {
              logService.log('warning', 'E-posta', `ZIP temizleme hatası: ${String(err)}`);
            }
          }
        }, 0); // ✅ setTimeout 0ms delay
        
      } catch (error) {
        logService.log('error', 'E-posta', `performEmailSending hatası: ${String(error)}`);
      }
    }; // ✅ performEmailSending fonksiyonu kapanışı

    // ✅ YENİ: trigger-scan event'ini dinle (yeni dosya eklendiğinde watcher tarafından tetiklenir)
    ElectronService.onTriggerScan(handleAutomatedScan);
    
    // perform-automated-scan event'ini dinle (30 saniyede bir background service tarafından)
    ElectronService.onPerformAutomatedScan(handleAutomatedScan);

    // ✅ CLEANUP FUNCTION: Memory leak engellemek için
    return () => {
      if (emailDebounceTimer) {
        clearTimeout(emailDebounceTimer);
        emailDebounceTimer = null;
      }
      ElectronService.removeAllListeners('perform-automated-scan');
      logService.log('info', 'E-posta', 'Email automation listener\'ları temizlendi');
    };
  }, []); // ✅ CRITICAL FIX: Empty dependency - no companies dependency!

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
    logService.log(type === 'success' ? 'success' : 'error', 'E-posta', message);
  };

  const loadEmailSettings = async () => {
    try {
      const result = await ElectronService.loadData('email-settings', {});
      if (result.success && result.data) {
        setEmailSettings(result.data);
        logService.log('success', 'E-posta', 'E-posta ayarları yüklendi');
      }
    } catch (error) {
      logService.log('error', 'E-posta', 'E-posta ayarları yüklenirken hata', error);
    }
  };

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

  const saveEmailSettings = async () => {
    try {
      // ✅ Email ayarları + Seçili şirketler + Seçili dönemler + Konu
      const completeSettings = {
        ...emailSettings,
        selectedCompanies: selectedCompanies,
        selectedPeriods: selectedPeriods,
        subject: emailSubject,
        enabled: true
      };
      
      await ElectronService.saveData('email-settings', completeSettings);
      logService.log('success', 'E-posta', `Ayarlar kaydedildi: ${selectedCompanies.length} şirket, ${selectedPeriods.length} dönem`);
      setShowSettings(false);
      showNotification('success', 'E-posta ayarları kaydedildi!');
    } catch (error) {
      logService.log('error', 'E-posta', 'Ayar kaydedilirken hata', error);
      showNotification('error', 'E-posta ayarları kaydedilemedi!');
    }
  };

  const testEmailConnection = async () => {
    if (!emailSettings.smtpServer || !emailSettings.username || !emailSettings.password) {
      setTestResult({
        success: false,
        message: 'Lütfen tüm e-posta ayarlarını doldurun!'
      });
      logService.log('error', 'E-posta', 'Eksik e-posta ayarları');
      return;
    }

    setTestResult(null);
    
    try {
      logService.log('info', 'E-posta', 'SMTP bağlantı testi başlatıldı');
      
      if (!ElectronService.isElectron()) {
        throw new Error('Bu özellik sadece desktop uygulamasında çalışır');
      }
      
      // GERÇEK SMTP BAĞLANTI TESTİ
      const result = await ElectronService.testEmailConnection({
        smtpHost: emailSettings.smtpServer,
        smtpPort: emailSettings.port,
        fromEmail: emailSettings.username,
        password: emailSettings.password,
        fromName: emailSettings.fromName
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
        message: `SMTP Bağlantı Hatası: ${errorMsg}`
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
                
                // Rapora ekle
                setEmailReports(prev => [...prev, {
                  timestamp: new Date().toLocaleString('tr-TR'),
                  recipientEmail: recipient.email,
                  recipientName: recipient.name,
                  status: 'success',
                  periods: selectedPeriods.map(p => `${p.month}/${p.year}`).join(', '),
                  attachmentCount: recipientAttachments.length
                }]);
              } else {
                failCount++;
                const errorMsg = individualResult?.error || 'Bilinmeyen hata';
                logService.log('error', 'E-posta', `${recipient.name} adresine e-posta gönderilemedi: ${errorMsg}`);
                
                // Rapora ekle
                setEmailReports(prev => [...prev, {
                  timestamp: new Date().toLocaleString('tr-TR'),
                  recipientEmail: recipient.email,
                  recipientName: recipient.name,
                  status: 'failed',
                  periods: selectedPeriods.map(p => `${p.month}/${p.year}`).join(', '),
                  attachmentCount: recipientAttachments.length,
                  errorMessage: errorMsg
                }]);
              }
              
            } catch (recipientError) {
              failCount++;
              const errorMsg = String(recipientError);
              logService.log('error', 'E-posta', `${recipient.name} için işlem hatası: ${errorMsg}`);
              
              // Rapora ekle
              setEmailReports(prev => [...prev, {
                timestamp: new Date().toLocaleString('tr-TR'),
                recipientEmail: recipient.email,
                recipientName: recipient.name,
                status: 'failed',
                periods: selectedPeriods.map(p => `${p.month}/${p.year}`).join(', '),
                attachmentCount: 0,
                errorMessage: errorMsg
              }]);
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
          
          // Formu temizle
          setSelectedCompanies([]);
          setSelectedSingleCompany('');
          setCustomRecipients([]);
          setSelectedPeriods([]);
        } else {
          showNotification('error', `E-posta gönderim hatası! ${result.failCount}/${result.total} e-posta gönderilemedi`);
          logService.log('error', 'E-posta', `E-posta gönderim hatası: ${result.failCount}/${result.total} başarısız`);
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
                  <div className="flex items-center space-x-2">
                    {testResult.success ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <span className="font-medium">{testResult.message}</span>
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
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

      <div className="container mx-auto px-6 py-8">
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

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
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

            {/* Email Reports Section - Always Visible */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mt-6">
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold flex items-center">
                      <Mail className="w-5 h-5 mr-2" />
                      📧 E-posta Gönderim Raporları ({emailReports.length})
                    </h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={async () => {
                          try {
                            // Excel raporu oluştur
                            const reportData = emailReports.map((report, index) => [
                              index + 1,
                              report.timestamp,
                              report.recipientEmail,
                              report.recipientName,
                              report.status === 'success' ? '✅ Başarılı' : '❌ Başarısız',
                              report.periods,
                              report.attachmentCount,
                              report.errorMessage || '-'
                            ]);
                            
                            const headers = ['No', 'Zaman', 'Alıcı E-posta', 'Alıcı Adı', 'Durum', 'Dönem', 'Ek Sayısı', 'Hata Mesajı'];
                            reportData.unshift(headers);
                            
                            const result = await ElectronService.createExcelTemplate(reportData);
                            if (result.success) {
                              showNotification('success', `✅ Excel raporu kaydedildi!\n📁 ${result.filePath?.split('\\').pop() || 'Dosya'}`);
                              logService.log('success', 'E-posta', 'Excel raporu başarıyla oluşturuldu');
                            } else {
                              showNotification('error', 'Excel raporu oluşturulamadı');
                            }
                          } catch (error) {
                            showNotification('error', 'Excel raporu oluşturma hatası');
                            logService.log('error', 'E-posta', 'Excel raporu hatası', error);
                          }
                        }}
                        className="px-4 py-2 bg-white text-purple-600 rounded-lg font-semibold text-sm hover:bg-purple-50 transition-colors"
                      >
                        📊 Excel İndir
                      </button>
                      <button
                        onClick={() => setEmailReports([])}
                        className="px-4 py-2 bg-white/20 text-white rounded-lg font-semibold text-sm hover:bg-white/30 transition-colors"
                      >
                        🗑️ Temizle
                      </button>
                    </div>
                  </div>
                </div>
                
                {emailReports.length > 0 ? (
                  <>
                {/* Report Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Sıra</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Zaman</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Alıcı E-posta</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Alıcı Adı</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Durum</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Dönem</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Ek Sayısı</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Hata Mesajı</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {emailReports.map((report, index) => (
                        <tr key={index} className={`${report.status === 'success' ? 'bg-green-50 hover:bg-green-100' : 'bg-red-50 hover:bg-red-100'} transition-colors`}>
                          <td className="px-4 py-3 font-medium text-gray-900">{index + 1}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{report.timestamp}</td>
                          <td className="px-4 py-3 text-gray-900 font-mono text-xs">{report.recipientEmail}</td>
                          <td className="px-4 py-3 text-gray-900">{report.recipientName}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                              report.status === 'success' 
                                ? 'bg-green-200 text-green-800' 
                                : 'bg-red-200 text-red-800'
                            }`}>
                              {report.status === 'success' ? '✅ Başarılı' : '❌ Başarısız'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-sm">{report.periods}</td>
                          <td className="px-4 py-3 text-gray-900 font-semibold text-center">{report.attachmentCount}</td>
                          <td className="px-4 py-3 text-red-600 text-xs max-w-xs truncate" title={report.errorMessage || ''}>
                            {report.errorMessage || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary Stats */}
                <div className="bg-gray-50 border-t border-gray-200 p-4 grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">{emailReports.length}</div>
                    <div className="text-sm text-gray-600">Toplam Gönderim</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{emailReports.filter(r => r.status === 'success').length}</div>
                    <div className="text-sm text-gray-600">Başarılı</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-600">{emailReports.filter(r => r.status === 'failed').length}</div>
                    <div className="text-sm text-gray-600">Başarısız</div>
                  </div>
                </div>
                  </>
                ) : (
                  <div className="p-12 text-center">
                    <Mail className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 text-lg font-semibold">Henüz E-posta Raporu Bulunmuyor</p>
                    <p className="text-gray-400 text-sm mt-2">E-postalar gönderdikten sonra raporlar burada görünecektir</p>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
