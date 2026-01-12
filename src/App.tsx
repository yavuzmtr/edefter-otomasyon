import React, { useState } from 'react';
import { ElectronService } from './services/electronService';
import emailNotificationService from './services/emailNotificationService';
import { ThemeProvider } from './contexts/ThemeContext';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/DashboardSimple';
import { CompanyManagement } from './components/CompanyManagement';
import { MonitoringSystem } from './components/MonitoringSystem';
import { ReportSystem } from './components/ReportSystem';
import { BackupSystem } from './components/BackupSystem';
import { EmailSystem } from './components/EmailSystem';
import { AutomationSettings } from './components/AutomationSettings';
import { SettingsPage } from './components/SettingsPage';
import EDefterTrackerWrapper from './components/EDefterTrackerWrapper';
import { EDefterDeadlineTracker as EDefterInfo } from './components/EDefterDeadlineTracker';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  React.useEffect(() => {
    // Electron ortamını kontrol et
    if (!ElectronService.isElectron()) {
      console.warn('Uygulama browser modunda çalışıyor - bazı özellikler çalışmayabilir');
    }

    // Email notification servisi başlat (async, non-blocking)
    setTimeout(() => {
      emailNotificationService.initialize().catch((error) => {
        console.warn('Email notification servisi başlatma başarısız (normal, henüz yapılandırılmamış olabilir):', error);
      });
    }, 2000); // 2 saniye delay - UI render'ı engellemesin

    // ✅ BAŞLAMA KONTROLÜ - Otomasyon açık ise otomatik başlat (deferred)
    const initializeAutoStarting = async () => {
      try {
        const automationSettings = await ElectronService.loadData('automation-settings', {});
        const monitoringSettings = await ElectronService.loadData('monitoring-settings', {});
        const existingData = await ElectronService.loadData('monitoring-data', []);

        let sourcePath = automationSettings.data?.sourcePath || 
                        (monitoringSettings.success ? monitoringSettings.data?.sourcePath : null);

        // Path yoksa otomatik olarak ayarla
        if (!sourcePath) {
          const defaultPath = "C:\\Users\\NUMAN\\Desktop\\E Defter";
          const exists = await ElectronService.checkPathExists(defaultPath);
          if (exists) {
            sourcePath = defaultPath;
            console.log('✅ Otomatik E Defter path ayarlandı');
          }
        }

        // Eğer monitoring-data boşsa, ilk başlangıçta tarama yap
        if ((!existingData?.data || (Array.isArray(existingData?.data) && existingData.data.length === 0)) && sourcePath) {
          console.log('📊 İlk başlangıçta GIB taraması yapılıyor:', sourcePath);
          try {
            const scanResult = await ElectronService.scanFolderStructure(sourcePath, '');
            if (scanResult.success && scanResult.data) {
              console.log('✅ İlk tarama tamamlandı:', scanResult.data.length, 'kayıt');
            }
          } catch (err) {
            console.warn('İlk tarama hatası:', err);
          }
        }

        if (automationSettings.success && automationSettings.data?.enabled && sourcePath) {
            
            // Klasör izlemeyi başlat
            try {
              const monitorResult = await ElectronService.startFolderMonitoring(sourcePath, 5000);
              if (monitorResult.success) {
                console.log('✅ Klasör izleme başlatıldı');
              }
            } catch (err) {
              console.warn('Klasör izleme başlatma hatası:', err);
            }

            // Arka plan servisini başlat
            try {
              const bgResult = await ElectronService.startBackgroundService();
              if (bgResult.success) {
                console.log('✅ Arka plan servisi başlatıldı');
              }
            } catch (err) {
              console.warn('Arka plan servisi başlatma hatası:', err);
            }

            // Otomasyon engine'i başlat
            try {
              const engineResult = await ElectronService.startAutomationEngine(sourcePath);
              if (engineResult.success) {
                console.log('✅ Otomasyon engine başlatıldı');
              }
            } catch (err) {
              console.warn('Otomasyon engine başlatma hatası:', err);
            }
        }
      } catch (error) {
        console.warn('Auto-start kontrolü hatası:', error);
      }
    };

    // Auto-start'ı tetikle (deferred - UI render'dan sonra)
    setTimeout(() => {
      initializeAutoStarting();
    }, 3000);

    // Cleanup
    return () => {
      emailNotificationService.destroy();
    };
  }, []);

  const renderContent = () => {
    // Electron ortamında değilse uyarı göster
    if (!ElectronService.isElectron()) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-8 bg-yellow-50 border border-yellow-200 rounded-xl max-w-md">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">Electron Uygulaması Gerekli</h3>
            <p className="text-yellow-700 mb-4">
              Bu uygulama Windows'ta tam fonksiyonel olarak çalışmak için Electron ortamında çalıştırılmalıdır.
            </p>
            <div className="text-sm text-yellow-600 bg-yellow-100 p-3 rounded-lg">
              <p className="font-medium mb-1">Windows için:</p>
              <code className="text-xs">npm run electron-dev</code>
              <p className="font-medium mb-1 mt-2">Exe oluşturmak için:</p>
              <code className="text-xs">npm run dist-win</code>
            </div>
          </div>
        </div>
      );
    }

    try {
      switch (activeTab) {
        case 'dashboard':
          return (
            <div className="w-full">
              <h1 className="text-3xl font-bold mb-6">Kontrol Paneli</h1>
              <p className="text-gray-600 mb-4">Dashboard yükleniyor...</p>
              <Dashboard />
            </div>
          );
        case 'companies':
          return <CompanyManagement />;
        case 'deadline-tracker':
          return <EDefterTrackerWrapper />;
        case 'monitoring':
          return <MonitoringSystem />;
        case 'reports':
          return <ReportSystem />;
        case 'backup':
          return <BackupSystem />;
        case 'email':
          return <EmailSystem />;
        case 'automation':
          return <AutomationSettings />;
        case 'edefter-info':
          return <EDefterInfo />;
        case 'settings':
          return <SettingsPage />;
        default:
          return (
            <div className="w-full">
              <h1 className="text-3xl font-bold mb-6">Kontrol Paneli</h1>
              <p className="text-gray-600 mb-4">Dashboard yükleniyor...</p>
              <Dashboard />
            </div>
          );
      }
    } catch (error) {
      console.error('❌ Sayfa yükleme hatası:', error);
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-8 bg-red-50 border border-red-200 rounded-xl max-w-md">
            <h3 className="text-lg font-semibold text-red-800 mb-2">Sayfa Yükleme Hatası</h3>
            <p className="text-red-700">{error instanceof Error ? error.message : 'Bilinmeyen hata'}</p>
          </div>
        </div>
      );
    }
  };

  return (
    <ThemeProvider>
      <div className="flex h-screen" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="flex-1 overflow-auto" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <div className="p-8">
            {renderContent()}
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;