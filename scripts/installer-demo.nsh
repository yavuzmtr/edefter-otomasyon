; NSIS Custom Installer Script - Demo Sürüm
; Kurulum öncesi çalışan demo uygulamasını sonlandırır
; NOT: Trial data silinmiyor - hardware ID ile korunuyor

!macro customInit
  ; Eski demo process'leri sonlandır
  DetailPrint "Çalışan E-Defter Otomasyon DEMO uygulaması kontrol ediliyor..."
  
  ; KillProc plugin kullanmadan taskkill ile
  nsExec::ExecToLog 'taskkill /F /IM "E-Defter Otomasyon DEMO.exe" /T'
  Pop $0
  
  ${If} $0 == 0
    DetailPrint "Eski demo uygulaması başarıyla sonlandırıldı"
    Sleep 1000
  ${Else}
    DetailPrint "Demo uygulaması çalışmıyor veya zaten kapalı"
  ${EndIf}
  
  ; Trial data KORUNUYOR - hardware ID ile yönetiliyor
  DetailPrint "Demo trial sistemi hardware ID ile korunuyor"
!macroend

!macro customInstall
  ; Kurulum sonrası temizlik
  DetailPrint "Kurulum tamamlandı"
!macroend
