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
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [filteredData, setFilteredData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Tab sistemini kaldırdık, sadece GIB verilerini yükle
  useEffect(() => {
    loadReportData();
  }, []);

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

  // loadSystemReports ve filterActivitiesByCategory artık kullanılmıyor - tab'lar kaldırıldı
  
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
      // Sadece GIB raporu kaldı
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

  // Ana render
  return (
    <div className="w-full px-4 py-4">
      <div className="w-full px-6 py-8 space-y-6 animate-fade-in">
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
          <div className="text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-lg border">
            <div className="font-medium">Rapor Kapsamı</div>
            <div className="text-xs">Filtrelenmiş: {Array.isArray(filteredData) ? filteredData.length : 0} / Toplam: {Array.isArray(reportData) ? reportData.length : 0} kayıt</div>
          </div>
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

      {/* Report Header - Tek sekme, tab'lar kaldırıldı */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">GIB Dosya Kontrolleri</h2>
            </div>
          </div>
        </div>
      </div>

      {/* GIB Content - Tab'lar kaldırıldı, sadece GIB içeriği */}
      <div className="space-y-6">
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
        </div>
      </div>
    </div>
  );
};

