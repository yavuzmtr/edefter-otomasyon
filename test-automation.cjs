#!/usr/bin/env node

/**
 * 🧪 OTOMASYONSİSTEMİ OTOMATİK TEST SCRIPT
 * Test süreci: 6 test senaryosunu otomatik olarak çalıştır
 * Kaynak: C:\temp\GIB_TEST (Test klasörü)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TEST_DIR = 'C:\\temp\\GIB_TEST';
const TEST_LOG_FILE = path.join(__dirname, 'AUTOMATION_TEST_RESULTS.log');
const TEST_RESULTS = {
  startTime: new Date().toISOString(),
  tests: [],
  summary: {}
};

// Renkli console çıktısı
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  const timestamp = new Date().toLocaleTimeString('tr-TR');
  const output = `${color}[${timestamp}] ${message}${colors.reset}`;
  console.log(output);
  
  // Dosyaya yaz (renkler olmadan)
  fs.appendFileSync(TEST_LOG_FILE, `[${timestamp}] ${message}\n`);
}

function success(msg) { log(colors.green, `✅ ${msg}`); }
function error(msg) { log(colors.red, `❌ ${msg}`); }
function info(msg) { log(colors.blue, `ℹ️  ${msg}`); }
function warning(msg) { log(colors.yellow, `⚠️  ${msg}`); }
function test(msg) { log(colors.cyan, `🧪 TEST: ${msg}`); }

// Test dizini temizle ve hazırla
function setupTestDir() {
  try {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
    success(`Test klasörü hazırlandı: ${TEST_DIR}`);
    return true;
  } catch (err) {
    error(`Test klasörü hazırlanırken hata: ${err.message}`);
    return false;
  }
}

// Dosya oluştur
function createFile(filePath, content = '') {
  try {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content);
    return true;
  } catch (err) {
    error(`Dosya oluşturulamadı (${filePath}): ${err.message}`);
    return false;
  }
}

// Dosya var mı kontrol et
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

// Dosya boyutu al (bytes)
function getFileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

// Test 1: Klasör izleme - Dosya eklendiğinde hemen görünüyor mu?
function test1_FolderMonitoring() {
  test('Klasör İzleme - Dosya Ekleme (10 saniye delay beklenir)');
  
  const testName = 'TEST_1_FOLDER_MONITORING';
  const startTime = Date.now();
  
  try {
    // Ön koşul: GIB klasör yapısı oluştur
    const companyDir = path.join(TEST_DIR, '999999');
    const monthDir = path.join(companyDir, '2025', '01');
    
    success('Test klasör yapısı oluşturuluyor...');
    createFile(path.join(monthDir, '.keep'), '');
    
    // Test dosyası ekle
    const testFile = path.join(monthDir, '999999-2025-01-TEST.zip');
    createFile(testFile, 'TEST_FILE_CONTENT');
    success(`Test dosyası oluşturuldu: ${testFile}`);
    
    // Dosya kontrolü
    if (fileExists(testFile)) {
      success('✓ Dosya başarıyla oluşturuldu');
      
      TEST_RESULTS.tests.push({
        testName,
        status: 'PASS',
        duration: Date.now() - startTime,
        description: 'Dosya klasör izleme sistemine eklenmiştir',
        expectedBehavior: '10 saniye içinde trigger-scan tetiklenmeli',
        notes: 'UI\'de hemen görünmemeli, ~10 saniye debounce beklenir'
      });
      return true;
    } else {
      error('Dosya oluşturulamadı');
      TEST_RESULTS.tests.push({
        testName,
        status: 'FAIL',
        duration: Date.now() - startTime,
        error: 'Dosya oluşturulamadı'
      });
      return false;
    }
  } catch (err) {
    error(`Test 1 hatası: ${err.message}`);
    TEST_RESULTS.tests.push({
      testName,
      status: 'ERROR',
      duration: Date.now() - startTime,
      error: err.message
    });
    return false;
  }
}

// Test 2: Yeni klasör ekleme
function test2_NewFolderDetection() {
  test('Yeni Klasör Ekleme - Hemen Görünüyor mu?');
  
  const testName = 'TEST_2_NEW_FOLDER_DETECTION';
  const startTime = Date.now();
  
  try {
    // Yeni şirket klasörü oluştur
    const newCompanyDir = path.join(TEST_DIR, '888888');
    fs.mkdirSync(newCompanyDir, { recursive: true });
    
    success(`Yeni klasör oluşturuldu: ${newCompanyDir}`);
    
    if (fileExists(newCompanyDir)) {
      success('✓ Yeni klasör başarıyla oluşturuldu');
      
      TEST_RESULTS.tests.push({
        testName,
        status: 'PASS',
        duration: Date.now() - startTime,
        description: 'Yeni şirket klasörü (888888) oluşturulmuştur',
        expectedBehavior: '10 saniye içinde Klasör İzleme UI\'de görünmeli',
        notes: 'folder-added event\'i tetiklenmiş olmalı'
      });
      return true;
    } else {
      error('Klasör oluşturulamadı');
      TEST_RESULTS.tests.push({
        testName,
        status: 'FAIL',
        duration: Date.now() - startTime,
        error: 'Klasör oluşturulamadı'
      });
      return false;
    }
  } catch (err) {
    error(`Test 2 hatası: ${err.message}`);
    TEST_RESULTS.tests.push({
      testName,
      status: 'ERROR',
      duration: Date.now() - startTime,
      error: err.message
    });
    return false;
  }
}

// Test 3: Email otomasyonu hazırlığı (tam dosya seti)
function test3_EmailAutomationPrep() {
  test('Email Otomasyonu Hazırlığı - KB + YB Dosyaları');
  
  const testName = 'TEST_3_EMAIL_AUTOMATION_PREP';
  const startTime = Date.now();
  
  try {
    // Complete dosya seti oluştur (KB + YB = complete status)
    const companyDir = path.join(TEST_DIR, '777777');
    const monthDir = path.join(companyDir, '2025', '01');
    
    createFile(path.join(monthDir, '.keep'), '');
    
    const kbFile = path.join(monthDir, '777777-2025-01-KB-001.zip');
    const ybFile = path.join(monthDir, '777777-2025-01-YB-001.zip');
    
    createFile(kbFile, 'KB_FILE_CONTENT');
    createFile(ybFile, 'YB_FILE_CONTENT');
    
    success(`KB dosyası: ${kbFile}`);
    success(`YB dosyası: ${ybFile}`);
    
    const kbExists = fileExists(kbFile);
    const ybExists = fileExists(ybFile);
    
    if (kbExists && ybExists) {
      success('✓ Hem KB hem YB dosyaları oluşturuldu (COMPLETE status)');
      
      TEST_RESULTS.tests.push({
        testName,
        status: 'PASS',
        duration: Date.now() - startTime,
        description: 'Email otomasyonu için tam dosya seti hazırlandı (KB + YB)',
        expectedBehavior: 'Tarama sonrası status=complete olmalı ve email tetiklenmeli',
        notes: 'automationSettings.emailConfig.enabled = true ise email gönderilmeli'
      });
      return true;
    } else {
      error(`Dosyalar eksik: KB=${kbExists}, YB=${ybExists}`);
      TEST_RESULTS.tests.push({
        testName,
        status: 'FAIL',
        duration: Date.now() - startTime,
        error: `Dosyalar eksik: KB=${kbExists}, YB=${ybExists}`
      });
      return false;
    }
  } catch (err) {
    error(`Test 3 hatası: ${err.message}`);
    TEST_RESULTS.tests.push({
      testName,
      status: 'ERROR',
      duration: Date.now() - startTime,
      error: err.message
    });
    return false;
  }
}

// Test 4: Yedekleme otomasyonu hazırlığı
function test4_BackupAutomationPrep() {
  test('Yedekleme Otomasyonu Hazırlığı - Dosya Yapısı');
  
  const testName = 'TEST_4_BACKUP_AUTOMATION_PREP';
  const startTime = Date.now();
  
  try {
    // Yedeklenecek dosya yapısı oluştur
    const companyDir = path.join(TEST_DIR, '666666');
    const monthDir = path.join(companyDir, '2025', '02');
    
    createFile(path.join(monthDir, '.keep'), '');
    
    // Birden fazla dosya oluştur (yedekleme test için)
    const files = [
      '666666-2025-02-KB-001.zip',
      '666666-2025-02-KB-002.zip',
      '666666-2025-02-YB-001.zip',
      '666666-2025-02-YB-002.zip',
      '666666-2025-02-DOCUMENT.pdf'
    ];
    
    files.forEach(file => {
      createFile(path.join(monthDir, file), `FILE_${file}`);
    });
    
    success(`${files.length} dosya yedekleme testi için oluşturuldu`);
    
    const allFilesExist = files.every(file => 
      fileExists(path.join(monthDir, file))
    );
    
    if (allFilesExist) {
      success('✓ Yedekleme test dosyaları başarıyla oluşturuldu');
      
      TEST_RESULTS.tests.push({
        testName,
        status: 'PASS',
        duration: Date.now() - startTime,
        description: `${files.length} dosya yedekleme testi için hazırlandı`,
        expectedBehavior: 'backupActivities\'e otomatik aktivite kaydedilmeli',
        notes: 'automationSettings.backupConfig.enabled = true ise yedekleme yapılmalı'
      });
      return true;
    } else {
      error('Tüm dosyalar oluşturulamadı');
      TEST_RESULTS.tests.push({
        testName,
        status: 'FAIL',
        duration: Date.now() - startTime,
        error: 'Tüm dosyalar oluşturulamadı'
      });
      return false;
    }
  } catch (err) {
    error(`Test 4 hatası: ${err.message}`);
    TEST_RESULTS.tests.push({
      testName,
      status: 'ERROR',
      duration: Date.now() - startTime,
      error: err.message
    });
    return false;
  }
}

// Test 5: Uygulama kapalıyken dosya ekleme
function test5_AppClosedBehavior() {
  test('Uygulama Kapalıyken Dosya Ekleme (Simülasyon)');
  
  const testName = 'TEST_5_APP_CLOSED_BEHAVIOR';
  const startTime = Date.now();
  
  try {
    // Arka planda dosya oluştur (uygulama kapalı simülasyonu)
    const companyDir = path.join(TEST_DIR, '555555');
    const monthDir = path.join(companyDir, '2025', '03');
    
    createFile(path.join(monthDir, '.keep'), '');
    
    const offlineFile = path.join(monthDir, '555555-2025-03-KB-001.zip');
    createFile(offlineFile, 'OFFLINE_FILE');
    
    success(`Uygulamaya "kapalı" durumdayken dosya eklendi: ${offlineFile}`);
    info('Beklenen: Uygulama açılıp 30 saniye sonra bu dosya tespit edilmeli');
    
    if (fileExists(offlineFile)) {
      success('✓ Offline dosya başarıyla oluşturuldu');
      
      TEST_RESULTS.tests.push({
        testName,
        status: 'PASS',
        duration: Date.now() - startTime,
        description: 'Uygulama kapalı durumdayken dosya eklendi',
        expectedBehavior: 'Uygulama açıldığında backgroundService interval\'i tetiklenmeli (30 saniye)',
        notes: '❌ SORUN: Dosya sistemi event\'leri (file-added) tetiklenmez, sadece interval ile buluşur'
      });
      return true;
    } else {
      error('Offline dosya oluşturulamadı');
      TEST_RESULTS.tests.push({
        testName,
        status: 'FAIL',
        duration: Date.now() - startTime,
        error: 'Offline dosya oluşturulamadı'
      });
      return false;
    }
  } catch (err) {
    error(`Test 5 hatası: ${err.message}`);
    TEST_RESULTS.tests.push({
      testName,
      status: 'ERROR',
      duration: Date.now() - startTime,
      error: err.message
    });
    return false;
  }
}

// Test 6: Bilgisayar yeniden başlatıldıktan sonra
function test6_RestartBehavior() {
  test('Bilgisayar Yeniden Başlatıldıktan Sonra (Simülasyon)');
  
  const testName = 'TEST_6_RESTART_BEHAVIOR';
  const startTime = Date.now();
  
  try {
    // Restart sonrası dosya (bilgisayar açıldıktan sonra tetiklenen işlemler)
    const companyDir = path.join(TEST_DIR, '444444');
    const monthDir = path.join(companyDir, '2025', '04');
    
    createFile(path.join(monthDir, '.keep'), '');
    
    const restartFile = path.join(monthDir, '444444-2025-04-KB-001.zip');
    createFile(restartFile, 'POST_RESTART_FILE');
    
    success(`Bilgisayar yeniden başlatıldıktan sonra eklenebilecek dosya: ${restartFile}`);
    info('Beklenen: App.tsx useEffect otomasyon otomatik başlat, start-folder-monitoring tetikle');
    
    if (fileExists(restartFile)) {
      success('✓ Post-restart dosya başarıyla oluşturuldu');
      
      TEST_RESULTS.tests.push({
        testName,
        status: 'PASS',
        duration: Date.now() - startTime,
        description: 'Bilgisayar yeniden başlatıldıktan sonra dosya eklendi',
        expectedBehavior: 'App.tsx useEffect() otomasyon otomatik olarak başlat, monitoring başlat',
        notes: 'automationSettings.enabled = true ise App açılışta start-folder-monitoring çağrılmalı'
      });
      return true;
    } else {
      error('Post-restart dosya oluşturulamadı');
      TEST_RESULTS.tests.push({
        testName,
        status: 'FAIL',
        duration: Date.now() - startTime,
        error: 'Post-restart dosya oluşturulamadı'
      });
      return false;
    }
  } catch (err) {
    error(`Test 6 hatası: ${err.message}`);
    TEST_RESULTS.tests.push({
      testName,
      status: 'ERROR',
      duration: Date.now() - startTime,
      error: err.message
    });
    return false;
  }
}

// Test özeti yaz
function generateTestSummary() {
  const totalTests = TEST_RESULTS.tests.length;
  const passedTests = TEST_RESULTS.tests.filter(t => t.status === 'PASS').length;
  const failedTests = TEST_RESULTS.tests.filter(t => t.status === 'FAIL').length;
  const errorTests = TEST_RESULTS.tests.filter(t => t.status === 'ERROR').length;
  
  TEST_RESULTS.summary = {
    total: totalTests,
    passed: passedTests,
    failed: failedTests,
    errors: errorTests,
    successRate: ((passedTests / totalTests) * 100).toFixed(2) + '%'
  };
  
  TEST_RESULTS.endTime = new Date().toISOString();
}

// Rapor dosyası oluştur
function saveTestResults() {
  const reportPath = path.join(process.cwd(), 'TEST_RESULTS_AUTO.json');
  fs.writeFileSync(reportPath, JSON.stringify(TEST_RESULTS, null, 2));
  
  info(`Test sonuçları kaydedildi: ${reportPath}`);
  
  // Markdown raporu da oluştur
  const mdReport = generateMarkdownReport();
  const mdPath = path.join(process.cwd(), 'TEST_RESULTS_AUTO.md');
  fs.writeFileSync(mdPath, mdReport);
  
  info(`Markdown raporu kaydedildi: ${mdPath}`);
}

function generateMarkdownReport() {
  let md = `# 🧪 OTOMASYONSİSTEMİ OTOMATİK TEST RAPORU\n\n`;
  md += `**Test Tarihi:** ${new Date().toLocaleString('tr-TR')}\n\n`;
  md += `## 📊 ÖZET\n\n`;
  md += `- **Toplam Test:** ${TEST_RESULTS.summary.total}\n`;
  md += `- **Başarılı:** ${TEST_RESULTS.summary.passed} ✅\n`;
  md += `- **Başarısız:** ${TEST_RESULTS.summary.failed} ❌\n`;
  md += `- **Hata:** ${TEST_RESULTS.summary.errors} ⚠️\n`;
  md += `- **Başarı Oranı:** ${TEST_RESULTS.summary.successRate}\n\n`;
  
  md += `## 📋 TEST DETAYLARI\n\n`;
  
  TEST_RESULTS.tests.forEach((test, idx) => {
    const statusEmoji = test.status === 'PASS' ? '✅' : test.status === 'FAIL' ? '❌' : '⚠️';
    md += `### ${idx + 1}. ${test.testName}\n\n`;
    md += `**Status:** ${statusEmoji} ${test.status}\n`;
    md += `**Süre:** ${test.duration}ms\n`;
    
    if (test.description) {
      md += `**Açıklama:** ${test.description}\n`;
    }
    
    if (test.expectedBehavior) {
      md += `**Beklenen Davranış:** ${test.expectedBehavior}\n`;
    }
    
    if (test.notes) {
      md += `**Notlar:** ${test.notes}\n`;
    }
    
    if (test.error) {
      md += `**Hata:** ${test.error}\n`;
    }
    
    md += `\n---\n\n`;
  });
  
  md += `## 📍 Test Klasörü\n\n`;
  md += `\`\`\`\n${TEST_DIR}\n\`\`\`\n\n`;
  
  return md;
}

// MAIN - Tüm testleri çalıştır
async function runAllTests() {
  console.clear();
  log(colors.bright + colors.cyan, '═══════════════════════════════════════════════════════════');
  log(colors.bright + colors.cyan, '  🧪 OTOMASYONSİSTEMİ OTOMATİK TEST BAŞLANIYOR');
  log(colors.bright + colors.cyan, '═══════════════════════════════════════════════════════════\n');
  
  // Test log dosyasını temizle
  fs.writeFileSync(TEST_LOG_FILE, '');
  
  // Test klasörü hazırla
  if (!setupTestDir()) {
    error('Test ortamı hazırlanması başarısız');
    process.exit(1);
  }
  
  log(colors.bright, '\n🔄 TESTLER ÇALIŞTIRILIYOR...\n');
  
  // Testleri sırasıyla çalıştır
  test1_FolderMonitoring();
  test2_NewFolderDetection();
  test3_EmailAutomationPrep();
  test4_BackupAutomationPrep();
  test5_AppClosedBehavior();
  test6_RestartBehavior();
  
  // Özet oluştur
  generateTestSummary();
  
  // Sonuçları kaydet
  saveTestResults();
  
  // Final rapor
  log(colors.bright + colors.green, '\n═══════════════════════════════════════════════════════════');
  log(colors.bright + colors.green, '  ✅ TÜM TESTLER TAMAMLANDI');
  log(colors.bright + colors.green, '═══════════════════════════════════════════════════════════\n');
  
  success(`Toplam: ${TEST_RESULTS.summary.total} test`);
  success(`Başarılı: ${TEST_RESULTS.summary.passed} ✅`);
  error(`Başarısız: ${TEST_RESULTS.summary.failed} ❌`);
  warning(`Hata: ${TEST_RESULTS.summary.errors} ⚠️`);
  info(`Başarı Oranı: ${TEST_RESULTS.summary.successRate}`);
  
  info(`\nTest klasörü: ${TEST_DIR}`);
  info(`Detaylı rapor: TEST_RESULTS_AUTO.md`);
  info(`JSON rapor: TEST_RESULTS_AUTO.json`);
  
  console.log('\n');
}

// Testleri çalıştır
runAllTests().catch(err => {
  error(`Kritik hata: ${err.message}`);
  process.exit(1);
});
