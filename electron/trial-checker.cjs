// DEMO VERSİYON - DENEME SÜRESİ KONTROLÜ
// Bu dosya sadece demo versiyonda kullanılır
const Store = require('electron-store');
const { app, dialog } = require('electron');
const os = require('os');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Safe console logging için helper
function safeLog(...args) {
  try {
    if (process.stdout && process.stdout.writable) {
      process.stdout.write(args.join(' ') + '\n');
    }
  } catch (e) {
    // Ignore
  }
}

/**
 * Hardware ID oluştur (makine benzersiz tanımlayıcı)
 * CPU, Hostname ve MAC adresi kombinasyonu
 */
function getHardwareId() {
  const cpuInfo = os.cpus()[0].model;
  const hostname = os.hostname();
  const username = os.userInfo().username;
  const platform = os.platform();
  const arch = os.arch();
  
  // Tüm bilgileri birleştir ve hash oluştur
  const hwString = `${cpuInfo}-${hostname}-${username}-${platform}-${arch}`;
  const hwId = crypto.createHash('sha256').update(hwString).digest('hex');
  
  return hwId;
}

function resolveTrialStoreDir() {
  const preferredDir = process.env.DEMO_TRIAL_STORE_DIR
    ? process.env.DEMO_TRIAL_STORE_DIR
    : path.join(app.getPath('appData'), 'edefter-automation-demo');

  const legacyDirs = [
    app.getPath('userData'),
    path.join(app.getPath('appData'), 'e-defter-otomasyon-demo')
  ];

  try {
    if (!fs.existsSync(preferredDir)) {
      fs.mkdirSync(preferredDir, { recursive: true });
    }
  } catch (e) {
    // Klasor olusmazsa electron-store kendi defaultuna duser
  }

  const trialFile = 'trial-data.json';
  const preferredFile = path.join(preferredDir, trialFile);

  for (const dir of legacyDirs) {
    try {
      const legacyFile = path.join(dir, trialFile);
      if (fs.existsSync(legacyFile) && !fs.existsSync(preferredFile)) {
        fs.copyFileSync(legacyFile, preferredFile);
      }
    } catch (e) {
      // Eski dosyayi tasima hatasi olursa sessiz gec
    }
  }

  return preferredDir;
}

const trialStore = new Store({
  name: 'trial-data',
  cwd: resolveTrialStoreDir()
});

// DEMO SÜRÜM: 10 dakikalık deneme süresi (TEST İÇİN)
// DEMO SÜRESİ: Varsayılan 15 dakika
// İstenirse build sırasında DEMO_TRIAL_MINUTES env ile ayarlanabilir.
const TRIAL_DURATION_MINUTES = Math.max(
  1,
  parseInt(process.env.DEMO_TRIAL_MINUTES || '15', 10)
);
const TRIAL_DURATION = TRIAL_DURATION_MINUTES * 60 * 1000; // dakika -> ms
const TRIAL_DAYS = Math.max(1, Math.ceil(TRIAL_DURATION / (24 * 60 * 60 * 1000)));

/**
 * Demo deneme süresini başlatır (ilk kurulumda)
 * @returns {boolean} İlk kurulum mu?
 */
function initializeTrial() {
  const hwId = getHardwareId();
  const storedHwId = trialStore.get('hardwareId');
  const firstRunDate = trialStore.get('firstRunDate');
  
  // Hardware ID kontrolü - farklı makinede ilk kez çalışıyor
  if (!storedHwId || storedHwId !== hwId) {
    const now = Date.now();
    trialStore.set('hardwareId', hwId);
    trialStore.set('firstRunDate', now);
    trialStore.set('isTrialVersion', true);
    safeLog('[DEMO] Yeni makine - Trial başlatıldı:', new Date(now).toLocaleString('tr-TR'));
    safeLog('[DEMO] Hardware ID:', hwId.substring(0, 16) + '...');
    safeLog('[DEMO] Trial data path:', resolveTrialStoreDir());
    return true; // İlk kurulum
  } else if (firstRunDate) {
    safeLog('[DEMO] Aynı makine - Trial devam ediyor:', new Date(firstRunDate).toLocaleString('tr-TR'));
    safeLog('[DEMO] Hardware ID eşleşti');
  }
  return false; // Devam eden trial
}

