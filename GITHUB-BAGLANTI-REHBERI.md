# 🚀 GitHub Bağlantı Rehberi

## ✅ Bilgileriniz
- **GitHub Hesabı:** `yavuzmtr`
- **Email:** `yavuzmercimek@gmail.com`
- **Proje Adı:** E-Defter Otomasyon Sistemi
- **Proje Kodu:** `0112xxxproject`

---

## 📋 ADIM 1: GitHub'da Repository Oluşturun

### 1.1 Web Tarayıcısında
1. https://github.com/new adresine gidin
2. **Repository name:** `edefter-otomasyon` yazın
3. **Description:** E-Defter Otomasyon Sistemi - Otomatik backup, izleme ve email bildirimi
4. **Public/Private:** `Public` seçin (veya Private isterseniz)
5. **Initialize this repository with:**
   - ❌ README.md (README.md zaten var)
   - ❌ .gitignore (zaten var)
   - ❌ license (opsiyonel)
6. **Create repository** butonuna tıklayın

**Sonuç:** Repository URL'si şöyle olacak:
```
https://github.com/yavuzmtr/edefter-otomasyon.git
```

---

## 📋 ADIM 2: Yerel Repository'sini Başlatın

Proje klasöründe bu komutları çalıştırın:

### 2.1 Repository'sini başlat (eğer yoksa)
```powershell
# Mevcut git repository'sini kontrol et
git status

# Eğer "fatal: not a git repository" hatası alırsan:
git init
```

### 2.2 Remote ekle
```powershell
git remote add origin https://github.com/yavuzmtr/edefter-otomasyon.git
```

### 2.3 Remote'u kontrol et
```powershell
git remote -v
# Çıktı:
# origin  https://github.com/yavuzmtr/edefter-otomasyon.git (fetch)
# origin  https://github.com/yavuzmtr/edefter-otomasyon.git (push)
```

---

## 📋 ADIM 3: Dosyaları Hazırlayın ve Commit Edin

### 3.1 Tüm dosyaları ekle
```powershell
git add .
```

### 3.2 Commit yap
```powershell
git commit -m "🚀 İlk commit: E-Defter Otomasyon Sistemi

- React + TypeScript + Electron masaüstü uygulaması
- Otomatik GIB dosyası yedekleme ve izleme
- Email bildirimleri
- Şirket yönetimi
- Sistem sağlık kontrolü"
```

### 3.3 Branch ismini ayarla (main olmasını sağla)
```powershell
git branch -M main
```

---

## 📋 ADIM 4: GitHub'a Push Edin

### ⚠️ Önemli: Authentication

GitHub'a push etmek için iki seçeneğiniz var:

#### **Seçenek A: Personal Access Token (Önerilen)**

1. GitHub Settings → Developer settings → Personal access tokens → Tokens (classic) gidin
2. **Generate new token** → **Generate new token (classic)** tıklayın
3. Token adı: `edefter-automation`
4. Seçimleri yapın:
   - ✅ repo (tüm alt seçenekler)
   - ✅ admin:repo_hook
5. **Generate token** tıklayın
6. Token'ı kopyalayın (sonra göremeyeceksiniz!)
7. Terminal'de push yaparken, istendiğinde şu gir:
   - **Username:** `yavuzmtr`
   - **Password:** Token'ı yapıştır

#### **Seçenek B: SSH (Alternatif)**
```powershell
# SSH key oluştur (eğer yoksa)
ssh-keygen -t ed25519 -C "yavuzmercimek@gmail.com"

# Public key'i GitHub'a ekle
# ~/.ssh/id_ed25519.pub dosyasının içeriğini
# GitHub Settings → SSH and GPG keys → New SSH key'e yapıştır

# Remote'u SSH'ye değiştir
git remote set-url origin git@github.com:yavuzmtr/edefter-otomasyon.git
```

---

## 🚀 ADIM 5: Push Yapın

### 5.1 GitHub'a push et
```powershell
git push -u origin main
```

### 5.2 Token/SSH ile authenticate et
- Prompt gelirse token veya SSH passphrası gir
- Başarılı olursa: "Branch 'main' set up to track remote branch 'main'"

### 5.3 Durumu kontrol et
```powershell
git status
# Çıktı: working tree clean
```

---

## ✅ DOĞRULAMA

Push başarılı olduysa:

1. https://github.com/yavuzmtr/edefter-otomasyon adresini ziyaret edin
2. Dosyaların görüldüğünü kontrol edin
3. Commit mesajını kontrol edin
4. README.md görüntülendiğini kontrol edin

---

## 📊 Beklenen Dosya Yapısı

```
edefter-otomasyon/
├── .vscode/
├── assets/
├── dist/
├── electron/
├── node_modules/
├── scripts/
├── src/
├── uninstaller/
├── .gitignore
├── electron-builder.yml
├── eslint.config.js
├── index.html
├── package.json
├── package-lock.json
├── postcss.config.js
├── README.md
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts
```

---

## 🔗 Sonra Yapılacak İşler

### Repository'sini Klonlamak
```powershell
git clone https://github.com/yavuzmtr/edefter-otomasyon.git
cd edefter-otomasyon
npm install
npm run dev
```

### Değişiklikleri Push Etmek
```powershell
git add .
git commit -m "✨ Yeni özellik: ..."
git push
```

### Branch Oluşturmak
```powershell
git checkout -b feature/yeni-ozellik
# ... değişiklikler yap ...
git push -u origin feature/yeni-ozellik
```

---

## 🆘 Sorun Giderme

### "fatal: 'origin' does not appear to be a 'git' repository"
```powershell
git remote remove origin
git remote add origin https://github.com/yavuzmtr/edefter-otomasyon.git
```

### "Permission denied" hatası
- Token'ı yanlış girdiniz → Yeniden deneyin
- SSH kullanıyorsanız: `ssh -T git@github.com` test edin

### "Branch 'main' set up to track 'origin/main', but the upstream is gone"
```powershell
git pull origin main
git push -u origin main
```

---

## 📝 Git Cheat Sheet

```powershell
# Repository ayarlaması
git init                                  # Yeni repository başlat
git remote add origin <URL>              # Remote ekle
git remote -v                            # Remote'ları göster
git remote set-url origin <URL>          # Remote'u değiştir

# Değişiklikler
git status                               # Durumu göster
git add .                                # Tüm dosyaları stage et
git commit -m "mesaj"                    # Commit et
git push                                 # Push et
git pull                                 # Pull et

# Branch'ler
git branch                               # Branch'leri listele
git checkout -b <branch>                 # Yeni branch oluştur
git checkout <branch>                    # Branch'e geç
git branch -M main                       # Branch'i yeniden adlandır

# Log
git log --oneline                        # Commit geçmişini göster
git log --graph --all --oneline         # Grafik göster
```

---

## ✨ Başarı!

Tebrikler! 🎉 Projeniz GitHub'da canlı.

- **Repository:** https://github.com/yavuzmtr/edefter-otomasyon
- **Sosyal:** https://github.com/yavuzmtr

---

**Tarih:** 2 Ocak 2026
**Durum:** ✅ Hazır
