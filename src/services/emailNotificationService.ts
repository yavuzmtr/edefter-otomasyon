import { ElectronService } from './electronService';
import { Company } from '../types';
import { logService } from './logService';

interface CompanyDeadlineInfo {
  name: string;
  email: string;
  displayPeriod: string;
  deadlineDate: string;
  remainingDays: number;
  status: 'overdue' | 'due-soon' | 'pending';
  companyType: string;
  reportingPeriod: string;
}

interface EmailNotificationConfig {
  accountantEmail: string;
  enabled: boolean;
  sendAtMorning: boolean;
  sendAtEvening: boolean;
  alertDays: number[];
}

// Test modu kapali. Gecici test gunleri gerekirse buraya eklenir.
const TEMP_TEST_ALERT_DAYS: number[] = [];

const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

// EDefter takip sayfasiyla ayni deadline tablolari kullanilir.
const TURKISH_HOLIDAYS = [
  '2024-01-01', '2024-04-23', '2024-05-01', '2024-07-15', '2024-08-30', '2024-10-29',
  '2025-01-01', '2025-04-23', '2025-05-01', '2025-07-15', '2025-08-30', '2025-10-29',
  '2024-04-10', '2024-04-11', '2024-04-12', '2025-03-30', '2025-03-31', '2025-04-01',
  '2024-06-16', '2024-06-17', '2024-06-18', '2024-06-19', '2025-06-06', '2025-06-07', '2025-06-08', '2025-06-09',
];

const MONTHLY_DEADLINES: Record<'gelir-vergisi' | 'kurumlar-vergisi', Record<number, number[]>> = {
  'gelir-vergisi': {
    1: [5, 10], 2: [6, 10], 3: [7, 10], 4: [8, 10], 5: [9, 10], 6: [10, 10],
    7: [11, 10], 8: [12, 10], 9: [1, 10, 1], 10: [2, 10, 1], 11: [3, 10, 1], 12: [4, 10, 1]
  },
  'kurumlar-vergisi': {
    1: [5, 14], 2: [6, 14], 3: [7, 14], 4: [8, 14], 5: [9, 14], 6: [10, 14],
    7: [11, 14], 8: [12, 14], 9: [1, 14, 1], 10: [2, 14, 1], 11: [3, 14, 1], 12: [5, 14, 1]
  }
};

const QUARTERLY_DEADLINES: Record<'gelir-vergisi' | 'kurumlar-vergisi', Record<string, number[]>> = {
  'gelir-vergisi': {
    '01-03': [6, 10], '04-06': [9, 10], '07-09': [12, 10], '10-12': [4, 10, 1]
  },
  'kurumlar-vergisi': {
    '01-03': [6, 14], '04-06': [9, 14], '07-09': [12, 14], '10-12': [5, 14, 1]
  }
};

class EmailNotificationService {
    // Proaktif toplu uyarı gönderim kaydı (Electron Store ile saklanacak)
    private async getSentProactiveAlerts(): Promise<any[]> {
      try {
        const result = await ElectronService.loadData('sent-proactive-alerts', []);
        return result.success && Array.isArray(result.data) ? result.data : [];
      } catch {
        return [];
      }
    }

    private async addSentProactiveAlert(alert: {date: string, daysBeforeDeadline: number}): Promise<void> {
      const sent = await this.getSentProactiveAlerts();
      sent.push(alert);
      await ElectronService.saveData('sent-proactive-alerts', sent);
    }

  private config: EmailNotificationConfig | null = null;
  private notificationIntervals: NodeJS.Timeout[] = [];

  async initialize() {
    try {
      const configResult = await ElectronService.loadData('email-notification-config', null);
      if (configResult.success && configResult.data) {
        this.config = configResult.data as EmailNotificationConfig;
        if (this.config.enabled && this.config.accountantEmail) {
          this.setupScheduler();
          // Uygulama acilisinda saat beklemeden bir kez kontrol et.
          await this.checkAndSendNotifications();
          console.log('✅ Email bildirimi servisi başlatıldı:', this.config.accountantEmail);
        }
      }
    } catch (error) {
      console.error('❌ Email bildirimi servisi başlatma hatası:', error);
    }
  }

