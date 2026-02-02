import React, { useEffect, useState } from 'react';
import { 
  Home, 
  Building, 
  FolderOpen, 
  FileText, 
  HardDrive, 
  Mail, 
  Settings, 
  Activity,
  Calendar
} from 'lucide-react';
import { ElectronService } from '../services/electronService';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Kontrol Paneli', icon: Home },
  { id: 'companies', label: 'Şirket Yönetimi', icon: Building },
  { id: 'deadline-tracker', label: 'E-Defter Uyarıları', icon: Calendar },
  { id: 'monitoring', label: 'Klasör İzleme', icon: FolderOpen },
  { id: 'reports', label: 'Raporlama', icon: FileText },
  { id: 'backup', label: 'Yedekleme', icon: HardDrive },
  { id: 'email', label: 'E-posta', icon: Mail },
  { id: 'automation', label: 'Otomasyon Merkezi', icon: Activity },
  { id: 'settings', label: 'Sistem Ayarları', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    const checkTrialStatus = async () => {
      console.log('🔍 [Sidebar] Trial durumu kontrol ediliyor...');
      if (ElectronService.isElectron()) {
        const result = await ElectronService.checkTrialStatus();
        console.log('📊 [Sidebar] Trial result:', result);
        if (result.success && result.trialInfo) {
          console.log('✅ [Sidebar] isDemo:', result.trialInfo.isDemo);
          setIsDemo(result.trialInfo.isDemo);
        }
      }
    };
    checkTrialStatus();
  }, []);

  return (
    <div className="w-64 sidebar-themed shadow-lg h-screen border-r" 
         style={{ 
           backgroundColor: 'var(--bg-card)', 
           borderColor: 'var(--border-color)' 
         }}>
      <div className="p-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" 
               style={{ backgroundColor: 'var(--accent-color)' }}>
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>E-Defter</h1>
              {isDemo && (
                <span className="px-2 py-1 text-xs font-bold bg-orange-500 text-white rounded-md">
                  DEMO
                </span>
              )}
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Otomasyon Sistemi</p>
          </div>
        </div>
      </div>
      
      <nav className="mt-6 px-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className="w-full flex items-center space-x-3 px-4 py-3 text-left rounded-lg mb-1 transition-all duration-200"
              style={{
                backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
                color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
                borderRight: isActive ? '4px solid var(--accent-color)' : '4px solid transparent'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              <Icon className="w-5 h-5" 
                    style={{ color: isActive ? 'var(--accent-color)' : 'var(--text-muted)' }} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};