import { ElectronService } from './electronService';
import { Company } from '../types';

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

class EmailNotificationService {
  private config: EmailNotificationConfig | null = null;
  private notificationIntervals: NodeJS.Timeout[] = [];

  async initialize() {
    try {
      const configResult = await ElectronService.loadData('email-notification-config', null);
      if (configResult.success && configResult.data) {
        this.config = configResult.data as EmailNotificationConfig;
        if (this.config.enabled && this.config.accountantEmail) {
          this.setupScheduler();
          console.log('✅ Email bildirimi servisi başlatıldı:', this.config.accountantEmail);
        }
      }
    } catch (error) {
      console.error('❌ Email bildirimi servisi başlatma hatası:', error);
    }
  }

  private setupScheduler() {
    if (!this.config || !this.config.enabled) return;
    if (this.config.sendAtMorning) this.scheduleCheck(6);
    if (this.config.sendAtEvening) this.scheduleCheck(18);
  }

  private scheduleCheck(targetHour: number) {
    const checkAndSend = async () => {
      try {
        const now = new Date();
        const currentHour = now.getHours();
        if (Math.abs(currentHour - targetHour) <= 1) {
          console.log(`⏰ Email bildirim kontrolü yapılıyor (${targetHour}:00)...`);
          await this.checkAndSendNotifications();
        }
      } catch (error) {
        console.error('❌ Zamanlı kontrol hatası:', error);
      }
      
      // ✅ GÜVENLE: Sadece servis aktifse devam et
      if (this.config?.enabled) {
        const interval = setTimeout(checkAndSend, 10 * 60 * 1000); // 10 dakika
        this.notificationIntervals.push(interval);
      }
    };
    checkAndSend();
  }

  async checkAndSendNotifications() {
    try {
      if (!this.config || !this.config.accountantEmail || !this.config.enabled) {
        console.log('⏭️ Email bildirimi devre dışı');
        return;
      }

      const companiesResult = await ElectronService.loadData('companies', []);
      const monitoringResult = await ElectronService.loadData('monitoring-data', []);
      const emailConfigResult = await ElectronService.loadData('email-config', null);

      if (!companiesResult.success || !emailConfigResult.success) {
        console.error('❌ Veri yükleme hatası');
        return;
      }

      const companies: Company[] = companiesResult.data?.filter((c: Company) => c.status === 'active') || [];
      const monitoringData = monitoringResult.data || [];
      const emailConfig = emailConfigResult.data;
      const alertDays = this.config.alertDays || [7, 3, 1, 0];

      for (const daysBeforeDeadline of alertDays) {
        const companiesByAlert = this.findCompaniesByDeadlineProximity(companies, monitoringData, daysBeforeDeadline);
        if (companiesByAlert.length > 0) {
          console.log(`📧 ${daysBeforeDeadline} gün uyarısı - ${companiesByAlert.length} şirkete bildirim gönderiliyor...`);
          await this.sendProactiveAlertEmail(companiesByAlert, daysBeforeDeadline, emailConfig);
        }
      }
    } catch (error) {
      console.error('❌ Email bildirimi gönderme hatası:', error);
    }
  }