  private setupScheduler() {
    console.log('[SCHEDULER] setupScheduler çağrıldı');
    if (!this.config || !this.config.enabled) {
      console.log('[SCHEDULER] setupScheduler: config yok veya devre dışı');
      return;
    }
    if (this.config.sendAtMorning) this.scheduleCheck(6);
    if (this.config.sendAtEvening) this.scheduleCheck(18);
    // TEST: Saat 12:30'da da tetikleme
    this.scheduleCheck(14, 44);
  }

  private scheduleCheck(targetHour: number, targetMinute: number = 0) {
    console.log(`[SCHEDULER] scheduleCheck başlatıldı: hedef saat ${targetHour}:${targetMinute < 10 ? '0' : ''}${targetMinute}`);
    const checkAndSend = async () => {
      try {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        console.log(`[SCHEDULER] Döngü: Şu an saat ${currentHour}:${currentMinute < 10 ? '0' : ''}${currentMinute}`);
        if (currentHour === targetHour && currentMinute === targetMinute) {
          console.log(`[SCHEDULER] ${targetHour}:${targetMinute < 10 ? '0' : ''}${targetMinute} tetikleyici çalıştı (test)`);
          await this.checkAndSendNotifications();
        }
      } catch (error) {
        console.error('❌ Zamanlı kontrol hatası:', error);
      }
      // ✅ GÜVENLE: Sadece servis aktifse devam et
      if (this.config?.enabled) {
        console.log('[SCHEDULER] setTimeout ile döngü devam ediyor');
        const interval = setTimeout(checkAndSend, 60 * 1000); // 1 dakika
        this.notificationIntervals.push(interval);
      }
    };
    checkAndSend();
  }

  async checkAndSendNotifications() {
      console.log('[SCHEDULER] checkAndSendNotifications fonksiyonu çağrıldı');
      logService.log('info', 'Email Bildirim', 'checkAndSendNotifications tetiklendi');
    try {
      if (!this.config || !this.config.accountantEmail || !this.config.enabled) {
        console.log('⏭️ Email bildirimi devre dışı');
        logService.log('warning', 'Email Bildirim', 'Bildirim devre disi veya mali musavir email bos');
        return;
      }

      const companiesResult = await ElectronService.loadData('companies', []);
      const monitoringResult = await ElectronService.loadData('monitoring-data', []);
      const emailConfigResult = await ElectronService.loadData('email-config', null);

      if (!companiesResult.success || !emailConfigResult.success) {
        console.error('❌ Veri yükleme hatası');
        logService.log('error', 'Email Bildirim', 'Veri yukleme hatasi');
        return;
      }

      const companies: Company[] = companiesResult.data?.filter((c: Company) => c.status === 'active') || [];
      const monitoringData = monitoringResult.data || [];
      const emailConfig = emailConfigResult.data;
      const configuredAlertDays = Array.isArray(this.config.alertDays) && this.config.alertDays.length > 0
        ? this.config.alertDays
        : [7, 3, 1, 0];
      const alertDays = Array.from(
        new Set([
          ...configuredAlertDays,
          ...TEMP_TEST_ALERT_DAYS
        ])
       ).sort((a, b) => b - a);
      logService.log('info', 'Email Bildirim', 'Alert gunleri', { alertDays });

      const todayStr = new Date().toISOString().slice(0, 10);
      for (const daysBeforeDeadline of alertDays) {
        const companiesByAlert = this.findCompaniesByDeadlineProximity(companies, monitoringData, daysBeforeDeadline);
        logService.log('info', 'Email Bildirim', `${daysBeforeDeadline} gun icin eslesen sirket`, { daysBeforeDeadline, count: companiesByAlert.length });
        if (companiesByAlert.length > 0) {
          // Aynı gün ve aynı uyarı için tekrar gönderimi engelle
          const sentAlerts = await this.getSentProactiveAlerts();
          const alreadySent = sentAlerts.some(a => a.date === todayStr && a.daysBeforeDeadline === daysBeforeDeadline);
          if (alreadySent) {
            console.log(`⏭️ ${daysBeforeDeadline} gün toplu uyarı maili zaten gönderilmiş (${todayStr})`);
            continue;
          }
          console.log(`📧 ${daysBeforeDeadline} gün uyarısı - ${companiesByAlert.length} şirkete toplu bildirim gönderiliyor...`);
          await this.sendProactiveAlertEmail(companiesByAlert, daysBeforeDeadline, emailConfig);
          await this.addSentProactiveAlert({date: todayStr, daysBeforeDeadline});
          logService.log('success', 'Email Bildirim', `${daysBeforeDeadline} gun mail islemi tamamlandi`);
        }
      }
    } catch (error) {
      console.error('❌ Email bildirimi gönderme hatası:', error);
      logService.log('error', 'Email Bildirim', 'checkAndSendNotifications hata', error);
    }
  }

