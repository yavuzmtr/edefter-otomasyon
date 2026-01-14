import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Trash2, 
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Database,
  FolderOpen,
  RefreshCw,
  Palette,
  Monitor,
  Sun,
  Moon,
  Mail,
  Clock,
  User
} from 'lucide-react';
import { ElectronService } from '../services/electronService';
import { useTheme, Theme } from '../contexts/ThemeContext';
import emailNotificationService from '../services/emailNotificationService';

interface EmailNotificationConfig {
  accountantEmail: string;
  enabled: boolean;
  sendAtMorning: boolean;
  sendAtEvening: boolean;
  alertDays: number[];
}

export const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const { theme, setTheme } = useTheme();
  const [emailNotificationConfig, setEmailNotificationConfig] = useState<EmailNotificationConfig>({
    accountantEmail: '',
    enabled: false,
    sendAtMorning: true,
    sendAtEvening: true,
    alertDays: [7, 3, 1, 0]
  });


  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Email notification ayarlarını yükle
  useEffect(() => {
    const loadEmailNotificationConfig = async () => {
      try {
        const result = await ElectronService.loadData('email-notification-config', null);
        if (result.success && result.data) {
          const loadedConfig = result.data as EmailNotificationConfig;
          // Güvenli config yükleme - eksik alanları varsayılan değerlerle doldur
          setEmailNotificationConfig({
            accountantEmail: loadedConfig.accountantEmail || '',
            enabled: loadedConfig.enabled || false,
            sendAtMorning: loadedConfig.sendAtMorning !== undefined ? loadedConfig.sendAtMorning : true,
            sendAtEvening: loadedConfig.sendAtEvening !== undefined ? loadedConfig.sendAtEvening : true,
            alertDays: Array.isArray(loadedConfig.alertDays) ? loadedConfig.alertDays : [7, 3, 1, 0]
          });
        }
      } catch (error) {
        console.error('Email notification config yükleme hatası:', error);
      }
    };
    
    loadEmailNotificationConfig();
  }, []);

  const themes: { id: Theme; name: string; description: string; colors: string[] }[] = [
    {
      id: 'light',
      name: 'Açık Tema',
      description: 'Klasik beyaz tema',
      colors: ['#ffffff', '#f8fafc', '#3b82f6', '#10b981']
    },
    {
      id: 'dark',
      name: 'Koyu Tema',
      description: 'Göz dostu koyu tema',
      colors: ['#1f2937', '#111827', '#60a5fa', '#34d399']
    },
    {
      id: 'blue',
      name: 'Mavi Tema',
      description: 'Profesyonel mavi tonları',
      colors: ['#eff6ff', '#dbeafe', '#2563eb', '#1d4ed8']
    },
    {
      id: 'green',
      name: 'Yeşil Tema',
      description: 'Doğal yeşil tonları',
      colors: ['#ecfdf5', '#d1fae5', '#059669', '#047857']
    },
    {
      id: 'purple',
      name: 'Mor Tema',
      description: 'Yaratıcı mor tonları',
      colors: ['#faf5ff', '#e9d5ff', '#7c3aed', '#5b21b6']
    }
  ];

    const resetData = async () => {
    setLoading(true);
    try {
      // Tüm verileri sıfırla
      const dataKeys = [
        'companies',
        'monitoring-data', 
        'monitoring-settings',
        'email-config',
        'email-history',
        'email-notification-config',
        'backup-config',
        'backup-history',
        'automation-settings',
        'activity-logs',
        'ignored-companies'
      ];

      for (const key of dataKeys) {
        await ElectronService.saveData(key, key === 'companies' ? [] : {});
      }

      showNotification('success', 'Tüm veriler başarıyla temizlendi!');
      setShowResetModal(false);
    } catch (error: any) {
      showNotification('error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Email notification ayarlarını kaydet
  const saveEmailNotificationConfig = async () => {
    try {
      setLoading(true);
      
      // Validasyon
      if (emailNotificationConfig.enabled && !emailNotificationConfig.accountantEmail) {
        showNotification('error', 'Mali müşavir email adresini girin');
        return;
      }

      // Veritabanına kaydet
      await ElectronService.saveData('email-notification-config', emailNotificationConfig);
      
      // Servisi güncelle
      await emailNotificationService.updateConfig(emailNotificationConfig);
      
      showNotification('success', 'Email notification ayarları kaydedildi ve sistem güncellendi');
    } catch (error: any) {
      console.error('❌ Email notification config kayıt hatası:', error);
      showNotification('error', `Hata: ${error?.message || 'Bilinmeyen hata'}`);
    } finally {
      setLoading(false);
    }
  };

  // ✅ TEST EMAIL GÖNDER - Sistem test et
  const sendTestEmailNotification = async () => {
    try {
      setLoading(true);
      
      // Validasyon
      if (!emailNotificationConfig.accountantEmail) {
        showNotification('error', 'Mali müşavir email adresini girin');
        return;
      }

      console.log('📧 Test email gönderiliyor:', emailNotificationConfig.accountantEmail);

      // ElectronService vasıtasıyla test email gönder
      const result = await ElectronService.sendTestEmailNotification(emailNotificationConfig.accountantEmail);
      
      if (result.success) {
        showNotification('success', `Test email başarıyla gönderildi: ${emailNotificationConfig.accountantEmail}`);
        console.log('✅ Test email gönderildi:', result);
      } else {
        showNotification('error', `Email gönderilemedi: ${result.error}`);
        console.error('❌ Test email hatası:', result.error);
      }
    } catch (error: any) {
      console.error('❌ Test email gönder hatası:', error);
      showNotification('error', `Hata: ${error?.message || 'Test email gönderilemedi'}`);
    } finally {
      setLoading(false);
    }
  };

  // Bildirim yönetimi
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Tam temizlik (uninstaller benzeri)
  const fullCleanup = async () => {
    setLoading(true);
    try {
      // Tüm verileri sıfırla (kaynak klasör dahil)
      const dataKeys = [
        'companies',
        'monitoring-data', 
        'monitoring-settings',
        'email-config',
        'email-history',
        'email-notification-config',
        'backup-config',
        'backup-history',
        'automation-settings',
        'activity-logs',
        'ignored-companies'
      ];

      for (const key of dataKeys) {
        await ElectronService.saveData(key, key === 'companies' ? [] : {});
      }

      showNotification('success', 'Tam veri temizliği tamamlandı.');
      setShowResetModal(false);
    } catch (error) {
      showNotification('error', 'Tam temizlik sırasında hata oluştu');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
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
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">⚙️ Sistem Ayarları</h1>
              <p className="text-gray-600 dark:text-gray-300">Uygulama ayarlarını yönetin ve sistem verilerini sıfırlayın</p>
            </div>
          </div>
        </div>

      {/* System Information */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sistem Bilgileri</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Uygulama Versiyonu</label>
            <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 p-2 rounded">v1.0.0</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Çalışma Ortamı</label>
            <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 p-2 rounded">
              {ElectronService.isElectron() ? 'Electron (Desktop)' : 'Web Browser'}
            </p>
          </div>
        </div>
      </div>

      {/* Theme Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Palette className="w-5 h-5 mr-2" />
          Program Temaları
        </h3>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Uygulamanın görünümünü kişiselleştirin. Seçilen tema tüm sayfalarda uygulanır.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {themes.map((themeOption) => (
            <div
              key={themeOption.id}
              onClick={() => {
                setTheme(themeOption.id);
                showNotification('success', `${themeOption.name} uygulandı`);
              }}
              className={`p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-md ${
                theme === themeOption.id
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900 dark:text-white">{themeOption.name}</h4>
                {theme === themeOption.id && (
                  <CheckCircle className="w-5 h-5 text-primary-600" />
                )}
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{themeOption.description}</p>
              
              <div className="flex space-x-2">
                {themeOption.colors.map((color, index) => (
                  <div
                    key={index}
                    className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-600"
                    style={{ backgroundColor: color }}
                  ></div>
                ))}
              </div>
              
              <div className="mt-3 flex items-center text-xs text-gray-500 dark:text-gray-400">
                {themeOption.id === 'light' && <Sun className="w-4 h-4 mr-1" />}
                {themeOption.id === 'dark' && <Moon className="w-4 h-4 mr-1" />}
                {!['light', 'dark'].includes(themeOption.id) && <Monitor className="w-4 h-4 mr-1" />}
                <span>
                  {theme === themeOption.id ? 'Aktif tema' : 'Seçmek için tıklayın'}
                </span>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <Palette className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">Tema Özellikleri</h4>
              <ul className="text-sm text-blue-800 mt-2 space-y-1">
                <li>• <strong>Açık Tema:</strong> Klasik beyaz arka plan, kolay okunabilir</li>
                <li>• <strong>Koyu Tema:</strong> Göz yorgunluğunu azaltır, gece kullanımı için ideal</li>
                <li>• <strong>Renkli Temalar:</strong> Farklı renk paletleri ile kişiselleştirme</li>
                <li>• <strong>Otomatik Kayıt:</strong> Seçiminiz otomatik olarak kaydedilir</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Email Notification Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
          <Mail className="w-5 h-5 mr-2 text-blue-600" />
          Otomatik Email Bildirimleri
        </h3>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Mali müşavire yüklenmemiş dönemleri sabah ve akşam 6'da otomatik olarak mail gönder.
        </p>

        <div className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-200">Otomatik Bildirimleri Etkinleştir</h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">Sistem belirtilen saatlerde otomatik uyarı gönderecek</p>
              </div>
            </div>
            <button
              onClick={() => {
                setEmailNotificationConfig(prev => ({ ...prev, enabled: !prev.enabled }));
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                emailNotificationConfig.enabled
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
              }`}
            >
              {emailNotificationConfig.enabled ? 'Açık' : 'Kapalı'}
            </button>
          </div>

          {/* Mali Müşavir Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
              <User className="w-4 h-4 mr-2" />
              Mali Müşavir Email Adresi
            </label>
            <input
              type="email"
              value={emailNotificationConfig.accountantEmail}
              onChange={(e) => setEmailNotificationConfig(prev => ({ ...prev, accountantEmail: e.target.value }))}
              placeholder="muhasebeci@example.com"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={!emailNotificationConfig.enabled}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Uyarı emaillerinin gönderileceği email adresi
            </p>
          </div>

          {/* Morning Notification */}
          <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
            <div className="flex items-center space-x-3">
              <Clock className="w-5 h-5 text-yellow-600" />
              <div>
                <h4 className="font-medium text-yellow-900 dark:text-yellow-200">Sabah 6'da Uyarı Gönder</h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">06:00 civarında kontrol yapılacak</p>
              </div>
            </div>
            <button
              onClick={() => {
                setEmailNotificationConfig(prev => ({ ...prev, sendAtMorning: !prev.sendAtMorning }));
              }}
              disabled={!emailNotificationConfig.enabled}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                emailNotificationConfig.sendAtMorning && emailNotificationConfig.enabled
                  ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400 disabled:bg-gray-300'
              }`}
            >
              {emailNotificationConfig.sendAtMorning ? 'Açık' : 'Kapalı'}
            </button>
          </div>

          {/* Evening Notification */}
          <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
            <div className="flex items-center space-x-3">
              <Clock className="w-5 h-5 text-purple-600" />
              <div>
                <h4 className="font-medium text-purple-900 dark:text-purple-200">Akşam 6'da Uyarı Gönder</h4>
                <p className="text-sm text-purple-700 dark:text-purple-300">18:00 civarında kontrol yapılacak</p>
              </div>
            </div>
            <button
              onClick={() => {
                setEmailNotificationConfig(prev => ({ ...prev, sendAtEvening: !prev.sendAtEvening }));
              }}
              disabled={!emailNotificationConfig.enabled}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                emailNotificationConfig.sendAtEvening && emailNotificationConfig.enabled
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400 disabled:bg-gray-300'
              }`}
            >
              {emailNotificationConfig.sendAtEvening ? 'Açık' : 'Kapalı'}
            </button>
          </div>

          {/* Uyarı Seçenekleri */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">📅 Uyarı Zamanları (Proaktif Planlama)</label>
            <div className="space-y-2">
              <label className="flex items-center p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition">
                <input
                  type="checkbox"
                  checked={Array.isArray(emailNotificationConfig.alertDays) && emailNotificationConfig.alertDays.includes(7)}
                  onChange={(e) => {
                    const currentAlertDays = Array.isArray(emailNotificationConfig.alertDays) ? emailNotificationConfig.alertDays : [7, 3, 1, 0];
                    const newAlertDays = e.target.checked
                      ? [...currentAlertDays, 7].sort((a, b) => b - a)
                      : currentAlertDays.filter(d => d !== 7);
                    setEmailNotificationConfig(prev => ({ ...prev, alertDays: newAlertDays }));
                  }}
                  disabled={!emailNotificationConfig.enabled}
                  className="w-4 h-4 rounded"
                />
                <div className="ml-3">
                  <p className="font-medium text-gray-900 dark:text-white">📋 7 Gün Öncesi</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Planlama aşaması - Evrakları toplama ve hazırlık</p>
                </div>
              </label>

              <label className="flex items-center p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition">
                <input
                  type="checkbox"
                  checked={Array.isArray(emailNotificationConfig.alertDays) && emailNotificationConfig.alertDays.includes(3)}
                  onChange={(e) => {
                    const currentAlertDays = Array.isArray(emailNotificationConfig.alertDays) ? emailNotificationConfig.alertDays : [7, 3, 1, 0];
                    const newAlertDays = e.target.checked
                      ? [...currentAlertDays, 3].sort((a, b) => b - a)
                      : currentAlertDays.filter(d => d !== 3);
                    setEmailNotificationConfig(prev => ({ ...prev, alertDays: newAlertDays }));
                  }}
                  disabled={!emailNotificationConfig.enabled}
                  className="w-4 h-4 rounded"
                />
                <div className="ml-3">
                  <p className="font-medium text-gray-900 dark:text-white">⚠️ 3 Gün Öncesi</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Hazırlık tamamlanmalı - Son kontrolleri yapma</p>
                </div>
              </label>

              <label className="flex items-center p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 transition">
                <input
                  type="checkbox"
                  checked={Array.isArray(emailNotificationConfig.alertDays) && emailNotificationConfig.alertDays.includes(1)}
                  onChange={(e) => {
                    const currentAlertDays = Array.isArray(emailNotificationConfig.alertDays) ? emailNotificationConfig.alertDays : [7, 3, 1, 0];
                    const newAlertDays = e.target.checked
                      ? [...currentAlertDays, 1].sort((a, b) => b - a)
                      : currentAlertDays.filter(d => d !== 1);
                    setEmailNotificationConfig(prev => ({ ...prev, alertDays: newAlertDays }));
                  }}
                  disabled={!emailNotificationConfig.enabled}
                  className="w-4 h-4 rounded"
                />
                <div className="ml-3">
                  <p className="font-medium text-gray-900 dark:text-white">🚀 1 Gün Öncesi (Yarım Gün)</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Son kontrol zamanı - Aciliyet uyarısı</p>
                </div>
              </label>

              <label className="flex items-center p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition">
                <input
                  type="checkbox"
                  checked={Array.isArray(emailNotificationConfig.alertDays) && emailNotificationConfig.alertDays.includes(0)}
                  onChange={(e) => {
                    const currentAlertDays = Array.isArray(emailNotificationConfig.alertDays) ? emailNotificationConfig.alertDays : [7, 3, 1, 0];
                    const newAlertDays = e.target.checked
                      ? [...currentAlertDays, 0].sort((a, b) => b - a)
                      : currentAlertDays.filter(d => d !== 0);
                    setEmailNotificationConfig(prev => ({ ...prev, alertDays: newAlertDays }));
                  }}
                  disabled={!emailNotificationConfig.enabled}
                  className="w-4 h-4 rounded"
                />
                <div className="ml-3">
                  <p className="font-medium text-gray-900 dark:text-white">🔴 Son Gün (Bugün - 0 Gün)</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Net rapor - Yüklenenler / Yüklenmeyenler listesi</p>
                </div>
              </label>
            </div>
          </div>

          {/* Info Box */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900">ℹ️ Çoklu Aşamalı Uyarı Sistemi</h4>
                <ul className="text-sm text-blue-800 mt-2 space-y-1">
                  <li>• <strong>7 Gün Öncesi:</strong> Planlama aşaması - Evrakları toplayıp hazırlama</li>
                  <li>• <strong>3 Gün Öncesi:</strong> Hazırlık tamamlanmalı - Son kontrolleri yapma</li>
                  <li>• <strong>1 Gün Öncesi:</strong> Aciliyet uyarısı - Sistem ağırlaşabileceği uyarısı</li>
                  <li>• <strong>Son Gün:</strong> Net rapor - Yüklenen ve yüklenmemiş şirketler</li>
                  <li>• Sistem sabah 6 ve akşam 6'da otomatik kontrol yapıp bildirim gönderir</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              İptal
            </button>
            <button
              onClick={sendTestEmailNotification}
              disabled={loading || !emailNotificationConfig.accountantEmail}
              className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 transition-colors flex items-center space-x-2"
              title="Test email göndererek sistemi test et"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Gönderiliyor...</span>
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  <span>Test Email Gönder</span>
                </>
              )}
            </button>
            <button
              onClick={saveEmailNotificationConfig}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Kaydediliyor...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Ayarları Kaydet</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Veri Yönetimi</h3>
        
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-900">Veri Sıfırlama</h4>
                <p className="text-sm text-yellow-800 mt-1">
                  Bu işlem aşağıdaki verileri kalıcı olarak silecektir:
                </p>
                <ul className="text-sm text-yellow-800 mt-2 list-disc list-inside space-y-1">
                  <li>Tüm şirket kayıtları</li>
                  <li>GIB dosya kontrol sonuçları</li>
                  <li>E-posta ayarları ve geçmişi</li>
                  <li>Yedekleme ayarları ve geçmişi</li>
                  <li>Otomasyon ayarları</li>
                  <li>Seçilen çalışma yılı</li>
                </ul>
                <p className="text-sm text-yellow-800 mt-2 font-medium">
                  ⚠️ Kaynak klasör ayarı korunacaktır.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setShowResetModal(true)}
              disabled={loading}
              className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-400 transition-colors flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Kısmi Sıfırlama</span>
            </button>
            <button
              onClick={fullCleanup}
              disabled={loading}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Tam Temizlik</span>
            </button>
          </div>
        </div>
      </div>

      {/* Storage Information */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Depolama Bilgileri</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Database className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-blue-900 dark:text-blue-300">Şirket Verileri</p>
            <p className="text-xs text-blue-700 dark:text-blue-400">JSON formatında</p>
          </div>
          <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <FolderOpen className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-green-900 dark:text-green-300">Dosya İzleme</p>
            <p className="text-xs text-green-700 dark:text-green-400">Gerçek zamanlı</p>
          </div>
          <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <Settings className="w-8 h-8 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-purple-900 dark:text-purple-300">Sistem Ayarları</p>
            <p className="text-xs text-purple-700 dark:text-purple-400">Yerel depolama</p>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md animate-slide-up">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Veri Sıfırlama Onayı</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Bu işlem geri alınamaz!</p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                Aşağıdaki veriler <strong>kalıcı olarak silinecektir</strong>:
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <ul className="text-sm text-red-800 space-y-1">
                  <li>• Tüm şirket kayıtları ve bilgileri</li>
                  <li>• GIB dosya kontrol sonuçları</li>
                  <li>• E-posta ayarları ve gönderim geçmişi</li>
                  <li>• Yedekleme ayarları ve geçmişi</li>
                  <li>• Otomasyon kuralları ve ayarları</li>
                  <li>• Seçilen çalışma yılı bilgisi</li>
                </ul>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                <p className="text-sm text-green-800">
                  <strong>Korunacak:</strong> Kaynak klasör yolu ayarı
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowResetModal(false)}
                disabled={loading}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:text-gray-400 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={resetData}
                disabled={loading}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sıfırlanıyor...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Evet, Sıfırla</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}



      </div>
    </div>
  );
};