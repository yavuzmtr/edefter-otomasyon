; NSIS Custom Installer Script - Demo Sürüm
; Kurulum öncesi çalışan demo uygulamasını sonlandırır
; Trial data da uninstall sirasinda temizlenir

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
  
  ; Trial data durumu
  DetailPrint "Demo trial data uninstall sirasinda temizlenecek"
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
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "E-Defter Otomasyon"
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "E-Defter Otomasyon DEMO"
  
  ; Electron auto-launch registry temizliği
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "E-Defter Otomasyon DEMO"
  
  ; Trial checker verilerini temizle (AppData)
  DetailPrint "Demo trial verileri temizleniyor..."
  RMDir /r "$APPDATA\e-defter-otomasyon-demo"
  RMDir /r "$APPDATA\edefter-automation-demo"
  RMDir /r "$APPDATA\edefter-automation"
  RMDir /r "$LOCALAPPDATA\e-defter-otomasyon-demo"
  RMDir /r "$LOCALAPPDATA\edefter-automation-demo-updater"
  RMDir /r "$LOCALAPPDATA\edefter-automation-updater"
  RMDir /r "$PROGRAMFILES\E-Defter Otomasyon DEMO"
  RMDir /r "$PROGRAMFILES64\E-Defter Otomasyon DEMO"
  RMDir /r "$INSTDIR"
  
  DetailPrint "Sistem ayarları ve demo verileri temizlendi"
  DetailPrint "Kaldırma işlemi tamamlandı"
!macroend