  private findCompaniesByDeadlineProximity(
    companies: Company[],
    monitoringData: any[],
    daysBeforeDeadline: number
  ): CompanyDeadlineInfo[] {
    const companiesList: CompanyDeadlineInfo[] = [];

    for (const company of companies) {
      const compId = company.tcNumber || company.taxNumber;
      if (!compId) continue;

      const allUploads = monitoringData
        .filter((r: any) => r.companyId === compId && r.status === 'complete')
        .map((r: any) => ({ month: r.month, year: r.year }));

      if (allUploads.length === 0) continue;

      const companyType = (company.companyType || 'kurumlar-vergisi') as 'gelir-vergisi' | 'kurumlar-vergisi';
      const reportingPeriod = (company.reportingPeriod || 'aylık') as 'aylık' | '3-aylık';
      const lastUpload = allUploads.sort((a: any, b: any) => b.year - a.year || b.month - a.month)[0];
      if (!lastUpload) continue;

      let nextUploadMonth = lastUpload.month;
      let nextUploadYear = lastUpload.year;

      const moveToNextPeriod = () => {
        if (reportingPeriod === 'aylık') {
          nextUploadMonth += 1;
          if (nextUploadMonth > 12) {
            nextUploadMonth = 1;
            nextUploadYear += 1;
          }
          return;
        }
        if (nextUploadMonth >= 1 && nextUploadMonth <= 3) nextUploadMonth = 4;
        else if (nextUploadMonth >= 4 && nextUploadMonth <= 6) nextUploadMonth = 7;
        else if (nextUploadMonth >= 7 && nextUploadMonth <= 9) nextUploadMonth = 10;
        else if (nextUploadMonth >= 10 && nextUploadMonth <= 12) { nextUploadMonth = 1; nextUploadYear += 1; }
      };

      const isPeriodUploaded = (checkMonth: number, checkYear: number): boolean => {
        if (reportingPeriod === 'aylık') {
          return allUploads.some(u => u.month === checkMonth && u.year === checkYear);
        }
        let quarterMonths: number[] = [];
        if (checkMonth >= 1 && checkMonth <= 3) quarterMonths = [1, 2, 3];
        else if (checkMonth >= 4 && checkMonth <= 6) quarterMonths = [4, 5, 6];
        else if (checkMonth >= 7 && checkMonth <= 9) quarterMonths = [7, 8, 9];
        else if (checkMonth >= 10 && checkMonth <= 12) quarterMonths = [10, 11, 12];
        return quarterMonths.some(m => allUploads.some(u => u.month === m && u.year === checkYear));
      };

      let loopCount = 0;
      while (loopCount < 36) {
        moveToNextPeriod();
        if (!isPeriodUploaded(nextUploadMonth, nextUploadYear)) break;
        loopCount++;
      }

      const deadline = this.getDeadlineDate(nextUploadMonth, nextUploadYear, companyType, reportingPeriod);
      if (!deadline) continue;

      const now = new Date();
      const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilDeadline !== daysBeforeDeadline) continue;
      const displayMonth = nextUploadMonth;
      companiesList.push({
        name: company.name,
        email: company.email || '',
        displayPeriod: reportingPeriod === 'aylık'
          ? `${MONTH_NAMES[displayMonth - 1]} ${nextUploadYear}`
          : (() => {
            let quarterMonths: number[] = [];
            if (displayMonth >= 1 && displayMonth <= 3) quarterMonths = [1, 2, 3];
            else if (displayMonth >= 4 && displayMonth <= 6) quarterMonths = [4, 5, 6];
            else if (displayMonth >= 7 && displayMonth <= 9) quarterMonths = [7, 8, 9];
            else if (displayMonth >= 10 && displayMonth <= 12) quarterMonths = [10, 11, 12];
            const monthNames = quarterMonths.map(m => MONTH_NAMES[m - 1]).join('-');
            return `${monthNames} ${nextUploadYear}`;
          })(),
        deadlineDate: deadline.toLocaleDateString('tr-TR'),
        remainingDays: daysUntilDeadline,
        status: daysUntilDeadline < 0 ? 'overdue' : (daysUntilDeadline <= 3 ? 'due-soon' : 'pending'),
        companyType: companyType === 'gelir-vergisi' ? '💰 Gelir Vergisi' : '🏢 Kurumlar Vergisi',
        reportingPeriod: reportingPeriod === 'aylık' ? 'Aylık' : '3 Aylık'
      });
    }
    return companiesList;
  }

  private isHolidayOrWeekend(date: Date): boolean {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return true;
    const dateStr = date.toISOString().split('T')[0];
    return TURKISH_HOLIDAYS.includes(dateStr);
  }

  private getNextWorkDay(date: Date): Date {
    const nextDate = new Date(date);
    while (this.isHolidayOrWeekend(nextDate)) {
      nextDate.setDate(nextDate.getDate() + 1);
    }
    return nextDate;
  }

  private getDeadlineDate(
    uploadedMonth: number,
    uploadedYear: number,
    companyType: 'gelir-vergisi' | 'kurumlar-vergisi',
    reportingPeriod: 'aylık' | '3-aylık'
  ): Date | null {
    let deadline: number[] | undefined;

    if (reportingPeriod === 'aylık') {
      deadline = MONTHLY_DEADLINES[companyType][uploadedMonth];
    } else {
      let quarter = '';
      if (uploadedMonth >= 1 && uploadedMonth <= 3) quarter = '01-03';
      else if (uploadedMonth >= 4 && uploadedMonth <= 6) quarter = '04-06';
      else if (uploadedMonth >= 7 && uploadedMonth <= 9) quarter = '07-09';
      else if (uploadedMonth >= 10 && uploadedMonth <= 12) quarter = '10-12';
      deadline = QUARTERLY_DEADLINES[companyType][quarter];
    }

    if (!deadline) return null;

    let year = uploadedYear;
    const month = deadline[0];
    const day = deadline[1];
    const isNextYear = deadline.length > 2 ? deadline[2] : 0;
    if (isNextYear) year += 1;

    const date = new Date(year, month - 1, day);
    return this.getNextWorkDay(date);
  }

  private async sendProactiveAlertEmail(companies: CompanyDeadlineInfo[], daysBeforeDeadline: number, emailConfig: any) {
    try {
      if (!emailConfig || !this.config) {
        console.error('❌ Email yapılandırması eksik');
        return;
      }

      // send-email IPC handler'i username/password/port bekliyor.
      // email-config ise senderEmail/senderPassword/smtpPort formatinda tutuluyor.
      const normalizedEmailConfig = {
        smtpServer: emailConfig.smtpServer || emailConfig.host || '',
        port: emailConfig.port || emailConfig.smtpPort || 587,
        username: emailConfig.username || emailConfig.senderEmail || emailConfig.fromEmail || emailConfig.user || '',
        password: emailConfig.password || emailConfig.senderPassword || emailConfig.pass || '',
        fromEmail: emailConfig.fromEmail || emailConfig.senderEmail || emailConfig.username || emailConfig.user || '',
        fromName: emailConfig.fromName || 'E-Defter Otomasyon'
      };

      if (!normalizedEmailConfig.smtpServer || !normalizedEmailConfig.username || !normalizedEmailConfig.password) {
        console.error('❌ SMTP ayarları eksik (otomatik bildirim):', {
          host: !!normalizedEmailConfig.smtpServer,
          user: !!normalizedEmailConfig.username,
          pass: !!normalizedEmailConfig.password
        });
        logService.log('error', 'Email Bildirim', 'SMTP ayarlari eksik');
        return;
      }

      const now = new Date();
      const dateStr = now.toLocaleDateString('tr-TR');
      let alertTitle = '';
      let alertDescription = '';
      let alertColor = '';

      if (daysBeforeDeadline === 7) {
        alertTitle = '📋 7 GÜN KALDI - Planlama Aşaması';
        alertDescription = 'Aşağıdaki şirketlerin e-defter berat yüklemesi için 7 gün kalmıştır. Evrakları toplayıp hazırlamaya başlayabilirsiniz.';
        alertColor = '#2563eb';
      } else if (daysBeforeDeadline === 3) {
        alertTitle = '⚠️ 3 GÜN KALDI - Hazırlık Tamamlanmalı';
        alertDescription = 'Aşağıdaki şirketlerin yüklemesi için 3 gün kalmıştır. Son kontrolleri yapınız.';
        alertColor = '#f59e0b';
      } else if (daysBeforeDeadline === 1) {
        alertTitle = '🚀 YARIM GÜN KALDI - Son Kontrol Zamanı';
        alertDescription = 'DİKKAT! Aşağıdaki şirketlerin yüklemesi YARIM günde sona eriyor. Lütfen derhal kontrol edin!';
        alertColor = '#f97316';
      } else if (daysBeforeDeadline === 0) {
        alertTitle = '🔴 BUGÜN SON GÜN - Net Rapor';
        alertDescription = 'BUGÜN E-Defter berat yükleme son günüdür. Aşağıda yüklenmesi gereken şirketlerin listesi yer almaktadır.';
        alertColor = '#dc2626';
      } else {
        alertTitle = `📌 ${daysBeforeDeadline} GÜN KALDI - Test Bildirimi`;
        alertDescription = `Geçici test için ${daysBeforeDeadline} gün kalan dönemler listelenmiştir.`;
        alertColor = '#2563eb';
      }

      const htmlContent = this.generateProactiveAlertTemplate(companies, alertTitle, alertDescription, alertColor, daysBeforeDeadline, dateStr);
      const subject = `${alertTitle} - ${dateStr}`;

      // ✅ YENİ API: ElectronService.sendEmail kullan (EmailSystem ile uyumlu)
      const result = await ElectronService.sendEmail(
        normalizedEmailConfig,
        [this.config.accountantEmail],
        subject,
        [], // attachments
        htmlContent,
        [] // selectedPeriods (boş)
      );

      if (result?.success) {
        console.log(`✅ ${daysBeforeDeadline} gün uyarısı emaili gönderildi: ${this.config.accountantEmail}`);
      } else {
        console.error('❌ Email gönderilmedi:', result?.error || 'Bilinmeyen hata');
        logService.log('error', 'Email Bildirim', 'Email gonderilemedi', result?.error || 'Bilinmeyen hata');
      }
    } catch (error) {
      console.error('❌ Email gönderme hatası:', error);
      logService.log('error', 'Email Bildirim', 'sendProactiveAlertEmail hata', error);
    }
  }

  private generateProactiveAlertTemplate(companies: CompanyDeadlineInfo[], alertTitle: string, alertDescription: string, alertColor: string, daysBeforeDeadline: number, dateStr: string): string {
    const companyRows = companies.map(c => `<tr style="border-bottom: 1px solid #e0e0e0;"><td style="padding: 12px; text-align: left; font-weight: 500;">${c.name}</td><td style="padding: 12px; text-align: center;">${c.displayPeriod}</td><td style="padding: 12px; text-align: center;">${c.deadlineDate}</td><td style="padding: 12px; text-align: center;"><span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; background: #fef2f2; color: #dc2626;">${c.companyType}</span></td></tr>`).join('');

    const actionBox = daysBeforeDeadline === 7 ? `<div style="background: #eff6ff; border-left: 4px solid #0284c7; padding: 15px; margin: 20px 0; border-radius: 4px; font-size: 13px; color: #0c4a6e;"><strong>💡 Önerilen Aksiyonlar:</strong><ul style="margin: 10px 0 0 0; padding-left: 20px;"><li>Evrakları toplamaya başlayın</li><li>Muhasebe dosyalarını hazırlayın</li><li>İş ortaklarından belgeler isteyin</li><li>E-defter sistemini kontrol edin</li></ul></div>` : daysBeforeDeadline === 1 ? `<div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px; font-size: 13px; color: #7f1d1d; font-weight: 600;"><strong>⚡ ACİL - SON KONTROL ZAMANLARINDA:</strong><ul style="margin: 10px 0 0 0; padding-left: 20px;"><li>Sistem ağırlaşabilir - Önceden test edin</li><li>Teknisyen hazır bulundurun</li><li>İnternet ve sistem ekran görüntüsü alın</li><li>Muhasebe ve YMM arasında iletişimi açık tutun</li></ul></div>` : daysBeforeDeadline === 0 ? `<div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px; font-size: 13px; color: #7f1d1d; font-weight: 600;"><strong>🔴 BUGÜN SON GÜN - HEMEN KONTROL YAPINIZ:</strong><p style="margin: 10px 0 0 0;">${companies.length} şirketin yüklemesi BU GÜN sona ermektedir. <br><strong>Lütfen DERHAL yükleme durumunu kontrol edin!</strong></p></div>` : '';

    return `<!DOCTYPE html><html dir="ltr" lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${alertTitle}</title></head><body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; margin: 0; padding: 0;"><div style="max-width: 900px; margin: 20px auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;"><div style="background: linear-gradient(135deg, ${alertColor} 0%, #ffffff 100%); padding: 30px; color: white; text-align: center; border-bottom: 3px solid ${alertColor};"><h1 style="margin: 0; font-size: 26px; font-weight: 700; color: ${alertColor};">${alertTitle}</h1><p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">${dateStr}</p></div><div style="padding: 30px;"><p style="margin: 0 0 20px 0; color: #333; font-size: 16px; font-weight: 500;">Sayın Mali Müşavir,</p><div style="background: #f0f9ff; border-left: 4px solid ${alertColor}; padding: 15px; margin: 20px 0; border-radius: 4px; font-size: 14px; color: #333; line-height: 1.6;"><strong style="color: ${alertColor};">${alertDescription}</strong></div><div style="margin: 25px 0;"><h3 style="color: ${alertColor}; margin: 0 0 15px 0; font-size: 16px;">📋 İlgili Şirketler (${companies.length})</h3><table style="width: 100%; border-collapse: collapse; font-size: 13px;"><thead><tr style="background: #f3f4f6; border-bottom: 2px solid ${alertColor};"><th style="padding: 12px; text-align: left; font-weight: 600; color: ${alertColor};">Şirket Adı</th><th style="padding: 12px; text-align: center; font-weight: 600; color: ${alertColor};">Yüklenecek Dönem</th><th style="padding: 12px; text-align: center; font-weight: 600; color: ${alertColor};">Son Tarih</th><th style="padding: 12px; text-align: center; font-weight: 600; color: ${alertColor};">Tür</th></tr></thead><tbody>${companyRows}</tbody></table></div>${actionBox}<div style="background: #f3f4f6; border-left: 4px solid #6b7280; padding: 15px; margin: 20px 0; border-radius: 4px; font-size: 12px; color: #374151;"><strong>ℹ️ Bilgi:</strong> Bu email otomatik olarak gönderilmiş olup, lütfen hatalı bilgiler için sisteminizi kontrol ediniz.</div></div><div style="background: #f9fafb; padding: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280;"><p style="margin: 0;">E-Defter Otomasyon Sistemi © 2024</p><p style="margin: 5px 0 0 0; color: #9ca3af;">Proaktif Takip ve Planlama Sistemi</p></div></div></body></html>`;
  }

  destroy() {
    // ✅ GÜVENLE KAPAT: Tüm interval'ları temizle
    this.notificationIntervals.forEach(interval => {
      if (interval) clearTimeout(interval);
    });
    this.notificationIntervals = [];
    
    // Config'i de temizle
    this.config = null;
    
    console.log('🛑 Email bildirimi servisi durduruldu');
  }

  async updateConfig(config: EmailNotificationConfig) {
    try {
      // Önce mevcut servisi durdur
      this.destroy();
      
      // Yeni config'i kaydet
      this.config = config;
      await ElectronService.saveData('email-notification-config', config);
      
      // Yeniden başlat
      if (config.enabled && config.accountantEmail) {
        this.setupScheduler();
        // Ayar kaydinda anlik kontrol yap (test ve dogrulama icin).
        await this.checkAndSendNotifications();
        console.log('✅ Email bildirimi servisi güncellendi:', config.accountantEmail);
      }
    } catch (error) {
      console.error('❌ Email bildirimi config güncelleme hatası:', error);
    }
  }

  isActive(): boolean {
    return this.config?.enabled ?? false;
  }

  getAccountantEmail(): string | null {
    return this.config?.accountantEmail || null;
  }

  // ✅ TEST EMAIL GÖNDER - Email bildirimleri sistemini test et
  async sendTestEmailNotification(accountantEmail: string): Promise<{success: boolean, error?: string}> {
    try {
      console.log('🧪 Test email gönderiliyor:', accountantEmail);

      // GIB verisi yüklenmemiş dönemleri bul
      const companiesResult = await ElectronService.loadData('companies', []);
      const monitoringResult = await ElectronService.loadData('monitoring-data', []);
      const emailConfigResult = await ElectronService.loadData('email-config', null);

      if (!companiesResult.success || !emailConfigResult.success) {
        return { success: false, error: 'Veri yükleme hatası' };
      }

      const companies: Company[] = companiesResult.data?.filter((c: Company) => c.status === 'active') || [];
      const monitoringData = monitoringResult.data || [];
      const emailConfig = emailConfigResult.data;

      // Son 3 gündeki dönemleri kontrol et
      const testPeriods = this.findCompaniesByDeadlineProximity(companies, monitoringData, 3);
      
      if (testPeriods.length === 0) {
        return { success: false, error: 'Test için yüklenmemiş dönem bulunamadı' };
      }

      // Test email gönder
      await this.sendProactiveAlertEmail(testPeriods, 3, emailConfig);
      
      console.log('✅ Test email başarıyla gönderildi');
      return { success: true };
    } catch (error: any) {
      console.error('❌ Test email gönderme hatası:', error);
      return { success: false, error: error.message || 'Test email gönderilemedi' };
    }
  }

  private getAlertLevelText(daysBeforeDeadline: number): string {
    switch (daysBeforeDeadline) {
      case 7: return '📋 7 Gün Öncesi';
      case 3: return '⚠️ 3 Gün Öncesi';
      case 1: return '🚀 1 Gün Öncesi';
      case 0: return '🔴 Son Gün (Bugün)';
      default: return `${daysBeforeDeadline} Gün Uyarısı`;
    }
  }
}

const emailNotificationService = new EmailNotificationService();

export default emailNotificationService;
export { EmailNotificationService };
export type { EmailNotificationConfig, CompanyDeadlineInfo };


