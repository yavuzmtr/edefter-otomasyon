@echo off
setlocal
echo === Brevo SMTP ayarlari ===
:ask_user
set /p BREVO_SMTP_USER=Brevo SMTP user (email): 
if "%BREVO_SMTP_USER%"=="" goto ask_user
:ask_key
set /p BREVO_SMTP_KEY=Brevo SMTP key: 
if "%BREVO_SMTP_KEY%"=="" goto ask_key
set /p BREVO_FROM=From email (bos birakirsan user kullanilir): 
if "%BREVO_FROM%"=="" set "BREVO_FROM=%BREVO_SMTP_USER%"
echo.
echo Kullanilan SMTP_USER: %BREVO_SMTP_USER%
echo Kullanilan FROM: %BREVO_FROM%
echo SMTP_KEY ayarlandi.
echo.
echo Lisans yoneticisi baslatiliyor...
pushd "%~dp0.."
set "BREVO_SMTP_USER=%BREVO_SMTP_USER%"
set "BREVO_SMTP_KEY=%BREVO_SMTP_KEY%"
set "BREVO_FROM=%BREVO_FROM%"
node scripts\license-studio.cjs
popd
endlocal
pause
