import React, { useState, useEffect } from 'react';
import { Users, CheckCircle, AlertTriangle } from 'lucide-react';
import { ElectronService } from '../services/electronService';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalCompanies: 0,
    completedFolders: 0,
    missingFiles: 0,
    lastScan: 'Henüz tarama yapılmadı'
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Şirket verilerini yükle
      const companiesResult = await ElectronService.loadData('companies', []);
      if (companiesResult.success) {
        const activeCompanies = (companiesResult.data || []).filter((company: any) => company.status === 'active');
        setStats(prev => ({ ...prev, totalCompanies: activeCompanies.length }));
      }

      // Monitoring verilerini yükle
      const monitoringResult = await ElectronService.loadData('monitoring-data', []);
      
      if (monitoringResult.success && monitoringResult.data) {
        const monitoringData = Array.isArray(monitoringResult.data) ? monitoringResult.data : [];
        
        const completed = monitoringData.filter((item: any) => item.status === 'complete').length;
        const missing = monitoringData.filter((item: any) => item.status === 'missing' || item.status === 'incomplete').length;

        setStats(prev => ({
          ...prev,
          completedFolders: completed,
          missingFiles: missing,
          lastScan: new Date().toLocaleString('tr-TR')
        }));
      }

      setLoading(false);
    } catch (error) {
      console.error('❌ Dashboard veri yükleme hatası:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Veriler yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h1 className="text-4xl font-bold mb-8" style={{ color: 'var(--text-primary)' }}>
        Kontrol Paneli
      </h1>

      {/* İstatistikler */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Şirket Sayısı */}
        <div className="p-6 rounded-lg" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} className="border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-2">Aktif Şirket</p>
              <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {stats.totalCompanies}
              </p>
            </div>
            <Users className="w-12 h-12 text-blue-500" />
          </div>
        </div>

        {/* Tamamlanan */}
        <div className="p-6 rounded-lg border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-2">Tamamlanan</p>
              <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {stats.completedFolders}
              </p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
        </div>

        {/* Eksik Dosya */}
        <div className="p-6 rounded-lg border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-2">Eksik Dosya</p>
              <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {stats.missingFiles}
              </p>
            </div>
            <AlertTriangle className="w-12 h-12 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Son Tarama */}
      <div className="p-6 rounded-lg border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Tarama Durumu</h2>
        <p className="text-gray-600">
          Son tarama: <span className="font-medium">{stats.lastScan}</span>
        </p>
      </div>

      {/* Hoş Geldiniz Mesajı */}
      <div className="mt-8 p-6 rounded-lg border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>👋 Hoş Geldiniz</h2>
        <p style={{ color: 'var(--text-secondary)' }} className="leading-7">
          E-Defter Otomasyon Sistemine hoş geldiniz. Sistem şu özellikleri sunmaktadır:
        </p>
        <ul className="list-disc list-inside mt-4 space-y-2" style={{ color: 'var(--text-secondary)' }}>
          <li>📊 Şirket ve dönem yönetimi</li>
          <li>📁 Klasör izleme ve dosya kontrolü</li>
          <li>📧 Otomatik e-posta gönderimi</li>
          <li>💾 Otomatik yedekleme</li>
          <li>📈 Raporlama ve analiz</li>
        </ul>
      </div>
    </div>
  );
};
