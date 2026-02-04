import React, { useState, useEffect } from 'react';
import { 
  FolderOpen, 
  Play, 
  Pause, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  AlertCircle,
  FileText,
  Archive,
  Calendar,
  Building
} from 'lucide-react';
import { ElectronService } from '../services/electronService';
import { logService } from '../services/logService';

interface MonitoringData {
  companyName: string;
  companyId: string;
  year: number;
  month: number;
  folderExists: boolean;
  folderPath?: string;
  requiredFiles: number;
  existingFiles: number;
  missingFiles: number;
  lastCheck: Date;
  status: 'complete' | 'incomplete' | 'missing';
  isUnregistered?: boolean;
  gibFileStatus?: {
    hasKB: boolean;
    hasYB: boolean;
    kbFile?: string;
    ybFile?: string;
  };
}

export const MonitoringSystem: React.FC = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [selectedPath, setSelectedPath] = useState('');
  const [monitoringData, setMonitoringData] = useState<MonitoringData[]>([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCompany, setSelectedCompany] = useState<MonitoringData | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const initializeMonitoring = async () => {
      await loadSettings();
      await loadMonitoringData();
      
      // ✅ YENİ: Şirket sayısını kontrol et
      try {
        const companiesResult = await ElectronService.loadData('companies', []);
        if (companiesResult.success && companiesResult.data) {
          const newCompaniesCount = companiesResult.data.length || 0;
          
          // Eğer şirket sayısı monitoring-data'daki benzersiz şirket sayısından fazlaysa uyar
          if (monitoringData.length > 0) {
            const uniqueCompaniesInMonitoring = [...new Set(monitoringData.map(item => item.companyId))].length;
            if (newCompaniesCount > uniqueCompaniesInMonitoring) {
              console.log('⚠️ Yeni şirketler eklendi! Monitoring System sayfasında görmek için tarama yapın');
              showNotification('success', `${newCompaniesCount - uniqueCompaniesInMonitoring} yeni şirket tespit edildi. Görmek için "Yenile" butonuna tıklayın.`);
            }
          }
        }
      } catch (error) {
        console.warn('Şirket sayısı kontrol hatası:', error);
      }
      
      // ✅ DÜZELTİLDİ: Otomatik path seçimi kaldırıldı - kullanıcı manuel seçmeli
    };
    
    initializeMonitoring();
    
    return () => {
      ElectronService.removeAllListeners('folder-added');
      ElectronService.removeAllListeners('file-added');
      ElectronService.removeAllListeners('trigger-scan');
      ElectronService.removeAllListeners('scan-status-change');
    };
  }, []);

  // ✅ DÜZELTME: isMonitoring değiştiğinde listener'ları temizle ve yeniden kur
  useEffect(() => {
    if (isMonitoring) {
      // İzleme başladığında listener'ları temizle
      ElectronService.removeAllListeners('folder-added');
      ElectronService.removeAllListeners('file-added');
      ElectronService.removeAllListeners('trigger-scan');
      ElectronService.removeAllListeners('scan-status-change');
      
      // Sonra yeniden kur (bu sefer isMonitoring = true olacak)
      setupEventListeners();
    } else {
      // İzleme durdurulduğunda listener'ları temizle
      ElectronService.removeAllListeners('folder-added');
      ElectronService.removeAllListeners('file-added');
      ElectronService.removeAllListeners('trigger-scan');
      ElectronService.removeAllListeners('scan-status-change');
    }
  }, [isMonitoring]);

  const loadSettings = async () => {
    try {
      const result = await ElectronService.loadData('monitoring-settings', {});
      if (result.success && result.data) {
        setSelectedPath(result.data.sourcePath || '');
        setIsMonitoring(result.data.isMonitoring || false);
      }
    } catch (error) {
      console.error('Settings yüklenirken hata:', error);
    }
  };

  const loadMonitoringData = async () => {
    try {
      const result = await ElectronService.loadData('monitoring-data', []);
      if (result.success && result.data && Array.isArray(result.data)) {
        const formattedData = result.data.map((item: any) => ({
          ...item,
          lastCheck: new Date(item.lastCheck)
        }));
        setMonitoringData(formattedData);
      } else {
        setMonitoringData([]);
      }
    } catch (error) {
      console.error('Monitoring data yüklenirken hata:', error);
      setMonitoringData([]);
    }
  };

  const saveSettings = async (settings: any) => {
    try {
      await ElectronService.saveData('monitoring-settings', settings);
    } catch (error) {
      console.error('Settings kaydedilirken hata:', error);
    }
  };

  const setupEventListeners = () => {
    ElectronService.onFolderAdded((_, path) => {
      showNotification('success', `Yeni klasör tespit edildi: ${path}`);
    });

    ElectronService.onFileAdded((_, path) => {
      showNotification('success', `Yeni GIB dosyası tespit edildi: ${path}`);
    });

    // ✅ YENİ: Tarama durumu değişikliğini dinle
    ElectronService.onScanStatusChange((_, data: { scanning: boolean; message: string }) => {
      if (data.scanning) {
        setLoading(true);
        console.log('📊 Tarama başladı:', data.message);
      } else {
        setLoading(false);
        console.log('✅ Tarama tamamlandı:', data.message);
        // Tarama bitince verileri yenile
        loadMonitoringData();
      }
    });

    // ✅ DÜZELTME: trigger-scan dinleyicisini DEBOUNCE ile ekle
    ElectronService.onTriggerScan(async (_) => {
      // ✅ Kaynak klasörü selectedPath veya automation-settings'den al
      let pathToUse = selectedPath;
      
      // ✅ FIX: selectedPath yoksa automation-settings'den yükle
      if (!pathToUse) {
        const settingsResult = await ElectronService.loadData('automation-settings', {});
        if (settingsResult.success && settingsResult.data?.sourcePath) {
          pathToUse = settingsResult.data.sourcePath;
          console.log('📂 trigger-scan: Kaynak klasör automation-settings\'den yüklendi:', pathToUse);
        } else {
          console.warn('⚠️ trigger-scan çağırıldı ama kaynak klasör bulunamadı, işlem yapılmıyor');
          return;
        }
      }
      
      if (pathToUse) {
        console.log('🔄 trigger-scan → refreshData() tetikleniyor (debounced)');
        // ✅ SONSUZ DÖNGÜ DÜZELTMESİ: Debounce ekle
        clearTimeout((window as any).refreshDataTimeout);
        (window as any).refreshDataTimeout = setTimeout(() => {
          refreshData();
        }, 2000); // 2 saniye bekle
      }
    });
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleFolderSelect = async () => {
    try {
      logService.logManualAction('Klasör Seçimi', 'Kullanıcı kaynak klasör seçimi başlattı');
      const folderPath = await ElectronService.selectFolder();
      if (folderPath) {
        setSelectedPath(folderPath);
        await saveSettings({ sourcePath: folderPath, isMonitoring });
        logService.logMonitoringAction('Kaynak Klasör Seçildi', folderPath, 'success');
        showNotification('success', 'Kaynak klasör seçildi');
      }
    } catch (error) {
      logService.logManualAction('Klasör Seçimi', 'Klasör seçilirken hata oluştu', 'error');
      showNotification('error', 'Klasör seçilirken hata oluştu');
    }
  };

  const startMonitoring = async () => {
    if (!selectedPath) {
      logService.logManualAction('İzleme Başlatma', 'Kaynak klasör seçilmeden izleme başlatılmaya çalışıldı', 'error');
      showNotification('error', 'Önce kaynak klasörü seçin');
      return;
    }

    setLoading(true);
    logService.logManualAction('İzleme Başlatma', `${selectedPath} klasörü için izleme başlatılıyor`);
    
    try {
      const result = await ElectronService.startFolderMonitoring(selectedPath, 30);
      if (result.success) {
        setIsMonitoring(true);
        await saveSettings({ sourcePath: selectedPath, isMonitoring: true });
        logService.logMonitoringAction('İzleme Başlatıldı', selectedPath, 'success');
        showNotification('success', 'GIB klasör izleme başlatıldı');
        await refreshData();
      } else {
        logService.logMonitoringAction('İzleme Başlatma Hatası', result.error || 'Bilinmeyen hata', 'error');
        showNotification('error', result.error || 'İzleme başlatılamadı');
      }
    } catch (error) {
      logService.logManualAction('İzleme Başlatma', 'İzleme başlatılırken hata oluştu', 'error');
      showNotification('error', 'İzleme başlatılırken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const stopMonitoring = async () => {
    setLoading(true);
    logService.logManualAction('İzleme Durdurma', 'Kullanıcı izleme durdurma işlemi başlattı');
    
    try {
      // ✅ YENİ: İzleme durdurulmadan önce listener'ları temizle
      ElectronService.removeAllListeners('trigger-scan');
      ElectronService.removeAllListeners('folder-added');
      ElectronService.removeAllListeners('file-added');
      ElectronService.removeAllListeners('scan-status-change');
      
      const result = await ElectronService.stopFolderMonitoring();
      if (result.success) {
        setIsMonitoring(false);
        await saveSettings({ sourcePath: selectedPath, isMonitoring: false });
        logService.logMonitoringAction('İzleme Durduruldu', selectedPath, 'success');
        showNotification('success', 'Klasör izleme durduruldu');
      } else {
        logService.logMonitoringAction('İzleme Durdurma Hatası', result.error || 'Bilinmeyen hata', 'error');
        showNotification('error', result.error || 'İzleme durdurulamadı');
      }
    } catch (error) {
      logService.logManualAction('İzleme Durdurma', 'İzleme durdurulurken hata oluştu', 'error');
      showNotification('error', 'İzleme durdurulurken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    // ✅ FIX: Kaynak klasörü selectedPath veya automation-settings'den al
    let pathToUse = selectedPath;
    
    // ✅ selectedPath yoksa automation-settings'den yükle
    if (!pathToUse) {
      const settingsResult = await ElectronService.loadData('automation-settings', {});
      if (settingsResult.success && settingsResult.data?.sourcePath) {
        pathToUse = settingsResult.data.sourcePath;
        console.log('📂 refreshData: Kaynak klasör automation-settings\'ten yüklendi:', pathToUse);
      } else {
        logService.logManualAction('Veri Yenileme', 'Kaynak klasör bulunamadı', 'error');
        showNotification('error', 'Kaynak klasör ayarlanmamış');
        return;
      }
    }

    setLoading(true);
    logService.logManualAction('Veri Yenileme', `${pathToUse} klasörü için GIB tarama başlatıldı`);
    
    try {
      // ✅ YENİ: Trigger-scan listener'ını geçici olarak deaktive et (recursion önleme)
      // Tarama sırasında file-added event'ler tetiklenmeyecek
      ElectronService.removeAllListeners('trigger-scan');
      
      // Tüm yılları taramak için selectedYear parametresini boş gönder
      const result = await ElectronService.scanFolderStructure(pathToUse, '');
      
      if (result.success && result.data) {
        const formattedData = result.data.map((item: any) => ({
          ...item,
          lastCheck: new Date(item.lastCheck)
        }));
        setMonitoringData(formattedData);
        
        const completeCount = formattedData.filter((item: any) => item.status === 'complete').length;
        const incompleteCount = formattedData.filter((item: any) => item.status === 'incomplete').length;
        const missingCount = formattedData.filter((item: any) => item.status === 'missing').length;
        
        const totalYears = [...new Set(formattedData.map(item => item.year))].length;
        showNotification('success', `GIB kontrol tamamlandı: ${totalYears} yıl, ${completeCount} tamamlanan, ${incompleteCount} eksik, ${missingCount} klasör yok`);
        logService.logMonitoringAction('GIB Tarama Tamamlandı', `${totalYears} yıl, ${completeCount} tamamlanan, ${incompleteCount} eksik, ${missingCount} klasör yok`, 'success');
        
        // ✅ YENİ: Tarama bitince HEMEN email kontrolü yap (saati bekleme)
        if (completeCount > 0) {
          console.log('📧 Tarama tamamlandı, email kontrolü tetikleniyor...');
          ElectronService.triggerEmailCheck().then((result) => {
            if (result.success) {
              console.log('✅ Email kontrolü başarılı:', result.message);
            }
          }).catch((err) => {
            console.error('❌ Email kontrolü hatası:', err);
          });
        }
      } else {
        logService.logMonitoringAction('GIB Tarama Hatası', result.error || 'Bilinmeyen hata', 'error');
        showNotification('error', result.error || 'Veriler güncellenemedi');
      }
    } catch (error) {
      logService.logManualAction('Veri Yenileme', 'Veriler güncellenirken hata oluştu', 'error');
      showNotification('error', 'Veriler güncellenirken hata oluştu');
    } finally {
      setLoading(false);
      // ✅ SONSUZ DÖNGÜ DÜZELTMESİ: trigger-scan listener'ı yeniden ekleme!
      // refreshData() çağırılmaz çünkü bu sonsuz döngü yaratıyor
      // setupEventListeners() zaten tüm listener'ları düzgün şekilde ekler
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'incomplete':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'missing':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'complete':
        return 'Tamamlandı';
      case 'incomplete':
        return 'Eksik Dosya';
      case 'missing':
        return 'Klasör Yok';
      default:
        return 'Beklemede';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'complete':
        return 'bg-green-100 text-green-800';
      case 'incomplete':
        return 'bg-orange-100 text-orange-800';
      case 'missing':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredData = monitoringData.filter(data => {
    const matchesSearch = (data.companyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (data.companyId || '').includes(searchTerm);
    
    let matchesStatus = false;
    if (statusFilter === 'all') {
      matchesStatus = true;
    } else if (statusFilter === 'unregistered') {
      matchesStatus = data.isUnregistered === true;
    } else {
      matchesStatus = data.status === statusFilter;
    }
    
    return matchesSearch && matchesStatus;
  });

  const showCompanyDetails = (company: MonitoringData) => {
    setSelectedCompany(company);
    setShowDetails(true);
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
              <Eye className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">👁️ GIB Klasör İzleme</h1>
              <p className="text-gray-600">E-defter GIB dosyalarını otomatik kontrol edin</p>
            </div>
          </div>
        <div className="flex items-center space-x-2">
          <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
            isMonitoring ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700'
          }`}>
            <div className={`w-3 h-3 rounded-full ${
              isMonitoring ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`}></div>
            <span className="font-medium">
              {isMonitoring ? 'GIB İzleme Aktif' : 'İzleme Pasif'}
            </span>
          </div>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">GIB İzleme Ayarları</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ana Klasör Yolu
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={selectedPath}
                readOnly
                placeholder="GIB dosyalarının bulunduğu ana klasörü seçin..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              />
              <button
                onClick={handleFolderSelect}
                disabled={loading}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 transition-colors flex items-center space-x-2"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Seç</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Klasör yapısı: [Vergi/TC No]/[01.01.YYYY-31.12.YYYY]/[01-12]/GIB-*.zip
            </p>
          </div>
          <div className="flex items-end space-x-3">
            {!isMonitoring ? (
              <button
                onClick={startMonitoring}
                disabled={!selectedPath || loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                <Play className="w-4 h-4" />
                <span>{loading ? 'Başlatılıyor...' : 'İzlemeyi Başlat'}</span>
              </button>
            ) : (
              <button
                onClick={stopMonitoring}
                disabled={loading}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors flex items-center space-x-2"
              >
                <Pause className="w-4 h-4" />
                <span>{loading ? 'Durduruluyor...' : 'İzlemeyi Durdur'}</span>
              </button>
            )}
            <button
              onClick={refreshData}
              disabled={!selectedPath || loading}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition-colors flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Yenile</span>
            </button>
          </div>
        </div>
      </div>

      {/* Unregistered Company Warning */}
      {monitoringData.filter(d => d.isUnregistered).length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-orange-800">Tanımlanmamış Şirketler Bulundu</h3>
              <p className="mt-1 text-sm text-orange-700">
                Yerel klasörlerinizde {monitoringData.filter(d => d.isUnregistered).length} adet tanımlanmamış şirket klasörü bulundu. 
                Bu şirketleri sisteme eklemek için <strong>Şirket Yönetimi</strong> bölümüne gidin.
              </p>
              <div className="mt-2">
                <button
                  onClick={() => setStatusFilter('unregistered')}
                  className="text-sm text-orange-800 underline hover:text-orange-900"
                >
                  Tanımlanmamış şirketleri görüntüle →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-green-600">
                {monitoringData.filter(d => d.status === 'complete').length}
              </p>
              <p className="text-gray-600">Tamamlanan</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-orange-600">
                {monitoringData.filter(d => d.status === 'incomplete').length}
              </p>
              <p className="text-gray-600">Eksik GIB Dosyası</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-red-600">
                {monitoringData.filter(d => d.status === 'missing').length}
              </p>
              <p className="text-gray-600">Klasör Yok</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-orange-600">
                {monitoringData.filter(d => d.isUnregistered).length}
              </p>
              <p className="text-gray-600">Tanımlanmamış</p>
            </div>
            <AlertCircle className="w-8 h-8 text-orange-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {monitoringData.length}
              </p>
              <p className="text-gray-600">Toplam Kontrol</p>
            </div>
            <Building className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Monitoring Results */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">GIB Dosya Kontrol Sonuçları ({filteredData.length} kayıt)</h3>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-gray-200 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">🔍 Ara</label>
            <input
              type="text"
              placeholder="Şirket adı, vergi no, TC no..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">📊 Durum</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="complete">✅ Tamamlanan</option>
              <option value="incomplete">⚠️ Eksik Dosya</option>
              <option value="missing">❌ Klasör Yok</option>
              <option value="unregistered">❓ Tanımlanmamış Şirketler</option>
            </select>
          </div>
        </div>
        
        {filteredData.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Henüz veri yok</h3>
            <p className="text-gray-500 mb-4">
              GIB dosya kontrolü yapmak için:
            </p>
            <ol className="text-sm text-gray-600 text-left max-w-md mx-auto space-y-1">
              <li>1. Şirket Yönetimi → Vergi/TC numaralı şirket ekleyin</li>
              <li>2. Ana klasör yolunu seçin</li>
              <li>3. "Yenile" butonuna tıklayın</li>
            </ol>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Şirket
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dönem
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      KB Dosyası
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      YB Dosyası
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Son Kontrol
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
              </table>
            </div>
            <div className="overflow-x-auto overflow-y-auto max-h-96">
              <table className="w-full">
                <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.map((data, index) => (
                  <tr key={`${data.companyId}-${data.year}-${data.month}-${index}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className={`text-sm font-medium ${data.isUnregistered ? 'text-orange-600' : 'text-gray-900 dark:text-white'}`}>
                          {data.companyName}
                          {data.isUnregistered && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Tanımlanmamış
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                          <span>{data.companyId}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-700">
                            {data.companyId?.length === 10 ? 'VN' : data.companyId?.length === 11 ? 'TC' : '-'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>{data.year}/{data.month.toString().padStart(2, '0')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {data.gibFileStatus?.hasKB ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-green-700">Mevcut</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            <span className="text-sm text-red-700">Eksik</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {data.gibFileStatus?.hasYB ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-green-700">Mevcut</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            <span className="text-sm text-red-700">Eksik</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {data.lastCheck.toLocaleString('tr-TR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClass(data.status)}`}>
                        {getStatusIcon(data.status)}
                        <span className="ml-1">{getStatusText(data.status)}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => showCompanyDetails(data)}
                          className="text-primary-600 hover:text-primary-900 p-1 rounded transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* Company Details Modal */}
      {showDetails && selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl animate-slide-up">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {selectedCompany.companyName} - Detay Bilgileri
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Şirket Adı</label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedCompany.companyName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Vergi/TC No</label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedCompany.companyId}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Dönem</label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {selectedCompany.year}/{selectedCompany.month.toString().padStart(2, '0')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Klasör Durumu</label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {selectedCompany.folderExists ? 'Mevcut' : 'Bulunamadı'}
                  </p>
                </div>
              </div>

              {selectedCompany.folderPath && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Klasör Yolu</label>
                  <p className="text-sm text-gray-900 dark:text-white bg-gray-50 p-2 rounded">
                    {selectedCompany.folderPath}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">GIB Dosya Durumu</label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Archive className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium">KB Dosyası</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {selectedCompany.gibFileStatus?.hasKB ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-green-700">Mevcut</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          <span className="text-sm text-red-700">Eksik</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {selectedCompany.gibFileStatus?.kbFile && (
                    <p className="text-xs text-gray-600 ml-6">
                      Dosya: {selectedCompany.gibFileStatus.kbFile}
                    </p>
                  )}

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Archive className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium">YB Dosyası</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {selectedCompany.gibFileStatus?.hasYB ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-green-700">Mevcut</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          <span className="text-sm text-red-700">Eksik</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {selectedCompany.gibFileStatus?.ybFile && (
                    <p className="text-xs text-gray-600 ml-6">
                      Dosya: {selectedCompany.gibFileStatus.ybFile}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};