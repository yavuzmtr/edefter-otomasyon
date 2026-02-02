; NSIS Custom Installer Script - Tam Sürüm
; Kurulum öncesi çalışan uygulamayı sonlandırır

!macro customInit
  ; Eski process'leri sonlandır
  DetailPrint "Çalışan E-Defter Klasör Otomasyonu uygulaması kontrol ediliyor..."
  
  ; taskkill ile sonlandır
  nsExec::ExecToLog 'taskkill /F /IM "E-Defter Klasör Otomasyonu.exe" /T'
  Pop $0
  
  ${If} $0 == 0
    DetailPrint "Eski uygulama başarıyla sonlandırıldı"
    Sleep 1000
  ${Else}
    DetailPrint "Uygulama çalışmıyor veya zaten kapalı"
  ${EndIf}
  
  DetailPrint "Kurulum devam ediyor..."
!macroend

!macro customInstall
  ; Kurulum sonrası işlemler
  DetailPrint "Kurulum tamamlandı"
!macroend

!macro customUnInit
  ; Kaldırma öncesi - Çalışan uygulamayı sonlandır
  DetailPrint "E-Defter Klasör Otomasyonu kapatılıyor..."
  
  nsExec::ExecToLog 'taskkill /F /IM "E-Defter Klasör Otomasyonu.exe" /T'
  Pop $0
  Sleep 1000
  
  DetailPrint "Uygulama kapatıldı"
!macroend

!macro customUninstall
  ; Kaldırma sırasında - Tüm servisleri ve ayarları temizle
  DetailPrint "Windows başlangıç ayarları temizleniyor..."
  
  ; Windows başlangıçtan kaldır (Registry temizliği)
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "E-Defter Klasör Otomasyonu"
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "E-Defter Klasör Otomasyonu"
  
  ; Electron auto-launch registry temizliği
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "E-Defter Klasör Otomasyonu"
  
  DetailPrint "Sistem ayarları temizlendi"
  DetailPrint "Kaldırma işlemi tamamlandı"
!macroend