/**
 * Kalan deneme gün sayısını döndürür
 * @returns {number} Kalan gün sayısı
 */
function getRemainingDays() {
  const firstRunDate = trialStore.get('firstRunDate');
  if (!firstRunDate) return TRIAL_DAYS;
  
  const now = Date.now();
  const elapsed = now - firstRunDate;
  const remaining = TRIAL_DURATION - elapsed;
  const remainingDays = Math.ceil(remaining / (24 * 60 * 60 * 1000));
  
  return Math.max(0, remainingDays);
}

/**
 * Deneme süresinin dolup dolmadığını kontrol eder
 * @returns {boolean} Süre dolmuşsa true
 */
function isTrialExpired() {
  const firstRunDate = trialStore.get('firstRunDate');
  if (!firstRunDate) return false;
  
  const now = Date.now();
  const elapsed = now - firstRunDate;
  
  return elapsed >= TRIAL_DURATION;
}

/**
 * Demo süresi uyarısı gösterir ve uygulamayı kapatır
 */
async function showTrialExpiredDialog() {
  // Demo bitince bir daha otomatik başlatılmasın
  try {
    app.setLoginItemSettings({ openAtLogin: false });
  } catch (e) {
    // ignore
  }

  // Kullanıcı tıklamasa bile kısa süre sonra uygulamayı kapat
  const forceExitTimer = setTimeout(() => {
    try {
      app.exit(0);
    } catch (e) {
      // ignore
    }
  }, 4000);

  // Süreyi dinamik olarak hesapla
  const durationInDays = TRIAL_DURATION / (24 * 60 * 60 * 1000);
  const durationInMinutes = TRIAL_DURATION / (60 * 1000);
  
  let durationText;
  if (durationInDays >= 1) {
    durationText = `${Math.floor(durationInDays)} günlük`;
  } else if (durationInMinutes >= 60) {
    durationText = `${Math.floor(durationInMinutes / 60)} saatlik`;
  } else {
    durationText = `${Math.floor(durationInMinutes)} dakikalık`;
  }
  
  const response = await dialog.showMessageBox({
    type: 'warning',
    title: 'Demo Süresi Doldu',
    message: 'E-Defter Klasör Otomasyonu - Demo Süresi Sona Erdi',
    detail: `${durationText} demo süreniz sona erdi.\n\nTam sürüme geçmek için:\n\n✅ Web sitesinden tam sürümü indirin\n✅ veya lisans satın alın\n\nTeşekkür ederiz!`,
    buttons: ['Web Sitesini Aç', 'Kapat'],
    defaultId: 0,
    cancelId: 1
  });
  
  if (response.response === 0) {
    // Web sitesini aç
    require('electron').shell.openExternal('https://yavuzmtr.github.io/edefter-otomasyon/');
  }
  
  // Uygulamayı kapat
  app.quit();
  clearTimeout(forceExitTimer);
  // Güvenli kapanış için
  try {
    app.exit(0);
  } catch (e) {
    // ignore
  }
}

/**
 * Her başlangıçta deneme süresini kontrol eder
 * @returns {boolean} Uygulama devam edebilirse true
 */
