; NSIS Custom Installer Script - Tam Sürüm
; Kurulum öncesi çalışan uygulamayı sonlandırır

!macro customInit
  ; Eski process'leri sonlandır
  DetailPrint "Çalışan E-Defter Otomasyon uygulaması kontrol ediliyor..."
  
  ; taskkill ile sonlandır
  nsExec::ExecToLog 'taskkill /F /IM "E-Defter Otomasyon.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "E-Defter Otomasyon DEMO.exe" /T'
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
  DetailPrint "E-Defter Otomasyon kapatılıyor..."
  
  nsExec::ExecToLog 'taskkill /F /IM "E-Defter Otomasyon.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "E-Defter Otomasyon DEMO.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "E-Defter Klasör Otomasyonu.exe" /T'
  Pop $0
  Sleep 1000
  
  DetailPrint "Uygulama kapatıldı"
!macroend

!macro customUninstall
  ; Kaldırma sırasında - Tüm servisleri ve ayarları temizle
  DetailPrint "Windows başlangıç ayarları temizleniyor..."
  
  ; Windows başlangıçtan kaldır (Registry temizliği)
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "E-Defter Otomasyon"
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "E-Defter Otomasyon"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "E-Defter Klasör Otomasyonu"
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "E-Defter Klasör Otomasyonu"
  
  ; Electron auto-launch registry temizliği
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "E-Defter Otomasyon"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "E-Defter Klasör Otomasyonu"

  ; Silent uninstall ise tam temizlik yap
  IfSilent do_full_cleanup

  ; Kullaniciya veri saklama secenegi sun
  MessageBox MB_ICONQUESTION|MB_YESNO "Kullanici verileri (ayarlar, loglar, cache) korunsun mu?$\r$\n$\r$\nEvet: Sadece program dosyalari kaldirilir.$\r$\nHayir: Tum veriler tamamen temizlenir." IDYES keep_user_data

  ; Tam temizlik (AppData + kurulum kalintilari)
do_full_cleanup:
  DetailPrint "Uygulama verileri temizleniyor..."
  RMDir /r "$APPDATA\edefter-automation"
  RMDir /r "$APPDATA\edefter-app"
  RMDir /r "$APPDATA\edefter-automation-demo"
  RMDir /r "$APPDATA\e-defter-otomasyon-demo"
  RMDir /r "$APPDATA\edefter-uninstaller"
  RMDir /r "$LOCALAPPDATA\edefter-automation"
  RMDir /r "$LOCALAPPDATA\edefter-app"
  RMDir /r "$LOCALAPPDATA\edefter-automation-updater"
  RMDir /r "$LOCALAPPDATA\edefter-automation-demo-updater"
  RMDir /r "$LOCALAPPDATA\Programs\E-Defter Otomasyon"
  RMDir /r "$LOCALAPPDATA\Programs\E-Defter Otomasyon DEMO"
  RMDir /r "$LOCALAPPDATA\Programs\edefter-automation"
  RMDir /r "$PROGRAMFILES\E-Defter Otomasyon DEMO"
  RMDir /r "$PROGRAMFILES64\E-Defter Otomasyon DEMO"
  RMDir /r "$INSTDIR"
  Goto done_cleanup

keep_user_data:
  DetailPrint "Kullanici secimi: Veriler korunuyor, sadece program kaldiriliyor."

done_cleanup:
  ; Bos kurulum klasoru kalmasin
  RMDir "$INSTDIR"
  ; Uninstaller cikisi sonrasinda kalan bos klasoru da sil
  Exec '"$SYSDIR\cmd.exe" /C ping 127.0.0.1 -n 3 >NUL & rmdir /S /Q "$LOCALAPPDATA\Programs\E-Defter Otomasyon"'
  DetailPrint "Sistem ayarları temizlendi"
  DetailPrint "Kaldırma işlemi tamamlandı"
!macroend
