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
