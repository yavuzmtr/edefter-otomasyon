# Changelog

Tüm önemli değişiklikler bu dosyada belgelenecektir.

## [1.0.1] - 2026-02-04

### ✨ Yeni Özellikler
- **Anında Email Tetikleme**: Klasör taraması tamamlandığında otomatik email gönderimi (saatlik bekleme yerine)
- **Akıllı Filtreleme**: Klasör izleme sayfasında şirket adı, vergi no, TC no ve durum bazlı gelişmiş filtreleme sistemi

### 🐛 Hata Düzeltmeleri
- `gibFiles is not defined` hatası düzeltildi (scan-folder-structure handler)
- Production/Demo build karmaşası çözüldü (package.json.build-backup yapılandırması düzeltildi)

### 🔧 İyileştirmeler
- Email automation asenkron hale getirildi (UI donması önlendi)
- Lock mekanizması ile duplicate email gönderimi engellendi
- Trial sistemi ayrımı netleştirildi (main.cjs vs main-demo.cjs)

### 📦 Build
- Production installer: 101.1 MB
- Demo installer: 402.4 MB
- Electron 38.7.2
- Vite 7.2.6

---

## [1.0.0] - 2026-01-12

### 🎉 İlk Sürüm
- E-Defter klasör izleme sistemi
- Otomatik email gönderimi
- Yedekleme sistemi
- Dashboard ve raporlama
- Windows tray entegrasyonu
- 15 günlük trial sistemi
