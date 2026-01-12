# E-Defter Otomasyon - Gereksiz Dosya Temizleme Scripti
# Çalıştır: cd c:\Users\NUMAN\Desktop\deneme\bolt\0112xxxproject; .\cleanup-workspace.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

Write-Host "🧹 E-Defter Otomasyon Workspace Temizliği Başlıyor..." -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────────────────" -ForegroundColor Gray

# Silinecek dosya desenleri
$patternsToDelete = @(
    "*.md",  # Tüm markdown dosyaları (dokümantasyon hariç)
    "*.bat", # Batch scripti
    "*.ps1", # PowerShell scripti (bu dosya hariç)
    "*.js",  # Test JavaScript
    "*.mjs", # ES Module test
    "*.cjs"  # CommonJS test
)

# Korunacak dosyalar (wildcard'a rağmen silinmeyecek)
$filesToKeep = @(
    "PROGRESS-TRACKER.md",
    "README.md",
    "TEST-KILAVUZU.md",
    "eslint.config.js",
    "vite.config.ts",
    "postcss.config.js"
)

$deletedCount = 0
$skippedCount = 0

Write-Host "📋 Silinecek dosyalar:" -ForegroundColor Yellow

# Root klasöründe dosyaları tara
Get-ChildItem -Path "." -File -ErrorAction SilentlyContinue | ForEach-Object {
    $fileName = $_.Name
    $shouldDelete = $false
    
    # Desenleri kontrol et
    foreach ($pattern in $patternsToDelete) {
        if ($fileName -like $pattern) {
            $shouldDelete = $true
            break
        }
    }
    
    # Korunan dosyaları kontrol et
    if ($filesToKeep -contains $fileName) {
        $shouldDelete = $false
    }
    
    if ($shouldDelete) {
        try {
            Remove-Item $_ -Force -ErrorAction Stop
            Write-Host "  ✅ Silindi: $fileName" -ForegroundColor Green
            $deletedCount++
        } catch {
            Write-Host "  ❌ Silinemedi: $fileName - $_" -ForegroundColor Red
        }
    } else {
        $skippedCount++
    }
}

Write-Host ""
Write-Host "📁 Silinecek klasörler:" -ForegroundColor Yellow

# test-data klasörünü sil
if (Test-Path "test-data") {
    try {
        Remove-Item "test-data" -Recurse -Force -ErrorAction Stop
        Write-Host "  ✅ Silindi: test-data/" -ForegroundColor Green
        $deletedCount++
    } catch {
        Write-Host "  ❌ Silinemedi: test-data/ - $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "─────────────────────────────────────────────────────" -ForegroundColor Gray
Write-Host "✅ Temizlik Tamamlandı!" -ForegroundColor Green
Write-Host "   Silinen: $deletedCount dosya/klasör" -ForegroundColor Green
Write-Host "   Korunan: $skippedCount dosya" -ForegroundColor Green
Write-Host ""
Write-Host "🔄 Şimdi Git'i senkronize etmek için çalıştır:" -ForegroundColor Cyan
Write-Host "   git status" -ForegroundColor Gray
Write-Host "   git add -A" -ForegroundColor Gray
Write-Host "   git commit -m 'Cleanup: Gereksiz test/debug dosyaları silindi'" -ForegroundColor Gray
Write-Host "   git push" -ForegroundColor Gray
