; NSIS Custom Header for E-Defter Otomasyon
; This file contains helper macros and functions

; Kill application before uninstall
!macro KillApp appexe
  nsExec::Exec "taskkill /IM ${appexe} /F /T 2>nul"
  Sleep 500
!macroend

; Cleanup temporary files
!macro CleanupTemp
  RMDir /r "$LOCALAPPDATA\${APPNAME}\Temp"
  RMDir /r "$LOCALAPPDATA\${APPNAME}\Cache"
!macroend

; Remove application from Windows startup
!macro RemoveFromStartup
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "${APPNAME}"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APPNAME}"
!macroend

; Remove Windows Defender exclusions
!macro RemoveDefenderExclusions apppath
  DeleteRegValue HKLM "Software\Microsoft\Windows Defender\Exclusions\Paths" "${apppath}"
!macroend

; Display uninstall confirmation dialog with detailed info
!macro UninstallConfirmation
  MessageBox MB_YESNO|MB_ICONQUESTION "E-Defter Otomasyon'u kaldırmak istiyor musunuz?$\n$\nBu işlem:$\n- Uygulamayı tamamen silecek$\n- Tüm ayarları ve verileri silecek$\n- Tüm kısayolları silecek$\n$\nEmin misiniz?" IDNO abort
  goto continue
  abort:
    Abort
  continue:
!macroend

; Verify successful uninstall
!macro VerifyUninstall appdir
  ${If} ${FileExists} "${appdir}"
    MessageBox MB_ICONEXCLAMATION "Bazı dosyalar silinmedi. El ile silmeyi deneyebilirsiniz.$\n$\n${appdir}"
  ${EndIf}
!macroend
