// DEMO VERSİYON BUILD SCRIPT
// Bu script demo versiyonu oluşturur
const fs = require('fs');
const path = require('path');

console.log('🔧 Demo Versiyon Hazırlanıyor...\n');

// 1. Orijinal main.cjs'i yedekle
const mainPath = path.join(__dirname, 'electron', 'main.cjs');
const backupPath = path.join(__dirname, 'electron', 'main.cjs.backup');

if (!fs.existsSync(backupPath)) {
  console.log('📦 Orijinal main.cjs yedekleniyor...');
  fs.copyFileSync(mainPath, backupPath);
}

// 2. main.cjs'i oku
let mainContent = fs.readFileSync(mainPath, 'utf8');

// 3. Trial checker import ekle (dosyanın başına)
const trialImport = `// ========== DEMO VERSION - TRIAL CHECKER ==========
const trialChecker = require('./trial-checker.cjs');
// ==================================================

`;

// 4. app.whenReady() içine trial kontrolü ekle
// app.whenReady kısmını bul ve trial checker'ı ekle
const whenReadyPattern = /app\.whenReady\(\)\.then\(\(\)\s*=>\s*{/;

if (whenReadyPattern.test(mainContent)) {
  // Eğer import yoksa ekle
  if (!mainContent.includes('trial-checker.cjs')) {
    mainContent = trialImport + mainContent;
  }
  
  // whenReady içine trial kontrolü ekle
  mainContent = mainContent.replace(
    whenReadyPattern,
    `app.whenReady().then(async () => {
  // ========== DEMO VERSION - TRIAL CHECK ==========
  const canContinue = await trialChecker.checkTrial();
  if (!canContinue) {
    return; // Trial expired, app will quit
  }
  // ==================================================
`
  );
  
  // 4. IPC handler ekle (trial bilgisi için)
  const ipcHandlerCode = `
// ========== DEMO VERSION - TRIAL INFO HANDLER ==========
ipcMain.handle('get-trial-info', async () => {
  return trialChecker.getTrialInfo();
});
// =======================================================
`;
  
  // IPC Handlers bölümünden sonra ekle
  const ipcHandlersPattern = /(\/\/ IPC Handlers)/;
  if (ipcHandlersPattern.test(mainContent)) {
    mainContent = mainContent.replace(ipcHandlersPattern, `$1\n${ipcHandlerCode}`);
  }
  
  // 5. Demo main.cjs'i kaydet
  const demoMainPath = path.join(__dirname, 'electron', 'main-demo.cjs');
  fs.writeFileSync(demoMainPath, mainContent, 'utf8');
  console.log('✅ Demo main-demo.cjs oluşturuldu');
  
  // 6. package.json'ı güncelle (demo için)
  const packagePath = path.join(__dirname, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  // Demo için ana dosyayı değiştir
  const demoPackageJson = { ...packageJson };
  demoPackageJson.main = 'electron/main-demo.cjs';
  demoPackageJson.name = 'edefter-automation-demo';
  demoPackageJson.description = 'E-Defter Klasör Otomasyonu - DEMO VERSİYON (5 Günlük Deneme)';
  
  // Geçici demo package.json kaydet
  const demoPackagePath = path.join(__dirname, 'package-demo.json');
  fs.writeFileSync(demoPackagePath, JSON.stringify(demoPackageJson, null, 2), 'utf8');
  console.log('✅ Demo package-demo.json oluşturuldu');
  
  // 7. electron-builder config oluştur (demo için)
  const builderConfig = {
    appId: 'com.edefter.klasorotomasyon.demo',
    productName: 'E-Defter Otomasyon DEMO',
    directories: {
      output: 'release-demo'
    },
    files: [
      'dist/**/*',
      'electron/main-demo.cjs',
      'electron/preload.cjs',
      'electron/license-manager.cjs',
      'electron/trial-checker.cjs',
      'node_modules/**/*',
      'package.json'
    ],
    extraResources: [
      {
        from: 'assets',
        to: 'assets'
      }
    ],
    win: {
      target: [
        {
          target: 'nsis',
          arch: ['x64']
        }
      ],
      icon: 'icon.ico',
      artifactName: '${productName} Setup ${version}.${ext}'
    },
    nsis: {
      oneClick: false,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      installerIcon: 'icon.ico',
      uninstallerIcon: 'icon.ico',
      installerHeaderIcon: 'icon.ico',
      deleteAppDataOnUninstall: false,
      shortcutName: 'E-Defter Otomasyon DEMO'
    },
    publish: null
  };
  
  const builderConfigPath = path.join(__dirname, 'electron-builder-demo.yml');
  const yaml = require('js-yaml');
  fs.writeFileSync(builderConfigPath, yaml.dump(builderConfig), 'utf8');
  console.log('✅ electron-builder-demo.yml oluşturuldu');
  
  // 8. package.json'ı geçici olarak değiştir (build için)
  const originalPackagePath = path.join(__dirname, 'package.json');
  const backupPackagePath = path.join(__dirname, 'package.json.build-backup');
  
  // Orijinal package.json'ı yedekle
  fs.copyFileSync(originalPackagePath, backupPackagePath);
  
  // Demo package.json'ı aktif yap
  fs.copyFileSync(demoPackagePath, originalPackagePath);
  console.log('✅ package.json geçici olarak demo versiyona değiştirildi');
  
  console.log('\n✅ Demo versiyon hazır!\n');
  console.log('📦 Demo build için şu komutu çalıştırın:');
  console.log('   npm run build-demo');
  console.log('\n⚠️  NOT: Build sonrası package.json.build-backup dosyasını package.json olarak geri yükleyin!\n');
  
} else {
  console.error('❌ Hata: app.whenReady() bulunamadı!');
  process.exit(1);
}
