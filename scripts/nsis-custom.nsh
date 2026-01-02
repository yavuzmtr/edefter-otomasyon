; NSIS Custom Hooks - Additional uninstall customizations

; Pre-uninstall confirmation
Function un.onInit
  ; Request admin rights
  RequestExecutionLevel admin
  
  ; Display comprehensive uninstall warning
  MessageBox MB_YESNO|MB_ICONWARNING \
    "E-Defter Otomasyon kaldırılacaktır.$\n$\nBu işlem aşağıdakileri yapacak:$\n$\n\
    ✓ Uygulamayı tamamen silecek$\n\
    ✓ Tüm yapılandırmaları kaldıracak$\n\
    ✓ Tüm önbelleği temizleyecek$\n\
    ✓ Başlat Menüsü kısayollarını silecek$\n\
    ✓ Registry girdilerini kaldıracak$\n\
    ✓ Masaüstü kısayolunu silecek$\n$\n\
    Devam etmek istediğinizden emin misiniz?" \
    IDNO abort
  goto continue
  abort:
    Abort
  continue:
FunctionEnd

; Post-uninstall cleanup
Function un.onUninstSuccess
  ; Final cleanup message
  MessageBox MB_ICONINFORMATION|MB_OK \
    "E-Defter Otomasyon başarıyla kaldırılmıştır.$\n$\n\
    Tüm dosyalar silinmiş ve sistem temizlenmiştir.$\n$\n\
    Teşekkür ederiz!"
FunctionEnd

; Handle uninstall errors
Function un.onUserAbort
  MessageBox MB_ICONEXCLAMATION|MB_OK \
    "Uninstall işlemi kullanıcı tarafından iptal edildi.$\n$\n\
    Uygulamanız hâlâ sisteminizde yüklü durumdadır."
FunctionEnd

; Detailed uninstall log
!define UNINSTALL_LOG "$INSTDIR\uninstall.log"

!macro DetailedLog message
  FileOpen $0 "${UNINSTALL_LOG}" "a"
  FileWrite $0 "$\r$\n[${message}]"
  FileClose $0
!macroend

; Function to safely remove registry entries with logging
Function un.SafeDelRegKey
  Pop $R0  ; registry key
  Pop $R1  ; registry path
  
  ; Log operation
  !insertmacro DetailedLog "Removing: ${R1}\${R0}"
  
  ; Delete with error handling
  DeleteRegKey ${R1} "${R0}"
  ${If} ${Errors}
    !insertmacro DetailedLog "ERROR: Failed to delete ${R0}"
  ${EndIf}
FunctionEnd

; Function to safely remove directories with logging
Function un.SafeDelDir
  Pop $0  ; directory path
  
  ; Log operation
  !insertmacro DetailedLog "Removing directory: $0"
  
  ; Delete with error handling
  RMDir /r "$0"
  ${If} ${Errors}
    !insertmacro DetailedLog "ERROR: Failed to delete $0"
  ${EndIf}
FunctionEnd

; Function to safely remove files with logging
Function un.SafeDelFile
  Pop $0  ; file path
  
  ; Log operation
  !insertmacro DetailedLog "Removing file: $0"
  
  ; Delete with error handling
  Delete "$0"
  ${If} ${Errors}
    !insertmacro DetailedLog "ERROR: Failed to delete $0"
  ${EndIf}
FunctionEnd

; Wait for process to terminate
!macro WaitForProcessExit processname timeout
  Push 0
  loop:
    FindProcDLL::FindProc "${processname}"
    ${If} $R0 == 0
      IntOp $0 $0 + 1
      ${If} $0 < ${timeout}
        Sleep 100
        Goto loop
      ${EndIf}
    ${Else}
      ; Process terminated
      !insertmacro DetailedLog "Process ${processname} terminated"
    ${EndIf}
FunctionEnd

; Final verification
!macro VerifyCleanUninstall appdir
  ${If} ${FileExists} "${appdir}"
    MessageBox MB_ICONEXCLAMATION|MB_OKCANCEL \
      "Bazı dosyalar silinmemiştir:$\n$\n${appdir}$\n$\n\
      El ile silmeyi deneyebilirsiniz.$\n$\n\
      Hataları rapor etmek ister misiniz?" \
      IDCANCEL skip_report
    ; Open log file
    Exec "notepad.exe $INSTDIR\uninstall.log"
    skip_report:
  ${EndIf}
!macroend
