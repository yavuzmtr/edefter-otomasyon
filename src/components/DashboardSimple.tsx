import React from 'react';
import { Users, CheckCircle, AlertTriangle } from 'lucide-react';

export const Dashboard: React.FC = () => {
  return (
    <div style={{ color: '#333', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '24px' }}>
        Kontrol Paneli
      </h1>

      {/* İstatistikler */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        {/* Şirket Sayısı */}
        <div style={{ padding: '24px', borderRadius: '8px', backgroundColor: '#f5f5f5', border: '1px solid #ddd' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ color: '#999', fontSize: '14px', marginBottom: '8px' }}>Aktif Şirket</p>
              <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>163</p>
            </div>
            <Users style={{ width: '48px', height: '48px', color: '#3b82f6' }} />
          </div>
        </div>

        {/* Tamamlanan */}
        <div style={{ padding: '24px', borderRadius: '8px', backgroundColor: '#f5f5f5', border: '1px solid #ddd' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ color: '#999', fontSize: '14px', marginBottom: '8px' }}>Tamamlanan</p>
              <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>118</p>
            </div>
            <CheckCircle style={{ width: '48px', height: '48px', color: '#10b981' }} />
          </div>
        </div>

        {/* Eksik Dosya */}
        <div style={{ padding: '24px', borderRadius: '8px', backgroundColor: '#f5f5f5', border: '1px solid #ddd' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ color: '#999', fontSize: '14px', marginBottom: '8px' }}>Eksik Dosya</p>
              <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>0</p>
            </div>
            <AlertTriangle style={{ width: '48px', height: '48px', color: '#f97316' }} />
          </div>
        </div>
      </div>

      {/* Tarama Durumu */}
      <div style={{ padding: '24px', borderRadius: '8px', backgroundColor: '#f5f5f5', border: '1px solid #ddd', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#333' }}>Tarama Durumu</h2>
        <p style={{ color: '#666' }}>
          Son tarama: <span style={{ fontWeight: '500' }}>12.01.2026 15:28:03</span>
        </p>
      </div>

      {/* Hoş Geldiniz */}
      <div style={{ padding: '24px', borderRadius: '8px', backgroundColor: '#f5f5f5', border: '1px solid #ddd' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#333' }}>👋 Hoş Geldiniz</h2>
        <p style={{ color: '#666', lineHeight: '1.6', marginBottom: '16px' }}>
          E-Defter Otomasyon Sistemine hoş geldiniz. Sistem şu özellikleri sunmaktadır:
        </p>
        <ul style={{ listStyle: 'disc', paddingLeft: '20px', color: '#666' }}>
          <li style={{ marginBottom: '8px' }}>📊 Şirket ve dönem yönetimi</li>
          <li style={{ marginBottom: '8px' }}>📁 Klasör izleme ve dosya kontrolü</li>
          <li style={{ marginBottom: '8px' }}>📧 Otomatik e-posta gönderimi</li>
          <li style={{ marginBottom: '8px' }}>💾 Otomatik yedekleme</li>
          <li>📈 Raporlama ve analiz</li>
        </ul>
      </div>
    </div>
  );
};
