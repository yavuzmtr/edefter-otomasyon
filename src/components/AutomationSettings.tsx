import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Play, 
  Pause,
  CheckCircle,
  AlertCircle,
  Calendar,
  Mail
} from 'lucide-react';
import { ElectronService } from '../services/electronService';

// ✅ SADECE AKTIVASYON: Email gönder mi?
interface EmailAutomationConfig {
  enabled: boolean;  // Otomatik email gönder mi? (Evet/Hayır)
  // Şirket seçimi, email başlığı, vs → E-Posta sayfasında yapılıyor
}

// ✅ SADECE AKTIVASYON: Backup yap mı?
interface BackupAutomationConfig {
  enabled: boolean;  // Otomatik backup yap mı? (Evet/Hayır)
  // Kaynak/hedef yolları → Yedekleme sayfasında yapılıyor
}

interface AutomationSettings {
  enabled: boolean;
  startYear: number;
  startMonth: number;
  checkInterval: number;
  sourcePath: string;
  continuousMonitoring: boolean;    // Dosya sistemi dinleme
  backgroundService: boolean;       // Arka plan servisi (30s)
  
  // ✅ SADECE AKTIVASYON KONTROLLERI
  emailConfig: EmailAutomationConfig;
  backupConfig: BackupAutomationConfig;
}

