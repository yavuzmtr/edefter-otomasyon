// DEMO VERSİYON - DENEME SÜRESİ KONTROLÜ
// Bu dosya sadece demo versiyonda kullanılır
const Store = require('electron-store');
const { app, dialog } = require('electron');
const os = require('os');
const crypto = require('crypto');

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

const trialStore = new Store({ 
  name: 'trial-data',
  cwd: app.getPath('userData')
});

// DEMO SÜRÜM: 15 günlük deneme süresi
const TRIAL_DAYS = 15;
const TRIAL_DURATION = 15 * 24 * 60 * 60 * 1000; // 15 gün (1296000000 ms)

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
    safeLog('[DEMO] Trial data path:', app.getPath('userData'));
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
  
  return elapsed > TRIAL_DURATION;
}

/**
 * Demo süresi uyarısı gösterir ve uygulamayı kapatır
 */
async function showTrialExpiredDialog() {
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
  
  return {
    isTrialVersion: true,
    firstRunDate: firstRunDate ? new Date(firstRunDate).toLocaleDateString('tr-TR') : null,
    remainingDays,
    isExpired,
    totalDays: TRIAL_DAYS
  };
}

module.exports = {
  checkTrial,
  getTrialInfo,
  isTrialExpired,
  getRemainingDays
};