async function checkTrial() {
  const isFirstRun = initializeTrial();
  
  const remainingDays = getRemainingDays();
  const expired = isTrialExpired();
  
  // Kalan süreyi hesapla (ms)
  const firstRunDate = trialStore.get('firstRunDate');
  const now = Date.now();
  const elapsed = now - firstRunDate;
  const remaining = TRIAL_DURATION - elapsed;
  const remainingMinutes = Math.ceil(remaining / 60000);
  const remainingHours = Math.ceil(remaining / 3600000);
  
  safeLog('[DEMO] Trial check - Kalan ms:', remaining, 'Expired:', expired);
  
  // İlk çalıştırmada hoş geldiniz mesajı
  if (isFirstRun) {
    // Süreyi dinamik olarak hesapla
    const durationInDays = TRIAL_DURATION / (24 * 60 * 60 * 1000);
    const durationInMinutes = TRIAL_DURATION / (60 * 1000);
    
    let durationText;
    if (durationInDays >= 1) {
      durationText = `${Math.floor(durationInDays)} gün`;
    } else if (durationInMinutes >= 60) {
      durationText = `${Math.floor(durationInMinutes / 60)} saat`;
    } else {
      durationText = `${Math.floor(durationInMinutes)} dakika`;
    }
    
    dialog.showMessageBox({
      type: 'info',
      title: '🎉 Demo Versiyonuna Hoş Geldiniz!',
      message: 'E-Defter Klasör Otomasyonu - Demo Başladı',
      detail: `Demo versiyonunu ${durationText} boyunca ücretsiz kullanabilirsiniz.\n\n✨ Tüm özellikleri keşfedin\n📊 Sistemi test edin\n⚡ Otomasyonun gücünü görün\n\nDemo süresi sonunda tam sürüme geçerek sınırsız kullanım hakkı kazanabilirsiniz.\n\nİyi kullanımlar! 🚀`,
      buttons: ['Başlayalım!']
    });
  }
  
  if (expired) {
    // Süre dolmuş
    safeLog('[DEMO] Trial süresi doldu! Uygulama kapatılıyor...');
    await showTrialExpiredDialog();
    return false;
  } else if (remaining <= 2 * 60 * 1000) {
    // Son 2 dakika - uyarı göster (TEST için daha erken)
    let timeLeft;
    if (remainingMinutes > 60) {
      timeLeft = `${remainingHours} saat`;
    } else if (remainingMinutes > 1) {
      timeLeft = `${remainingMinutes} dakika`;
    } else {
      timeLeft = 'az önce';
    }
    
    dialog.showMessageBox({
      type: 'info',
      title: 'Demo Süresi Uyarısı',
      message: `Demo süreniz ${timeLeft} sonra dolacak`,
      detail: `E-Defter Klasör Otomasyonu demo versiyonunu kullanıyorsunuz.\n\nKalan süre: ${timeLeft}\n\nTam sürüme geçerek sınırsız kullanım hakkı elde edebilirsiniz.`,
      buttons: ['Tamam']
    });
  }
  
  return true;
}

/**
 * Trial bilgilerini döndürür (UI'da göstermek için)
 */
function getTrialInfo() {
  const firstRunDate = trialStore.get('firstRunDate');
  const remainingDays = getRemainingDays();
  const isExpired = isTrialExpired();
  const now = Date.now();
  const elapsed = firstRunDate ? now - firstRunDate : 0;
  const remainingMs = Math.max(0, TRIAL_DURATION - elapsed);
  const remainingMinutes = Math.ceil(remainingMs / 60000);
  const totalMinutes = Math.ceil(TRIAL_DURATION / 60000);
  const isShortTrial = TRIAL_DURATION < (24 * 60 * 60 * 1000);

  const timeLeftText = isExpired
    ? 'Süre doldu'
    : isShortTrial
      ? `${Math.max(0, remainingMinutes)} dakika kaldı`
      : `${remainingDays} gün kaldı`;
  
  return {
    isDemo: true, // ✅ DEMO VERSİYON
    daysLeft: remainingDays,
    expiryDate: firstRunDate ? new Date(firstRunDate + TRIAL_DURATION).toISOString() : new Date().toISOString(),
    isExpired: isExpired,
    isTrialVersion: true,
    firstRunDate: firstRunDate ? new Date(firstRunDate).toLocaleDateString('tr-TR') : null,
    remainingDays,
    totalDays: TRIAL_DAYS,
    remainingMinutes,
    totalMinutes,
    isShortTrial,
    timeLeftText
  };
}

/**
 * Trial durumu kontrolü (Dashboard için)
 */
function checkTrialStatus() {
  try {
    const trialInfo = getTrialInfo();
    console.log('📊 [TRIAL-CHECKER] checkTrialStatus çağrıldı:', trialInfo);
    return {
      success: true,
      trialInfo: trialInfo
    };
  } catch (error) {
    console.error('❌ [TRIAL-CHECKER] checkTrialStatus hatası:', error);
    return {
      success: false,
      error: error.message,
      trialInfo: {
        isDemo: true,
        daysLeft: 0,
        expiryDate: new Date().toISOString(),
        isExpired: true
      }
    };
  }
}

module.exports = {
  checkTrial,
  getTrialInfo,
  checkTrialStatus,
  showTrialExpiredDialog,
  isTrialExpired,
  getRemainingDays
};
