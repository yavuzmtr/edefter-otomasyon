import React, { useState, useEffect } from 'react';
import { 
  Users, 
  AlertTriangle,
  CheckCircle, 
  TrendingUp
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ElectronService } from '../services/electronService';
import { logService } from '../services/logService';

interface MonitoringItem {
  status: 'complete' | 'incomplete' | 'missing';
  companyName: string;
  companyId?: string;
  year: number;
  month: number;
  lastCheck: string | Date;
  folderExists?: boolean;
  requiredFiles?: number;
  existingFiles?: number;
  missingFiles?: number;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalCompanies: 0,
    completedFolders: 0,
    missingFiles: 0,
    lastScan: 'Henüz tarama yapılmadı'
  });

  const [trialInfo, setTrialInfo] = useState<{
    isDemo: boolean;
    daysLeft: number;
    expiryDate: string;
    isExpired: boolean;
  } | null>(null);

  const [pieData, setPieData] = useState([
    { name: 'Tamamlanan', value: 0, color: '#059669' },
    { name: 'Eksik Dosya', value: 0, color: '#ea580c' },
    { name: 'Beklemede', value: 0, color: '#6b7280' }
  ]);

  const [barData, setBarData] = useState([
    { month: 'Oca', complete: 0, missing: 0 },
    { month: 'Şub', complete: 0, missing: 0 },
    { month: 'Mar', complete: 0, missing: 0 },
    { month: 'Nis', complete: 0, missing: 0 },
    { month: 'May', complete: 0, missing: 0 },
    { month: 'Haz', complete: 0, missing: 0 },
    { month: 'Tem', complete: 0, missing: 0 },
    { month: 'Ağu', complete: 0, missing: 0 },
    { month: 'Eyl', complete: 0, missing: 0 },
    { month: 'Eki', complete: 0, missing: 0 },
    { month: 'Kas', complete: 0, missing: 0 },
    { month: 'Ara', complete: 0, missing: 0 }
  ]);

  useEffect(() => {
    loadDashboardData();
    loadTrialInfo();
    logService.logSystemAction('Dashboard Yüklendi', 'Kontrol paneli açıldı', 'info');
  }, []);

  const loadTrialInfo = async () => {
    try {
      console.log('🔍 Trial bilgisi yükleniyor...');
      const result = await ElectronService.checkTrialStatus();
      console.log('📊 Trial result:', result);
      if (result.success && result.trialInfo) {
        console.log('✅ Trial info set ediliyor:', result.trialInfo);
        setTrialInfo(result.trialInfo);
      } else {
        console.warn('⚠️ Trial bilgisi alınamadı:', result);
      }
    } catch (error) {
      console.error('❌ Trial bilgisi yükleme hatası:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      // Şirket verilerini yükle
      const companiesResult = await ElectronService.loadData('companies', []);
      if (companiesResult.success) {
        const activeCompanies = (companiesResult.data || []).filter((company: any) => company.status === 'active');
        setStats(prev => ({ ...prev, totalCompanies: activeCompanies.length }));
      }

      // Monitoring verilerini yükle
      const monitoringResult = await ElectronService.loadData('monitoring-data', []);
      
      if (monitoringResult.success) {
        const monitoringData: MonitoringItem[] = Array.isArray(monitoringResult.data) ? monitoringResult.data : [];
        
        const completed = monitoringData.filter(item => item.status === 'complete').length;
        const missing = monitoringData.filter(item => item.status === 'missing' || item.status === 'incomplete').length;
        const total = monitoringData.length;

        // En son tarama zamanını bul
        let lastScanText = 'Henüz tarama yapılmadı';
        if (monitoringData.length > 0) {
          const latestScan = monitoringData.reduce<string | Date | null>((latest, item) => {
            if (item.lastCheck) {
              const checkTime = new Date(item.lastCheck);
              const latestTime = latest ? new Date(latest as string | Date) : new Date(0);
              return checkTime > latestTime ? item.lastCheck : latest;
            }
            return latest;
          }, null);
          
          if (latestScan) {
            // Tarih formatı: DD.MM.YYYY HH:MM:SS
            const date = new Date(latestScan);
            lastScanText = date.toLocaleString('tr-TR');
          }
        }

        setStats(prev => ({
          ...prev,
          completedFolders: completed,
          missingFiles: missing,
          lastScan: lastScanText
        }));

        // Pie chart verilerini güncelle
        if (total > 0) {
          const completedPercent = Math.round((completed / total) * 100);
          const missingPercent = Math.round((missing / total) * 100);
          const pendingPercent = 100 - completedPercent - missingPercent;

          setPieData([
            { name: 'Tamamlanan', value: completedPercent, color: '#059669' },
            { name: 'Eksik Dosya', value: missingPercent, color: '#ea580c' },
            { name: 'Beklemede', value: pendingPercent, color: '#6b7280' }
          ]);
        }

        // Aylık bar chart verilerini oluştur - sadece mevcut yıl (2025) için
        const currentYear = new Date().getFullYear(); // 2025
        const currentYearData = monitoringData.filter(item => item.year === currentYear);
        
        // Mevcut yıl verilerinin aylık dağılımını hesapla
        const monthlyDistribution: Record<number, { complete: number; missing: number }> = {};
        for (let i = 1; i <= 12; i++) {
          monthlyDistribution[i] = { complete: 0, missing: 0 };
        }
        
        currentYearData.forEach(item => {
          if (item.month >= 1 && item.month <= 12) {
            if (item.status === 'complete') {
              monthlyDistribution[item.month].complete++;
            } else if (item.status === 'missing' || item.status === 'incomplete') {
              monthlyDistribution[item.month].missing++;
            }
          }
        });
        
        const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
        const monthlyStats = monthNames.map((month, index) => {
          const monthNumber = index + 1;
          const monthData = monthlyDistribution[monthNumber];
          
          return {
            month,
            complete: monthData.complete,
            missing: monthData.missing
          };
        });
        
        setBarData(monthlyStats);
      }

    } catch (error) {
      logService.logSystemAction('Dashboard Hata', `Veriler yüklenirken hata: ${error}`, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-6 py-8 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                📊 Kontrol Paneli {trialInfo?.isDemo && <span className="text-orange-600 font-bold">🎯 DEMO VERSİYON</span>}
              </h1>
              <p className="text-gray-600 dark:text-gray-300">E-defter GIB sisteminin güncel durumu</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {trialInfo && trialInfo.isDemo && (
              <div className={`px-4 py-2 rounded-xl border ${
                trialInfo.isExpired 
                  ? 'bg-red-100 border-red-200' 
                  : trialInfo.daysLeft <= 5 
                    ? 'bg-yellow-100 border-yellow-200'
                    : 'bg-blue-100 border-blue-200'
              }`}>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">⏱️</span>
                  <div>
                    <p className={`font-bold ${
                      trialInfo.isExpired 
                        ? 'text-red-700' 
                        : trialInfo.daysLeft <= 5 
                          ? 'text-yellow-700'
                          : 'text-blue-700'
                    }`}>
                      {trialInfo.isExpired 
                        ? 'Demo Süresi Doldu' 
                        : `${trialInfo.daysLeft} Gün Kaldı`}
                    </p>
                    <p className="text-xs text-gray-600">
                      {trialInfo.isExpired 
                        ? 'Lisans satın alın' 
                        : `Son: ${new Date(trialInfo.expiryDate).toLocaleDateString('tr-TR')}`}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center space-x-2 bg-gradient-to-r from-green-100 to-emerald-100 px-4 py-2 rounded-xl border border-green-200">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-700 font-medium">Sistem Aktif</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl transition-all overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white p-3 -m-6 mb-4">
              <div className="flex items-center justify-between">
                <Users className="w-6 h-6" />
                <div className="text-right">
                  <p className="text-2xl font-bold">{stats.totalCompanies}</p>
                  <p className="text-sm text-blue-100">Kayıtlı</p>
                </div>
              </div>
            </div>
            <p className="text-gray-700 dark:text-gray-300 font-medium">📋 Toplam Şirket</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl transition-all overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white p-3 -m-6 mb-4">
              <div className="flex items-center justify-between">
                <CheckCircle className="w-6 h-6" />
                <div className="text-right">
                  <p className="text-2xl font-bold">{stats.completedFolders}</p>
                  <p className="text-sm text-green-100">Tamamlandı</p>
                </div>
              </div>
            </div>
            <p className="text-gray-700 dark:text-gray-300 font-medium">✅ Tamamlanan Klasörler</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl transition-all overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-3 -m-6 mb-4">
              <div className="flex items-center justify-between">
                <AlertTriangle className="w-6 h-6" />
                <div className="text-right">
                  <p className="text-2xl font-bold">{stats.missingFiles}</p>
                  <p className="text-sm text-orange-100">Eksik/Yok</p>
                </div>
              </div>
            </div>
            <p className="text-gray-700 dark:text-gray-300 font-medium">⚠️ Eksik Dosyalar</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl transition-all overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-3 -m-6 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-2xl">🕒</span>
                <div className="text-right">
                  <p className="text-lg font-bold">{stats.lastScan}</p>
                  <p className="text-sm text-purple-100">Güncel</p>
                </div>
              </div>
            </div>
            <p className="text-gray-700 dark:text-gray-300 font-medium">🕒 Son Tarama</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Completion Status Pie Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  📈 Tamamlanma Durumu
                </h3>
              </div>
            </div>
            <div className="p-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center space-x-6 mt-4">
                {pieData.map((entry, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">{entry.name} ({entry.value}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Monthly Progress Bar Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gradient-to-r from-teal-500 to-green-500 text-white p-4">
              <h3 className="text-lg font-bold flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                📊 Aylık İlerleme
              </h3>
            </div>
            <div className="p-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="complete" fill="#059669" name="Tamamlanan" />
                    <Bar dataKey="missing" fill="#ea580c" name="Eksik" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};



