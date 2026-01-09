import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Search,
  AlertCircle,
  Building,
  Archive,
  Activity,
  Clock,
  BarChart3,
  Mail,
  RefreshCw
} from 'lucide-react';
import { ElectronService } from '../services/electronService';

interface ReportData {
  company: string;
  taxNumber: string;
  period: string;
  totalFiles: number;
  existingFiles: number;
  missingFiles: number;
  status: 'complete' | 'incomplete' | 'missing';
  lastUpdate: string;
  year: number;
  month: number;
  originalTaxNumber?: string;
  originalTcNumber?: string;
  gibFileStatus?: {
    hasKB: boolean;
    hasYB: boolean;
    kbFile?: string;
    ybFile?: string;
  };
}

export const ReportSystem: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [reportType, setReportType] = useState('gib-summary');
  const [activeReportTab, setActiveReportTab] = useState('gib');
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [filteredData, setFilteredData] = useState<ReportData[]>([]);
  const [systemReports, setSystemReports] = useState<any[]>([]);
  const [activityFilter, setActivityFilter] = useState('all');
  const [activitySearch, setActivitySearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // ✅ GIB tab'ı açıldığında rapor verilerini yükle
    if (activeReportTab === 'gib') {
      loadReportData();
    }
    // ✅ Sistem/Email tab'ları açıldığında sistem raporlarını yükle
    else if (activeReportTab === 'system' || activeReportTab === 'email') {
      loadSystemReports();
      // Eğer system/email'den GIB'a geçince reportData'yı temizle ki karışmasın
      setReportData([]);
      setFilteredData([]);
    }
  }, [activeReportTab]);

  useEffect(() => {
    filterData();
  }, [reportData, reportType, selectedYear, selectedMonth, searchTerm]);

  const loadReportData = async () => {
    try {
      const result = await ElectronService.loadData('monitoring-data', []);
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        const formattedData: ReportData[] = result.data.map((item: any) => ({
          company: item.companyName,
          // Öncelik: TC varsa göster (11 hane), yoksa Vergi göster (10 hane)
          taxNumber: item.originalTcNumber || item.originalTaxNumber || item.companyId,
          period: `${item.year}/${item.month.toString().padStart(2, '0')}`,
          totalFiles: item.requiredFiles || 2,
          existingFiles: item.existingFiles || 0,
          missingFiles: (item.requiredFiles || 2) - (item.existingFiles || 0),
          status: item.status,
          lastUpdate: new Date(item.lastCheck).toLocaleDateString('tr-TR'),
          year: item.year,
          month: item.month,
          originalTaxNumber: item.originalTaxNumber,
          originalTcNumber: item.originalTcNumber,
          gibFileStatus: item.gibFileStatus
        }));
        setReportData(formattedData);
      } else {
        setReportData([]);
      }
    } catch (error) {
      console.error('Report data yüklenirken hata:', error);
      setReportData([]);
    }
  };

  const loadSystemReports = useCallback(async () => {
    try {
      setLoading(true);
      
      // ✅ CRITICAL FIX: E-posta raporları için DOĞRU endpoint kullan
      const [systemResult, emailResult] = await Promise.all([
        ElectronService.getSystemActivities(), // Genel sistem aktiviteleri  
        ElectronService.getEmailActivities()    // ✅ E-posta aktiviteleri - DOĞRU endpoint!
      ]);
      
      let allActivities = [];
      
      // Sistem aktivitelerini ekle
      if (systemResult?.success && Array.isArray(systemResult.data)) {
        const systemData = systemResult.data.slice(-300).map((report, index) => ({
          id: report.id || `system-${Date.now()}-${index}`,
          category: report.category || 'Sistem',
          message: report.message || 'Mesaj yok',
          details: report.details || '',
          level: report.level || 'info',
          dateStr: report.dateStr || 'Tarih bilinmiyor',
          date: report.date || new Date(),
          source: report.source || 'system'
        }));
        allActivities.push(...systemData);
      }
      
      // ✅ E-posta aktivitelerini ekle - DOĞRU VERİ KAYNAĞI!
      if (emailResult?.success && Array.isArray(emailResult.data)) {
        const emailData = emailResult.data.map((activity, index) => ({
          id: activity.id || `email-${Date.now()}-${index}`,
          category: 'E-posta', // ✅ Sabit kategori - filtering için önemli
          message: activity.operation || activity.message || 'E-posta işlemi',
          details: activity.details || activity.message || '',
          level: activity.level || (activity.status === 'Başarılı' ? 'success' : 
                                  activity.status === 'Başarısız' ? 'error' : 'info'),
          dateStr: `${activity.date || ''} ${activity.time || ''}`.trim() || 'Tarih bilinmiyor',
          date: activity.timestamp ? new Date(activity.timestamp) : new Date(),
          source: 'email',
          // E-posta specific alanlar
          operation: activity.operation,
          status: activity.status,
          isToday: activity.isToday || false
        }));
        allActivities.push(...emailData);
      }
      
      // Tarihe göre sırala (en yeni en üstte)
      allActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setSystemReports(allActivities);
      
      console.log(`✅ Raporlar yüklendi: ${allActivities.length} toplam (E-posta: ${emailResult?.data?.length || 0})`);
      
    } catch (error) {
      console.error('Raporlar yükleme hatası:', error);
      setSystemReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const filterData = () => {
    let filtered = [...reportData];

    if (searchTerm) {
      filtered = filtered.filter(data => 
        (data.company || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (data.taxNumber || '').toString().includes(searchTerm)
      );
    }

    if (selectedYear !== 'all') {
      filtered = filtered.filter(data => data.year === parseInt(selectedYear));
    }

    if (selectedMonth !== 'all') {
      filtered = filtered.filter(data => data.month === parseInt(selectedMonth));
    }

    if (reportType === 'gib-complete') {
      filtered = filtered.filter(data => data.status === 'complete');
    } else if (reportType === 'gib-missing') {
      filtered = filtered.filter(data => data.status === 'incomplete' || data.status === 'missing');
    } else if (reportType === 'gib-missing-kb') {
      filtered = filtered.filter(data => !data.gibFileStatus?.hasKB);
    } else if (reportType === 'gib-missing-yb') {
      filtered = filtered.filter(data => !data.gibFileStatus?.hasYB);
    }

    setFilteredData(filtered);
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      if (activeReportTab === 'gib') {
        // GIB Raporu
        if (filteredData.length === 0) {
          showNotification('error', 'Rapor oluşturmak için önce Klasör İzleme menüsünden GIB taraması yapın');
          return;
        }
        
        // Excel veri formatına dönüştür (başlık satırı + veri satırları)
        const headerRow = ['Şirket Adı', 'Vergi/TC No', 'Yıl', 'Ay', 'Dönem', 'KB Dosyası', 'KB Dosya Adı', 'YB Dosyası', 'YB Dosya Adı', 'Durum', 'Son Güncelleme'];
        const excelData = [
          headerRow,
          ...(Array.isArray(filteredData) ? filteredData : []).map(item => [
            item.company || '',
            item.taxNumber || '',
            item.year || '',
            item.month.toString().padStart(2, '0') || '',
            item.period || '',
            item.gibFileStatus?.hasKB ? 'Mevcut' : 'Eksik',
            item.gibFileStatus?.kbFile || 'Dosya bulunamadı',
            item.gibFileStatus?.hasYB ? 'Mevcut' : 'Eksik',
            item.gibFileStatus?.ybFile || 'Dosya bulunamadı',
            item.status === 'complete' ? 'Tamamlandı' : item.status === 'incomplete' ? 'Eksik Dosya' : 'Klasör/Dosya Yok',
            item.lastUpdate || ''
          ])
        ];
        
        const reportResult = await ElectronService.generateDetailedGIBReport(excelData, '', {
          totalRecords: reportData.length,
          filteredRecords: filteredData.length,
          filters: { year: selectedYear, month: selectedMonth, type: reportType, search: searchTerm }
        });
        
        if (reportResult.success) {
          showNotification('success', `GIB raporu oluşturuldu (${filteredData.length} kayıt)`);
        } else {
          showNotification('error', 'Rapor oluşturulamadı');
        }
      } else if (activeReportTab === 'email') {
        // E-posta Raporu
        if (systemReports.length === 0) {
          showNotification('error', 'Rapor için yeterli veri yok');
          return;
        }
        
        // E-posta aktivitelerini filtrele
        const emailActivities = filterActivitiesByCategory(systemReports, 'email');
        
        if (emailActivities.length === 0) {
          showNotification('error', 'E-posta aktivitesi bulunamadı');
          return;
        }
        
        // generateActivitiesReport kendi dosya seçim dialogunu açar
        const reportResult = await ElectronService.generateActivitiesReport(emailActivities, { 
          category: 'email',
          reportType: 'E-posta Aktiviteleri'
        }, 'E-Posta_Raporu');
        
        if (reportResult.success) {
          showNotification('success', `E-posta raporu oluşturuldu (${emailActivities.length} aktivite)`);
        } else {
          showNotification('error', reportResult.error || 'E-posta raporu oluşturulamadı');
        }
      } else if (activeReportTab === 'system') {
        // Sistem Aktiviteleri Raporu
        if (systemReports.length === 0) {
          showNotification('error', 'Rapor için yeterli veri yok');
          return;
        }
        
        // Kategori ve arama filtrelerini uygula
        let filteredActivities = filterActivitiesByCategory(systemReports, activityFilter);
        if (activitySearch) {
          filteredActivities = filteredActivities.filter(activity => 
            (activity.message || '').toLowerCase().includes(activitySearch.toLowerCase()) ||
            (activity.category || '').toLowerCase().includes(activitySearch.toLowerCase()) ||
            (activity.details || '').toLowerCase().includes(activitySearch.toLowerCase())
          );
        }
        
        if (filteredActivities.length === 0) {
          showNotification('error', 'Filtrelenen kriterlere uygun aktivite bulunamadı');
          return;
        }
        
        // generateActivitiesReport kendi dosya seçim dialogunu açar
        const reportResult = await ElectronService.generateActivitiesReport(filteredActivities, { 
          category: activityFilter,
          search: activitySearch,
          reportType: 'Sistem Aktiviteleri'
        }, 'Sistem_Aktiviteleri_Raporu');
        
        if (reportResult.success) {
          showNotification('success', `Sistem aktiviteleri raporu oluşturuldu (${filteredActivities.length} aktivite)`);
        } else {
          showNotification('error', reportResult.error || 'Sistem aktiviteleri raporu oluşturulamadı');
        }
      }
    } catch (error) {
      showNotification('error', 'Rapor oluşturulurken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'incomplete': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'missing': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'complete': return 'Tamamlandı';
      case 'incomplete': return 'Eksik Dosya';
      case 'missing': return 'Klasör/Dosya Yok';
      default: return 'Bilinmiyor';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'complete': return 'bg-green-100 text-green-800';
      case 'incomplete': return 'bg-orange-100 text-orange-800';
      case 'missing': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Data - Memoized for performance
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const years = useMemo(() => Array.from({ length: 5 }, (_, i) => currentYear - i), [currentYear]);
  const months = useMemo(() => [
    { value: 'all', label: 'Tüm Aylar' },
    { value: '1', label: 'Ocak' }, { value: '2', label: 'Şubat' }, { value: '3', label: 'Mart' },
    { value: '4', label: 'Nisan' }, { value: '5', label: 'Mayıs' }, { value: '6', label: 'Haziran' },
    { value: '7', label: 'Temmuz' }, { value: '8', label: 'Ağustos' }, { value: '9', label: 'Eylül' },
    { value: '10', label: 'Ekim' }, { value: '11', label: 'Kasım' }, { value: '12', label: 'Aralık' }
  ], []);

  // Kategori filtreleme fonksiyonu - Optimize edildi
  const filterActivitiesByCategory = useCallback((activities: any[], filter: string) => {
    if (filter === 'all') return activities;
    
    // Performans için sadece gerekli aktiviteleri filtrele, büyük dizilerde slice kullan
    const maxItems = 1000; // Maksimum işlenecek aktivite sayısı
    const activitiesToProcess = activities.length > maxItems ? activities.slice(-maxItems) : activities;
    
    return activitiesToProcess.filter(activity => {
      // Null/undefined kontrolleri optimize edildi
      if (!activity || !activity.category) return false;
      
      const categoryLower = activity.category.toLowerCase();
      const messageLower = (activity.message || '').toLowerCase();
      
      switch (filter) {
        case 'email':
          return categoryLower.includes('e-posta') || categoryLower.includes('email') || categoryLower.includes('mail');
        case 'manual':
          return categoryLower.includes('manuel') || messageLower.includes('manuel') || 
                 categoryLower.includes('kullanıcı') || messageLower.includes('kullanıcı');
        case 'backup':
          return categoryLower.includes('yedek') || categoryLower.includes('backup') || 
                 categoryLower.includes('zip') || messageLower.includes('zip');
        case 'monitoring':
          return categoryLower.includes('izleme') || categoryLower.includes('monitor') || 
                 categoryLower.includes('tarama') || messageLower.includes('tarama');
        case 'company':
          return categoryLower.includes('şirket') || categoryLower.includes('company') || 
                 messageLower.includes('şirket');
        case 'system':
          return categoryLower.includes('sistem') || categoryLower.includes('system');
        default:
          return true;
      }
    });
  }, []);

  // Ana render
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
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">📊 Raporlama Sistemi</h1>
              <p className="text-gray-600">GIB dosya kontrolleri ve sistem aktivitelerini analiz edin</p>
            </div>
          </div>
        <div className="flex items-center space-x-3">
          {activeReportTab === 'gib' && (
            <div className="text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-lg border">
              <div className="font-medium">Rapor Kapsamı</div>
              <div className="text-xs">Filtrelenmiş: {Array.isArray(filteredData) ? filteredData.length : 0} / Toplam: {Array.isArray(reportData) ? reportData.length : 0} kayıt</div>
            </div>
          )}
          <button
            onClick={generateReport}
            disabled={loading}
            className="bg-secondary-600 text-white px-4 py-2 rounded-lg hover:bg-secondary-700 disabled:bg-gray-400 transition-colors flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>{loading ? 'Oluşturuluyor...' : 'Excel İndir'}</span>
          </button>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveReportTab('gib')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeReportTab === 'gib'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4" />
                <span>GIB Dosya Kontrolleri</span>
              </div>
            </button>
            <button
              onClick={() => setActiveReportTab('email')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeReportTab === 'email'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4" />
                <span>E-posta Raporları</span>
              </div>
            </button>
            <button
              onClick={() => setActiveReportTab('system')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeReportTab === 'system'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4" />
                <span>Tüm Aktiviteler</span>
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeReportTab === 'gib' && (
        <>
          {/* GIB Filter Panel */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">GIB Rapor Filtreleri</h3>
              <div className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                ✅ Excel raporu filtrelenmiş veriyi içerir
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Yıl</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">Tüm Yıllar</option>
                  {years.map((year) => (
                    <option key={year} value={year.toString()}>{year}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ay</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {months.map((month) => (
                    <option key={month.value} value={month.value}>{month.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rapor Türü</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="gib-summary">Tüm Kayıtlar</option>
                  <option value="gib-complete">Tamamlanan</option>
                  <option value="gib-missing">Eksik/Yok</option>
                  <option value="gib-missing-kb">Eksik KB</option>
                  <option value="gib-missing-yb">Eksik YB</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Arama</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Şirket ara..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* GIB Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    {Array.isArray(filteredData) ? [...new Set(filteredData.map(d => d?.taxNumber).filter(Boolean))].length : 0}
                  </p>
                  <p className="text-gray-600">Şirket</p>
                </div>
                <Building className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {Array.isArray(filteredData) ? filteredData.filter(d => d?.status === 'complete').length : 0}
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
                    {Array.isArray(filteredData) ? filteredData.filter(d => d?.status === 'incomplete').length : 0}
                  </p>
                  <p className="text-gray-600">Eksik Dosya</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-orange-500" />
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-red-600">
                    {Array.isArray(filteredData) ? filteredData.filter(d => d?.status === 'missing').length : 0}
                  </p>
                  <p className="text-gray-600">Klasör Yok</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-purple-600">{Array.isArray(filteredData) ? filteredData.length : 0}</p>
                  <p className="text-gray-600">Toplam Kayıt</p>
                </div>
                <Archive className="w-8 h-8 text-purple-500" />
              </div>
            </div>
          </div>

          {/* GIB Report Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Detaylı GIB Raporu ({Array.isArray(filteredData) ? filteredData.length : 0} kayıt)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1400px]">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Şirket</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dönem</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">GIB Dosya Durumu</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tamamlanma</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Son Güncelleme</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                  </tr>
                </thead>
              </table>
            </div>
            <div className="overflow-x-auto overflow-y-auto max-h-96">
              <table className="w-full min-w-[1400px]">
                <tbody className="bg-white divide-y divide-gray-200">
                  {(Array.isArray(filteredData) ? filteredData : []).map((data, index) => {
                    const completionRate = data.totalFiles > 0 ? Math.round((data.existingFiles / data.totalFiles) * 100) : 0;
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{data.company}</div>
                          <div className="text-sm text-gray-500 flex items-center gap-2">
                            <span>{data.taxNumber}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-700">
                              {data.taxNumber?.length === 10 ? 'VN' : data.taxNumber?.length === 11 ? 'TC' : '-'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-sm">{data.period}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 min-w-[300px]">
                          <div className="space-y-3">
                            {/* KB Dosyası Detayı */}
                            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                              <div className="flex items-center space-x-2 mb-2">
                                {data.gibFileStatus?.hasKB ? (
                                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                ) : (
                                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                )}
                                <span className="text-xs font-medium">
                                  KB Dosyası
                                </span>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  data.gibFileStatus?.hasKB ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {data.gibFileStatus?.hasKB ? 'Mevcut' : 'Eksik'}
                                </span>
                              </div>
                              {data.gibFileStatus?.hasKB && data.gibFileStatus?.kbFile && (
                                <div className="text-xs text-gray-600 bg-white p-2 rounded border break-all">
                                  <strong>Dosya:</strong> {data.gibFileStatus.kbFile}
                                </div>
                              )}
                              {!data.gibFileStatus?.hasKB && (
                                <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                                  ❌ Dosya bulunamadı
                                </div>
                              )}
                            </div>
                            
                            {/* YB Dosyası Detayı */}
                            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                              <div className="flex items-center space-x-2 mb-2">
                                {data.gibFileStatus?.hasYB ? (
                                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                ) : (
                                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                )}
                                <span className="text-xs font-medium">
                                  YB Dosyası
                                </span>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  data.gibFileStatus?.hasYB ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {data.gibFileStatus?.hasYB ? 'Mevcut' : 'Eksik'}
                                </span>
                              </div>
                              {data.gibFileStatus?.hasYB && data.gibFileStatus?.ybFile && (
                                <div className="text-xs text-gray-600 bg-white p-2 rounded border break-all">
                                  <strong>Dosya:</strong> {data.gibFileStatus.ybFile}
                                </div>
                              )}
                              {!data.gibFileStatus?.hasYB && (
                                <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                                  ❌ Dosya bulunamadı
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div 
                                className={`h-2 rounded-full ${completionRate === 100 ? 'bg-green-500' : completionRate > 50 ? 'bg-orange-500' : 'bg-red-500'}`}
                                style={{ width: `${completionRate}%` }}
                              ></div>
                            </div>
                            <span className="text-sm">{completionRate}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">{data.lastUpdate}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClass(data.status)}`}>
                            {getStatusIcon(data.status)}
                            <span className="ml-1">{getStatusText(data.status)}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* EMAIL TAB */}
      {activeReportTab === 'email' && (
        <div className="space-y-6">
          {/* Header Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                  <Mail className="w-5 h-5 text-blue-500" />
                  <span>📧 E-posta Gönderim Raporları</span>
                </h3>
                <p className="text-sm text-gray-500 mt-1">Manuel ve otomatik e-posta gönderimlerinin detaylı raporı - Başarılı/Başarısız durumunu izleyin</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <button
                onClick={loadSystemReports}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center space-x-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span>{loading ? 'Yükleniyor...' : 'Yenile'}</span>
              </button>
              <button
                onClick={generateReport}
                disabled={loading}
                className="bg-secondary-600 text-white px-4 py-2 rounded-lg hover:bg-secondary-700 disabled:bg-gray-400 transition-colors flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>{loading ? 'Oluşturuluyor...' : 'Excel İndir'}</span>
              </button>
            </div>
          </div>

          {/* Email Activities Content */}
          {(() => {
            const emailActivities = filterActivitiesByCategory(systemReports, 'email');
            
            if (emailActivities.length === 0) {
              return (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
                  <div className="text-center">
                    <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Henüz e-posta aktivitesi yok</h3>
                    <p className="text-gray-500">E-posta gönderimleriniz burada görünecek</p>
                  </div>
                </div>
              );
            }

            const successCount = emailActivities.filter(a => a.level === 'success').length;
            const errorCount = emailActivities.filter(a => a.level === 'error').length;
            const successRate = emailActivities.length > 0 ? ((successCount / emailActivities.length) * 100).toFixed(1) : 0;

            return (
              <div className="space-y-6">
                {/* E-posta İstatistikleri Kartları */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-blue-600">{emailActivities.length}</p>
                        <p className="text-gray-600 text-sm">Toplam İşlem</p>
                      </div>
                      <Mail className="w-8 h-8 text-blue-500" />
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-green-600">{successCount}</p>
                        <p className="text-gray-600 text-sm">Başarılı</p>
                      </div>
                      <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-red-600">{errorCount}</p>
                        <p className="text-gray-600 text-sm">Başarısız</p>
                      </div>
                      <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-orange-600">{successRate}%</p>
                        <p className="text-gray-600 text-sm">Başarı Oranı</p>
                      </div>
                      <BarChart3 className="w-8 h-8 text-orange-500" />
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-purple-600">
                          {emailActivities.filter(a => {
                            try {
                              return a.date && new Date(a.date).toDateString() === new Date().toDateString();
                            } catch { return false; }
                          }).length}
                        </p>
                        <p className="text-gray-600 text-sm">Bugün</p>
                      </div>
                      <Clock className="w-8 h-8 text-purple-500" />
                    </div>
                  </div>
                </div>

                {/* E-posta Aktiviteleri Tablosu */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Detaylı E-posta Aktiviteleri ({emailActivities.length} aktivite)
                    </h3>
                  </div>
                  <div className="overflow-x-auto overflow-y-auto max-h-96">
                    <table className="w-full">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih & Saat</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlem</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detaylar</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {emailActivities.map((activity, index) => (
                          <tr key={activity.id || index} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {activity.dateStr || 'Tarih yok'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium ${
                                activity.level === 'success' ? 'text-green-700 bg-green-100 border border-green-200' :
                                activity.level === 'error' ? 'text-red-700 bg-red-100 border border-red-200' :
                                'text-blue-700 bg-blue-100 border border-blue-200'
                              }`}>
                                {activity.level === 'success' ? '✅ Başarılı' : 
                                 activity.level === 'error' ? '❌ Başarısız' : '📧 Bilgi'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-sm truncate">
                              {activity.message || 'Mesaj yok'}
                            </td>
                            <td className="px-6 py-4 text-sm max-w-sm">
                              {activity.details ? (
                                <span className={`${activity.level === 'error' ? 'text-red-600' : 'text-gray-600'} break-words`}>
                                  {activity.details.substring(0, 100)}
                                  {activity.details.length > 100 ? '...' : ''}
                                </span>
                              ) : (
                                <span className="text-gray-400 italic">Detay yok</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* SYSTEM TAB - Yeniden tasarlandı */}
      {activeReportTab === 'system' && (
        <div className="space-y-6">
          {/* Filtreler */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">🔧 Sistem Aktiviteleri</h3>
              <button
                onClick={loadSystemReports}
                disabled={loading}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 transition-colors flex items-center space-x-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Activity className="w-4 h-4" />
                )}
                <span>{loading ? 'Yükleniyor...' : 'Yenile'}</span>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Aktivite Türü</label>
                <select
                  value={activityFilter}
                  onChange={(e) => setActivityFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">🔍 Tüm Aktiviteler</option>
                  <option value="email">📧 E-posta İşlemleri</option>
                  <option value="manual">👤 Manuel İşlemler</option>
                  <option value="backup">💾 Yedekleme İşlemleri</option>
                  <option value="monitoring">🔍 İzleme İşlemleri</option>
                  <option value="company">🏢 Şirket İşlemleri</option>
                  <option value="system">⚙️ Sistem İşlemleri</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Arama</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Aktivite ara..."
                    value={activitySearch}
                    onChange={(e) => setActivitySearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* İçerik */}
          {(() => {
            let filteredActivities = filterActivitiesByCategory(systemReports, activityFilter);
            
            // Arama filtresi
            if (activitySearch) {
              filteredActivities = filteredActivities.filter(activity => {
                const searchLower = activitySearch.toLowerCase();
                return (
                  String(activity.message || '').toLowerCase().includes(searchLower) ||
                  String(activity.details || '').toLowerCase().includes(searchLower) ||
                  String(activity.category || '').toLowerCase().includes(searchLower)
                );
              });
            }

            if (filteredActivities.length === 0) {
              return (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
                  <div className="text-center">
                    <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      {systemReports.length === 0 ? 'Henüz sistem aktivitesi yok' : 'Filtreye uygun aktivite bulunamadı'}
                    </h3>
                    <p className="text-gray-500">
                      {systemReports.length === 0 ? 'Sistem kullanıldıkça aktiviteler burada görünecek' : 'Farklı filtre seçenekleri deneyin'}
                    </p>
                  </div>
                </div>
              );
            }

            // Kategori bazında gruplama
            const groupedActivities = filteredActivities.reduce((groups: any, activity) => {
              const category = activity.category || 'Diğer';
              if (!groups[category]) {
                groups[category] = [];
              }
              groups[category].push(activity);
              return groups;
            }, {});

            return (
              <div className="space-y-6">
                {/* Özet İstatistikler */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-700">{filteredActivities.length}</div>
                      <div className="text-sm text-blue-600">Toplam Aktivite</div>
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-700">
                        {filteredActivities.filter(a => a.level === 'success').length}
                      </div>
                      <div className="text-sm text-green-600">Başarılı</div>
                    </div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-700">
                        {filteredActivities.filter(a => a.level === 'error').length}
                      </div>
                      <div className="text-sm text-red-600">Hatalı</div>
                    </div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-700">
                        {Object.keys(groupedActivities).length}
                      </div>
                      <div className="text-sm text-orange-600">Kategori</div>
                    </div>
                  </div>
                </div>

                {/* Gruplu Aktiviteler */}
                <div className="space-y-6">
                  {Object.entries(groupedActivities).map(([category, activities]: [string, any]) => (
                    <div key={category} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                          <Activity className="w-5 h-5 text-blue-500" />
                          <span>{category}</span>
                          <span className="bg-gray-100 text-gray-700 text-sm px-2 py-1 rounded-full">
                            {activities.length}
                          </span>
                        </h4>
                      </div>
                      
                      <div className="space-y-3">
                        {/* Performans için maksimum 5 aktivite göster */}
                        {activities.slice(0, 5).map((activity: any, index: number) => (
                          <div key={activity.id || `${category}-${index}`} className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start space-x-3">
                              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                                activity.level === 'success' ? 'bg-green-500' :
                                activity.level === 'error' ? 'bg-red-500' :
                                activity.level === 'warning' ? 'bg-orange-500' : 'bg-blue-500'
                              }`}></div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    activity.level === 'success' ? 'bg-green-100 text-green-800' :
                                    activity.level === 'error' ? 'bg-red-100 text-red-800' :
                                    activity.level === 'warning' ? 'bg-orange-100 text-orange-800' :
                                    'bg-blue-100 text-blue-800'
                                  }`}>
                                    {activity.level === 'success' ? 'Başarılı' : 
                                     activity.level === 'error' ? 'Hata' : 
                                     activity.level === 'warning' ? 'Uyarı' : 'Bilgi'}
                                  </span>
                                  <span className="text-xs text-gray-500 flex items-center">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {activity.dateStr}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-900 dark:text-white mb-1">{activity.message}</p>
                                {activity.details && activity.details.length > 0 && (
                                  <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                    {activity.details.length > 100 ? `${activity.details.substring(0, 100)}...` : activity.details}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {activities.length > 5 && (
                          <div className="text-center py-2">
                            <span className="text-sm text-gray-500">
                              Son {activities.length} aktiviteden 5 tanesi gösteriliyor
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
      </div>
    </div>
  );
};