export const AutomationSettings: React.FC = () => {
  const [automationSettings, setAutomationSettings] = useState<AutomationSettings>({
    enabled: false,
    startYear: new Date().getFullYear(),
    startMonth: new Date().getMonth() + 1,
    checkInterval: 30,
    sourcePath: '',
    continuousMonitoring: true,
    backgroundService: true,
    
    // ✅ SADECE AKTIVASYON
    emailConfig: {
      enabled: false
    },
    
    backupConfig: {
      enabled: false
    }
  });

  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [loading, setLoading] = useState(false);
  const [showStartDateSelection, setShowStartDateSelection] = useState(false);

  const monthNames = [
    '', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 6 }, (_, i) => currentYear - i);

  useEffect(() => {
    loadAutomationSettings();
    
    // ✅ TRAY MENÜSÜNDEN GELEN DEĞİŞİKLİKLERİ DİNLE
    const handleAutomationStateChange = (_event: any, newSettings: AutomationSettings) => {
      console.log('🔄 Tray menüsünden otomasyon durumu değişti:', newSettings);
      setAutomationSettings(newSettings);
      showNotification(
        'success', 
        newSettings.enabled ? '🚀 Sistem Tray\'den Başlatıldı!' : '🛑 Sistem Tray\'den Durduruldu!'
      );
    };
    
    ElectronService.onAutomationStateChanged(handleAutomationStateChange);
    
    return () => {
      // Cleanup
    };
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const loadAutomationSettings = async () => {
    try {
      // Otomasyon ayarlarını yükle
      const result = await ElectronService.loadData('automation-settings', {});
      let loadedSettings = { ...automationSettings };
      
      if (result.success && result.data) {
        // ✅ YENİ: Yeni yapıyla uyumlu yükleme
        loadedSettings = {
          ...automationSettings,
          enabled: result.data.enabled ?? false,
          startYear: result.data.startYear ?? automationSettings.startYear,
          startMonth: result.data.startMonth ?? automationSettings.startMonth,
          checkInterval: result.data.checkInterval ?? 30,
          sourcePath: result.data.sourcePath ?? '',
          continuousMonitoring: result.data.continuousMonitoring ?? true,
          backgroundService: result.data.backgroundService ?? true,
          emailConfig: result.data.emailConfig ?? automationSettings.emailConfig,
          backupConfig: result.data.backupConfig ?? automationSettings.backupConfig
        };
      }

      // Klasör İzleme'den kaynak klasörü al
      const monitoringResult = await ElectronService.loadData('monitoring-settings', {});
      if (monitoringResult.success && monitoringResult.data?.sourcePath) {
        loadedSettings.sourcePath = monitoringResult.data.sourcePath;
      }
      
      setAutomationSettings(loadedSettings);
    } catch (error) {
      console.error('Otomasyon ayarları yüklenirken hata:', error);
    }
  };

  const saveAutomationSettings = async (settings: AutomationSettings) => {
    try {
      await ElectronService.saveData('automation-settings', settings);
      setAutomationSettings(settings);
      showNotification('success', 'Otomasyon ayarları kaydedildi');
    } catch (error) {
      showNotification('error', 'Ayarlar kaydedilirken hata oluştu');
    }
  };

  const updateSetting = async (key: keyof AutomationSettings, value: any) => {
    const newSettings = { ...automationSettings, [key]: value };
    await saveAutomationSettings(newSettings);
  };

  const handleStartDateSelection = async (year: number, month: number) => {
    const newSettings = { ...automationSettings, startYear: year, startMonth: month };
    await saveAutomationSettings(newSettings);
    setShowStartDateSelection(false);
    showNotification('success', `Başlangıç tarihi ${monthNames[month]} ${year} olarak ayarlandı`);
  };

  const toggleAutomation = async () => {
    setLoading(true);
    try {
      // Eğer sourcePath yoksa monitoring-settings'ten yükle
      let sourcePath = automationSettings.sourcePath;
      
      if (!sourcePath) {
        const monitoringResult = await ElectronService.loadData('monitoring-settings', {});
        if (monitoringResult.success && monitoringResult.data?.sourcePath) {
          sourcePath = monitoringResult.data.sourcePath;
          // State'i güncelle
          setAutomationSettings(prev => ({ ...prev, sourcePath }));
        }
      }
      
      if (!sourcePath) {
        showNotification('error', 'Önce "Klasör İzleme" bölümünden GIB kaynak klasörünü seçin');
        setLoading(false);
        return;
      }

      const newEnabled = !automationSettings.enabled;
      const newSettings = { 
        ...automationSettings,
        sourcePath,  // sourcePath'ı kesinlikle kaydet
        enabled: newEnabled,
        backgroundService: true,      // ✅ HER ZAMAN AÇIK
        continuousMonitoring: true     // ✅ HER ZAMAN AÇIK
      };
      await saveAutomationSettings(newSettings);

      if (newEnabled) {
        showNotification('success', '🚀 Sistem Başlatıldı! Her 30 saniyede otomatik kontrol edilecek ve uygun dönemler için email gönderilecek. Bilgisayar yeniden başladığında da otomatik çalışacak.');
      } else {
        showNotification('success', '🛑 Sistem Durduruldu - Otomatik email gönderimi pasif. Bilgisayar başlangıcında çalışmayacak.');
      }
    } catch (error) {
      showNotification('error', 'Otomasyon durumu değiştirilirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-6 py-8 space-y-6 animate-fade-in">
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

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-lg">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🤖 E-Defter Tam Otomasyon</h1>
              <p className="text-gray-600">Tek tuş ile tüm sistemi otomatik hale getirin</p>
            </div>
          </div>
        <div className="flex items-center space-x-6">
          <div className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-lg font-semibold ${
            automationSettings.enabled ? 'bg-green-50 text-green-700 border-2 border-green-200' : 'bg-red-50 text-red-700 border-2 border-red-200'
          }`}>
            <div className={`w-4 h-4 rounded-full ${
              automationSettings.enabled ? 'bg-green-500 animate-pulse' : 'bg-red-400'
            }`}></div>
            <span>{automationSettings.enabled ? '🟢 ÇALIŞIYOR' : '🔴 KAPALI'}</span>
          </div>
          <button
            onClick={toggleAutomation}
            disabled={loading}
            className={`px-8 py-4 rounded-lg transition-all transform hover:scale-105 shadow-lg font-bold text-lg flex items-center space-x-3 ${
              automationSettings.enabled
                ? 'bg-red-600 text-white hover:bg-red-700 hover:shadow-red-300'
                : 'bg-green-600 text-white hover:bg-green-700 hover:shadow-green-300'
            } disabled:bg-gray-400 disabled:transform-none`}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>İŞLENİYOR...</span>
              </>
            ) : automationSettings.enabled ? (
              <>
                <Pause className="w-5 h-5" />
                <span>SİSTEMİ DURDUR</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                <span>SİSTEMİ BAŞLAT</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Otomasyon Özeti */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start space-x-3">
          <CheckCircle className="w-6 h-6 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-blue-900 text-xl mb-3">🎯 Otomatik Sistem Nasıl Çalışır?</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                <div className="flex items-center space-x-2 mb-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <h5 className="font-semibold text-blue-900">Arka Planda Çalışır</h5>
                </div>
                <p className="text-sm text-blue-800">
                  Uygulama açıldığında otomatik başlar, her 30 saniyede kontrol eder
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                <div className="flex items-center space-x-2 mb-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <h5 className="font-semibold text-blue-900">Akıllı Dönem Tespiti</h5>
                </div>
                <p className="text-sm text-blue-800">
                  Başlangıç tarihinden sonraki complete dönemleri otomatik bulur
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                <div className="flex items-center space-x-2 mb-2">
                  <Mail className="w-5 h-5 text-blue-600" />
                  <h5 className="font-semibold text-blue-900">Mükerrer Engelleme</h5>
                </div>
                <p className="text-sm text-blue-800">
                  Gönderilen emailler kaydedilir, aynı dönem tekrar gönderilmez
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Zorunlu Ayarlar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">⚙️ Ayarlar</h3>
        <p className="text-gray-600 mb-6">Otomasyonu başlatmak için gereken minimum ayarlar</p>
        
        <div className="space-y-6">
          {/* Start Date Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📅 Başlangıç Tarihi (İsteğe Bağlı)
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={automationSettings.startYear && automationSettings.startMonth ? 
                  `${monthNames[automationSettings.startMonth]} ${automationSettings.startYear} tarihinden itibaren` : 
                  'Başlangıç tarihi seçilmedi - Tüm tarihler taranacak'}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              />
              <button
                onClick={() => setShowStartDateSelection(true)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2"
              >
                <Calendar className="w-4 h-4" />
                <span>Seç</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              💡 Sistem her 30 saniyede monitoring verilerini kontrol eder ve bu tarihten sonraki <strong>complete</strong> dönemleri otomatik email gönderir.
            </p>
          </div>

          {/* Zorunlu Ayarlar - Kalıcı İzleme */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border-2 border-green-300">
            <h4 className="font-semibold text-green-900 dark:text-white mb-3">🔒 Kalıcı İzleme Ayarları (HER ZAMAN AÇIK)</h4>
            <p className="text-sm text-green-800 mb-3">
              Bu ayarlar, uygulamanın kapalı olsa bile veya bilgisayar yeniden başlatılsa bile çalışması için GEREKLIDIR ve KAPATILMAZ.
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-white p-3 rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <label className="text-sm text-green-900 font-medium">📡 Sürekli Gözetim</label>
                    <p className="text-xs text-green-700">Dosya sistemi değişiklikleri aktif dinleniyyor</p>
                  </div>
                </div>
                <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-bold">
                  ✅ AÇIK
                </div>
              </div>
              
              <div className="flex items-center justify-between bg-white p-3 rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <label className="text-sm text-green-900 font-medium">🔄 Arka Plan Hizmeti</label>
                    <p className="text-xs text-green-700">Uygulama açıldığında otomatik başlar, her 30 saniyede kontrol eder</p>
                  </div>
                </div>
                <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-bold">
                  ✅ AÇIK
                </div>
              </div>
              
              <div className="flex items-center justify-between bg-white p-3 rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  <div>
                    <label className="text-sm text-blue-900 font-medium">💻 Windows Başlangıcı</label>
                    <p className="text-xs text-blue-700">Bilgisayar açıldığında uygulama otomatik başlar</p>
                  </div>
                </div>
                <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-bold">
                  ✅ AÇIK
                </div>
              </div>
            </div>
          </div>

          {/* Otomatik Özellikler */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">🔄 Otomatik İşlemler</h4>
            <p className="text-sm text-gray-600 mb-4">
              Hangi işlemlerin otomatik yapılmasını istediğinizi seçin. Detaylı ayarlar ilgili sayfalarında yapılır.
            </p>
            <div className="space-y-3">
              {/* Email Otomasyonu Checkbox */}
              <div className="border border-blue-200 bg-white p-4 rounded-lg hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="autoEmail"
                      checked={automationSettings.emailConfig?.enabled ?? false}
                      onChange={(e) => updateSetting('emailConfig', { ...automationSettings.emailConfig, enabled: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                    <div>
                      <label htmlFor="autoEmail" className="text-sm font-semibold text-gray-900">
                        📧 Otomatik E-posta Gönderimi
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        Başlangıç tarihinden sonraki complete dönemler için otomatik email gönder
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {automationSettings.emailConfig?.enabled ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        ✅ AÇIK
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                        ⭕ KAPALI
                      </span>
                    )}
                  </div>
                </div>
                {automationSettings.emailConfig?.enabled && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-800">
                      <strong>💡 Not:</strong> SMTP ayarları <strong>"Sistem Ayarları"</strong> sayfasından yapılır. 
                      Sistem monitoring data'dan şirket bilgilerini otomatik alır ve email gönderir.
                    </p>
                  </div>
                )}
              </div>

              {/* Backup Otomasyonu Checkbox */}
              <div className="border border-green-200 bg-white p-4 rounded-lg hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="autoBackup"
                      checked={automationSettings.backupConfig?.enabled ?? false}
                      onChange={(e) => updateSetting('backupConfig', { ...automationSettings.backupConfig, enabled: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                    <div>
                      <label htmlFor="autoBackup" className="text-sm font-semibold text-gray-900">
                        💾 Otomatik Yedekleme
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        Yedekleme işlemlerini otomatik olarak çalıştır
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {automationSettings.backupConfig?.enabled ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        ✅ AÇIK
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                        ⭕ KAPALI
                      </span>
                    )}
                  </div>
                </div>
                {automationSettings.backupConfig?.enabled && (
                  <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-xs text-green-800">
                      <strong>� Not:</strong> Yedekleme ayarları <strong>"Yedekleme"</strong> sayfasından yapılır.
                      Kaynak klasör, hedef klasör ve diğer tüm detaylar orada ayarlanır.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Start Date Selection Modal */}
      {showStartDateSelection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md animate-slide-up">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📅 Başlangıç Tarihi Seçin</h3>
            <p className="text-sm text-gray-600 mb-4">
              Otomasyon sistemi hangi tarihten itibaren GIB dosyalarını kontrol etsin?
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Yıl</label>
                <select
                  value={automationSettings.startYear}
                  onChange={(e) => setAutomationSettings(prev => ({ ...prev, startYear: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ay</label>
                <select
                  value={automationSettings.startMonth}
                  onChange={(e) => setAutomationSettings(prev => ({ ...prev, startMonth: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {monthNames.slice(1).map((month, index) => (
                    <option key={index + 1} value={index + 1}>{month}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="mt-6 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>Seçilen Tarih:</strong> {monthNames[automationSettings.startMonth]} {automationSettings.startYear}
              </p>
              <p className="text-xs text-blue-800 mt-1">
                Bu tarihten itibaren tüm GIB dosyaları kontrol edilecek ve e-posta gönderilecektir.
              </p>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowStartDateSelection(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={() => handleStartDateSelection(automationSettings.startYear, automationSettings.startMonth)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
