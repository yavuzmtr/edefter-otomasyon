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

!macro customUnInit
  ; Kaldırma öncesi - Çalışan demo uygulamasını sonlandır
  DetailPrint "E-Defter Otomasyon DEMO kapatılıyor..."
  
  nsExec::ExecToLog 'taskkill /F /IM "E-Defter Otomasyon DEMO.exe" /T'
  Pop $0
  Sleep 1000
  
  DetailPrint "Demo uygulaması kapatıldı"
!macroend

!macro customUninstall
  ; Kaldırma sırasında - Tüm servisleri, trial checker ve ayarları temizle
  DetailPrint "Windows başlangıç ayarları ve demo servisleri temizleniyor..."
  
  ; Windows başlangıçtan kaldır (Registry temizliği)
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "E-Defter Otomasyon DEMO"
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "E-Defter Otomasyon DEMO"
  
  ; Electron auto-launch registry temizliği
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "E-Defter Otomasyon DEMO"
  
  ; Trial checker verilerini temizle (AppData)
  DetailPrint "Demo trial verileri temizleniyor..."
  RMDir /r "$APPDATA\e-defter-otomasyon-demo"
  RMDir /r "$LOCALAPPDATA\e-defter-otomasyon-demo"
  
  DetailPrint "Sistem ayarları ve demo verileri temizlendi"
  DetailPrint "Kaldırma işlemi tamamlandı"
!macroend