  private findCompaniesByDeadlineProximity(
    companies: Company[],
    monitoringData: any[],
    daysBeforeDeadline: number
  ): CompanyDeadlineInfo[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const companiesList: CompanyDeadlineInfo[] = [];

    for (const company of companies) {
      if (!company.email) continue;
      const compId = company.tcNumber || company.taxNumber;
      if (!compId) continue;

      const uploads = monitoringData
        .filter((r: any) => r.companyId === compId && r.status === 'complete')
        .map((r: any) => ({ month: r.month, year: r.year }));

      if (uploads.length === 0) continue;
      const lastUpload = uploads.sort((a: any, b: any) => b.year - a.year || b.month - a.month)[0];
      if (!lastUpload) continue;

      const deadline = this.calculateDeadline(lastUpload.month, lastUpload.year, company.companyType || 'kurumlar-vergisi', company.reportingPeriod || 'aylık');
      if (!deadline) continue;

      const deadlineCopy = new Date(deadline);
      deadlineCopy.setHours(0, 0, 0, 0);
      const daysUntilDeadline = Math.ceil((deadlineCopy.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilDeadline !== daysBeforeDeadline) continue;

      let nextMonth = lastUpload.month;
      let nextYear = lastUpload.year;

      if (company.reportingPeriod === 'aylık') {
        nextMonth = lastUpload.month + 1;
        if (nextMonth > 12) { nextMonth = 1; nextYear += 1; }
      } else {
        if (nextMonth >= 1 && nextMonth <= 3) nextMonth = 4;
        else if (nextMonth >= 4 && nextMonth <= 6) nextMonth = 7;
        else if (nextMonth >= 7 && nextMonth <= 9) nextMonth = 10;
        else if (nextMonth >= 10 && nextMonth <= 12) { nextMonth = 1; nextYear += 1; }
      }

      const displayMonth = nextMonth;
      companiesList.push({
        name: company.name,
        email: company.email,
        displayPeriod: company.reportingPeriod === 'aylık' 
          ? `${MONTH_NAMES[displayMonth - 1]} ${nextYear}`
          : (() => {
            let quarterMonths: number[] = [];
            if (displayMonth >= 1 && displayMonth <= 3) quarterMonths = [1, 2, 3];
            else if (displayMonth >= 4 && displayMonth <= 6) quarterMonths = [4, 5, 6];
            else if (displayMonth >= 7 && displayMonth <= 9) quarterMonths = [7, 8, 9];
            else if (displayMonth >= 10 && displayMonth <= 12) quarterMonths = [10, 11, 12];
            const monthNames = quarterMonths.map(m => MONTH_NAMES[m - 1]).join('-');
            return `${monthNames} ${nextYear}`;
          })(),
        deadlineDate: deadline.toLocaleDateString('tr-TR'),
        remainingDays: daysUntilDeadline,
        status: daysUntilDeadline < 0 ? 'overdue' : (daysUntilDeadline <= 3 ? 'due-soon' : 'pending'),
        companyType: company.companyType === 'gelir-vergisi' ? '💰 Gelir Vergisi' : '🏢 Kurumlar Vergisi',
        reportingPeriod: company.reportingPeriod === 'aylık' ? 'Aylık' : '3 Aylık'
      });
    }
    return companiesList;
  }

  private calculateDeadline(month: number, year: number, companyType: string, period: string): Date | null {
    const day = companyType === 'gelir-vergisi' ? 10 : 14;
    let nextMonth = period === 'aylık' ? month + 1 : month + 3;
    let nextYear = year;
    if (nextMonth > 12) {
      nextMonth = nextMonth - 12;
      nextYear = year + 1;
    }
    return new Date(nextYear, nextMonth - 1, day);
  }

  private async sendProactiveAlertEmail(companies: CompanyDeadlineInfo[], daysBeforeDeadline: number, emailConfig: any) {
    try {
      if (!emailConfig || !this.config) {
        console.error('❌ Email yapılandırması eksik');
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
      }

      const htmlContent = this.generateProactiveAlertTemplate(companies, alertTitle, alertDescription, alertColor, daysBeforeDeadline, dateStr);
      const subject = `${alertTitle} - ${dateStr}`;

      // ✅ YENİ API: ElectronService.sendEmail kullan (EmailSystem ile uyumlu)
      const result = await ElectronService.sendEmail(
        emailConfig,
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
      }
    } catch (error) {
      console.error('❌ Email gönderme hatası:', error);
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
}

const emailNotificationService = new EmailNotificationService();

export default emailNotificationService;
export { EmailNotificationService };
export type { EmailNotificationConfig, CompanyDeadlineInfo };
