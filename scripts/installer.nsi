; E-Defter Otomasyon NSIS Installer Script
; Complete uninstall and cleanup script

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "nsDialogs.nsh"

; Compiler Flags
SetCompress auto
SetDatablockOptimize on
SetOverwrite on
RequestExecutionLevel admin

; Constants
!define APPNAME "E-Defter Otomasyon"
!define APPVERSION "1.0.0"
!define APPEXE "E-Defter Otomasyon.exe"
!define APPCOMPANY "E-Defter"

; Installation directories
InstallDir "$PROGRAMFILES\${APPNAME}"
InstallDirRegKey HKLM "Software\${APPNAME}" "InstallLocation"

; MUI Settings
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_LANGUAGE "Turkish"

; Installer sections
Section "Install"
  SetOutPath "$INSTDIR"
  
  ; Install application files
  File /r "release\win-unpacked\*.*"
  
  ; Create uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"
  
  ; Registry entries for uninstall
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" \
    "DisplayName" "${APPNAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" \
    "DisplayVersion" "${APPVERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" \
    "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" \
    "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" \
    "DisplayIcon" "$INSTDIR\${APPEXE},0"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" \
    "Publisher" "${APPCOMPANY}"
  
  ; Store install location
  WriteRegStr HKLM "Software\${APPNAME}" "InstallLocation" "$INSTDIR"
  
  ; Create Start Menu shortcuts
  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\${APPEXE}"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\Uninstall.lnk" "$INSTDIR\uninstall.exe"
  
  ; Create Desktop shortcut
  CreateShortcut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${APPEXE}"
SectionEnd

; Uninstaller section
Section "Uninstall"
  ; Kill running process
  nsExec::Exec "taskkill /IM ${APPEXE} /F /T"
  
  ; Wait for process termination
  Sleep 1000
  
  ; Remove application files
  RMDir /r "$INSTDIR"
  
  ; Remove app data folder (user settings, cache, logs)
  RMDir /r "$APPDATA\edefter-otomasyon"
  
  ; Remove shortcuts
  RMDir /r "$SMPROGRAMS\${APPNAME}"
  Delete "$DESKTOP\${APPNAME}.lnk"
  
  ; Remove registry entries
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
  DeleteRegKey HKLM "Software\${APPNAME}"
  
  ; Remove File Association if created
  DeleteRegKey HKCU "Software\Classes\.edefter"
  DeleteRegKey HKCU "Software\Classes\${APPNAME}.edefter"
  
  ; Remove from PATH if added
  DeleteRegValue HKLM "System\CurrentControlSet\Control\Session Manager\Environment" "${APPNAME}_HOME"
  
  ; Remove startup registry entries (if AutoStart was enabled)
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "${APPNAME}"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APPNAME}"
  
  ; Remove Windows Defender Exclusions if added
  DeleteRegKey HKLM "Software\Microsoft\Windows Defender\Exclusions\Paths"
  
  ; Delete temporary files
  RMDir /r "$LOCALAPPDATA\${APPNAME}"
  
  ; Display message
  MessageBox MB_ICONINFORMATION|MB_OK "E-Defter Otomasyon başarıyla kaldırılmıştır. Tüm ayarlar ve veriler silinmiştir."
SectionEnd

; Init function
Function .onInit
  RequestExecutionLevel admin
FunctionEnd

; Uninstaller init function
Function un.onInit
  RequestExecutionLevel admin
FunctionEnd
