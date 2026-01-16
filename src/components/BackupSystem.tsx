import React, { useState, useEffect } from 'react';
import { 
  HardDrive, 
  FolderOpen, 
  Play, 
  Settings,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { ElectronService } from '../services/electronService';
import { logService } from '../services/logService';

interface BackupConfig {
  sourcePath: string;
  destinationPath: string;
  enabled: boolean;
  schedule: 'manual' | 'daily' | 'weekly' | 'monthly';
  lastBackup?: Date;
}

export const BackupSystem: React.FC = () => {
  const [backupConfig, setBackupConfig] = useState<BackupConfig>({
    sourcePath: '',
    destinationPath: '',
    enabled: false,
    schedule: 'daily'
  });

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);

  useEffect(() => {
    loadBackupConfig();

    // ✅ OTOMATİK BACKUP - Background service'in perform-automated-scan event'ini dinle
    const handleAutomatedBackup = async () => {
      try {
        logService.log('info', 'Yedekleme', 'Otomasyon tarafından otomatik backup tetiklendi');
        
        // Otomasyon ve Backup ayarlarını kontrol et
        const automationSettings = await ElectronService.loadData('automation-settings', {});
        const backupSettings = await ElectronService.loadData('backup-config', {});
        
        if (!automationSettings.success || !backupSettings.success) {
          logService.log('error', 'Yedekleme', 'Ayarlar yüklenemedi');
          return;
        }
        
        // Backup otomasyonu açık mı?
        const backupConfigEnabled = automationSettings.data?.backupConfig?.enabled;
        
        if (!backupConfigEnabled) {
          logService.log('info', 'Yedekleme', 'Otomatik yedekleme kapalı');
          return;
        }
        
        // Backup ayarlarından kaynak ve hedef yolları al
        const sourcePath = backupSettings.data?.sourcePath;
        const destinationPath = backupSettings.data?.destinationPath;
        
        // Backup yolları ayarlanmış mı?
        if (!sourcePath || !destinationPath) {
          logService.log('warning', 'Yedekleme', 'Yedekleme sayfasında kaynak veya hedef yolu ayarlanmamış');
          console.warn('⚠️ Otomatik backup: Kaynak veya hedef yolu ayarlanmamış');
          return;
        }
        
        logService.log('info', 'Yedekleme', 'Otomatik yedekleme başlatıldı');
        console.log('📦 Otomatik backup başlatılıyor...');
        setIsBackingUp(true);
        
        // Otomatik backup yap - isAutomated=true parametresi ile
        const result = await ElectronService.backupFiles(sourcePath, destinationPath, true);
        
        if (result?.success) {
          logService.log('success', 'Yedekleme', 'Otomatik yedekleme başarılı');
          console.log('✅ Otomatik backup başarılı');
        } else {
          logService.log('error', 'Yedekleme', 'Otomatik yedekleme başarısız');
          console.error('❌ Otomatik backup hatası:', result?.error);
        }
        
        setIsBackingUp(false);
      } catch (error) {
        logService.log('error', 'Yedekleme', 'Otomatik yedekleme başarısız');
        console.error('❌ Otomatik backup tetikleme hatası:', error);
        setIsBackingUp(false);
      }
    };

    // perform-automated-scan event'ini dinle
    ElectronService.onPerformAutomatedScan(handleAutomatedBackup);

    return () => {
      // Cleanup
    };
  }, []);

  const loadBackupConfig = async () => {
    try {
      const result = await ElectronService.loadData('backup-config', {});
      if (result.success && result.data) {
        setBackupConfig({ ...backupConfig, ...result.data });
      }
    } catch (error) {
      console.error('Backup config yüklenirken hata:', error);
    }
  };

  const saveBackupConfig = async (config: BackupConfig) => {
    try {
      await ElectronService.saveData('backup-config', config);
      setBackupConfig(config);
    } catch (error) {
      console.error('Backup config kaydedilirken hata:', error);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const selectSourceFolder = async () => {
    try {
      const folderPath = await ElectronService.selectFolder();
      if (folderPath) {
        const newConfig = { ...backupConfig, sourcePath: folderPath };
        await saveBackupConfig(newConfig);
        showNotification('success', 'Kaynak klasör seçildi');
      }
    } catch (error) {
      showNotification('error', 'Klasör seçilirken hata oluştu');
    }
  };

  const selectDestinationFolder = async () => {
    try {
      const folderPath = await ElectronService.selectFolder();
      if (folderPath) {
        const newConfig = { ...backupConfig, destinationPath: folderPath };
        await saveBackupConfig(newConfig);
        showNotification('success', 'Hedef klasör seçildi');
      }
    } catch (error) {
      showNotification('error', 'Klasör seçilirken hata oluştu');
    }
  };

  const startBackup = async () => {
    if (!backupConfig.sourcePath || !backupConfig.destinationPath) {
      showNotification('error', 'Kaynak ve hedef klasörleri seçin');
      logService.log('warning', 'Yedekleme', 'Manuel yedekleme: Klasörler seçilmedi');
      return;
    }

    logService.log('info', 'Yedekleme', 'Manuel yedekleme başlatıldı');
    setIsBackingUp(true);
    setBackupProgress(0);

    try {
      // Progress simulation
      const progressInterval = setInterval(() => {
        setBackupProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 10;
        });
      }, 500);

      const result = await ElectronService.backupFiles(backupConfig.sourcePath, backupConfig.destinationPath, false);
      
      clearInterval(progressInterval);
      setBackupProgress(100);

      if (result.success) {
        const statsMessage = result.stats && result.stats.copiedFiles > 0
          ? `✅ Başarılı - ${result.stats.copiedFiles} klasör yedeklendi`
          : '✅ Başarılı - Tüm dosyalar güncel';
        logService.log('success', 'Yedekleme', 'Manuel yedekleme başarılı');
        showNotification('success', statsMessage);
        const updatedConfig = { ...backupConfig, lastBackup: new Date() };
        await saveBackupConfig(updatedConfig);
      } else {
        logService.log('error', 'Yedekleme', 'Manuel yedekleme başarısız');
        showNotification('error', `❌ Başarısız - ${result.error || 'Bilinmeyen hata'}`);
      }
    } catch (error) {
      logService.log('error', 'Yedekleme', 'Manuel yedekleme başarısız');
      showNotification('error', '❌ Başarısız - Yedekleme sırasında hata oluştu');
    } finally {
      setIsBackingUp(false);
      setBackupProgress(0);
    }
  };

  const toggleBackupSchedule = async () => {
    const newConfig = { ...backupConfig, enabled: !backupConfig.enabled };
    await saveBackupConfig(newConfig);
    showNotification('success', `Otomatik yedekleme ${newConfig.enabled ? 'açıldı' : 'kapatıldı'}`);
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
              <HardDrive className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">💾 Yedekleme Sistemi</h1>
              <p className="text-gray-600">E-defter dosyalarınızı güvenli bir şekilde yedekleyin</p>
            </div>
          </div>
        <div className="flex items-center space-x-2">
          <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
            backupConfig.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700'
          }`}>
            <div className={`w-3 h-3 rounded-full ${
              backupConfig.enabled ? 'bg-green-500' : 'bg-gray-400'
            }`}></div>
            <span className="font-medium">
              {backupConfig.enabled ? 'Otomatik Yedekleme Açık' : 'Otomatik Yedekleme Kapalı'}
            </span>
          </div>
        </div>
      </div>

      {/* Backup Configuration */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Yedekleme Ayarları</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kaynak Klasör
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={backupConfig.sourcePath}
                  readOnly
                  placeholder="Yedeklenecek kaynak klasörü seçin..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                />
                <button
                  onClick={selectSourceFolder}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Seç</span>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hedef Klasör
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={backupConfig.destinationPath}
                  readOnly
                  placeholder="Yedeklerin kaydedileceği hedef klasörü seçin..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                />
                <button
                  onClick={selectDestinationFolder}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Seç</span>
                </button>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Yedekleme Zamanlaması
              </label>
              <select
                value={backupConfig.schedule}
                onChange={(e) => {
                  const newConfig = { ...backupConfig, schedule: e.target.value as any };
                  saveBackupConfig(newConfig);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="manual">Manuel</option>
                <option value="daily">Günlük</option>
                <option value="weekly">Haftalık</option>
                <option value="monthly">Aylık</option>
              </select>
            </div>
            <div className="flex items-end space-x-3">
              <button
                onClick={toggleBackupSchedule}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                  backupConfig.enabled
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>{backupConfig.enabled ? 'Otomatik Kapalı' : 'Otomatik Açık'}</span>
              </button>
              {!isBackingUp ? (
                <button
                  onClick={startBackup}
                  disabled={!backupConfig.sourcePath || !backupConfig.destinationPath}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  <Play className="w-4 h-4" />
                  <span>Yedeklemeyi Başlat</span>
                </button>
              ) : (
                <button
                  className="px-6 py-2 bg-orange-600 text-white rounded-lg cursor-not-allowed flex items-center space-x-2"
                  disabled
                >
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Yedekleniyor...</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Backup Progress */}
      {isBackingUp && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Yedekleme İlerlemesi</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">İlerleme: {Math.round(backupProgress)}%</span>
              <span className="text-sm text-gray-600">{Math.round(backupProgress)}% tamamlandı</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary-600 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${backupProgress}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Yedekleme devam ediyor...</span>
              <span>Lütfen bekleyin</span>
            </div>
          </div>
        </div>
      )}

      {/* Backup Activities Report - Hem Manuel Hem Otomasyon */}
      <BackupActivitiesReport />
      </div>
    </div>
  );
};

// Yedekleme Aktiviteleri Raporu Komponenti - Hem Manuel Hem Otomasyon Yedeklemelerini Gösterir
const BackupActivitiesReport: React.FC = () => {
  const [backupActivities, setBackupActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBackupActivities();
  }, []);

  const loadBackupActivities = async () => {
    try {
      setLoading(true);
      const result = await ElectronService.getBackupActivities();
      if (result.success && result.data) {
        // Hem manuel hem otomasyon yedeklemelerini göster
        setBackupActivities(result.data);
      }
    } catch (error) {
      console.error('Yedekleme aktiviteleri yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLevelColor = (level: string) => {
    if (!level) return 'text-gray-600 bg-gray-100 border border-gray-200';
    switch (level.toLowerCase()) {
      case 'success':
        return 'text-green-700 bg-green-100 border border-green-200';
      case 'error':
        return 'text-red-700 bg-red-100 border border-red-200';
      case 'warning':
        return 'text-orange-700 bg-orange-100 border border-orange-200';
      default:
        return 'text-gray-600 bg-gray-100 border border-gray-200';
    }
  };

  const getLevelIcon = (level: string) => {
    if (!level) return <AlertCircle className="w-4 h-4 text-gray-600" />;
    switch (level.toLowerCase()) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getLevelLabel = (level: string) => {
    if (!level) return 'BİLİNMİYOR';
    switch (level.toLowerCase()) {
      case 'success':
        return 'BAŞARILI';
      case 'error':
        return 'BAŞARISIZ';
      case 'warning':
        return 'UYARI';
      default:
        return level.toUpperCase();
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Yedekleme Aktivite Raporları</h3>
          <p className="text-sm text-gray-500 mt-1">Son 7 gün - Başarılı, Başarısız ve Uyarı İçeren İşlemler</p>
        </div>
        <button
          onClick={loadBackupActivities}
          disabled={loading}
          className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition-colors flex items-center space-x-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Yenile</span>
        </button>
      </div>
      
      {backupActivities.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <HardDrive className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium mb-2">Yedekleme Aktivitesi Bulunamadı</p>
          <p className="text-sm">Son 7 gün içinde başarılı, başarısız veya uyarı içeren yedekleme işlemi bulunmuyor</p>
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto max-h-96">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tarih & Saat
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tip
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Durum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İşlem
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {backupActivities.map((activity, index) => (
                <tr key={activity.id || index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {activity.dateStr}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {activity.isAutomated ? (
                      <span className="inline-flex items-center px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-md font-medium">
                        🤖 Otomatik
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-md font-medium">
                        👤 Manuel
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium ${getLevelColor(activity.level)}`}>
                      {getLevelIcon(activity.level)}
                      <span className="ml-2">{getLevelLabel(activity.level)}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {activity.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};