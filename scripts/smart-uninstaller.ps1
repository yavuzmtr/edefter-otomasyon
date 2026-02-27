param(
    [Parameter(Position = 0)]
    [ValidateSet("QUICK_UNINSTALL", "FULL_CLEANUP", "DIALOG")]
    [string]$Mode = "DIALOG"
)

$ErrorActionPreference = "SilentlyContinue"

function Stop-AppProcesses {
    $names = @(
        "E-Defter Otomasyon",
        "E-Defter Otomasyon DEMO",
        "E-Defter Klasor Otomasyonu",
        "edefter-automation",
        "edefter-automation-demo"
    )

    foreach ($name in $names) {
        Get-Process -Name $name | Stop-Process -Force
    }
}

function Remove-CommonPaths {
    param(
        [switch]$IncludeProgramFiles
    )

    $paths = @(
        "$env:APPDATA\edefter-automation",
        "$env:APPDATA\edefter-app",
        "$env:APPDATA\edefter-automation-demo",
        "$env:APPDATA\e-defter-otomasyon-demo",
        "$env:APPDATA\edefter-uninstaller",
        "$env:LOCALAPPDATA\edefter-automation",
        "$env:LOCALAPPDATA\edefter-app",
        "$env:LOCALAPPDATA\edefter-automation-updater",
        "$env:LOCALAPPDATA\edefter-automation-demo-updater",
        "$env:LOCALAPPDATA\Programs\E-Defter Otomasyon",
        "$env:LOCALAPPDATA\Programs\E-Defter Otomasyon DEMO",
        "$env:LOCALAPPDATA\Programs\edefter-automation"
    )

    if ($IncludeProgramFiles) {
        $paths += @(
            "$env:ProgramFiles\E-Defter Otomasyon",
            "$env:ProgramFiles(x86)\E-Defter Otomasyon",
            "$env:ProgramFiles\E-Defter Otomasyon DEMO",
            "$env:ProgramFiles(x86)\E-Defter Otomasyon DEMO"
        )
    }

    foreach ($p in $paths) {
        if (Test-Path $p) {
            Remove-Item -LiteralPath $p -Recurse -Force
        }
    }
}

function Remove-StartupRegistry {
    Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "E-Defter Otomasyon"
    Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "E-Defter Klasor Otomasyonu"
    Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "E-Defter Otomasyon DEMO"
    Remove-ItemProperty -Path "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "E-Defter Otomasyon"
    Remove-ItemProperty -Path "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "E-Defter Klasor Otomasyonu"
    Remove-ItemProperty -Path "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "E-Defter Otomasyon DEMO"
}

Write-Host "E-Defter uninstaller cleanup basliyor..." -ForegroundColor Cyan
Stop-AppProcesses
Remove-StartupRegistry

switch ($Mode) {
    "QUICK_UNINSTALL" {
        Remove-CommonPaths
        Write-Host "Quick cleanup tamamlandi." -ForegroundColor Yellow
    }
    "FULL_CLEANUP" {
        Remove-CommonPaths -IncludeProgramFiles
        Write-Host "Full cleanup tamamlandi." -ForegroundColor Green
    }
    default {
        $choice = Read-Host "Tum veriler silinsin mi? (E/H)"
        if ($choice -match "^[Ee]") {
            Remove-CommonPaths -IncludeProgramFiles
            Write-Host "Tum veriler temizlendi." -ForegroundColor Green
        } else {
            Remove-CommonPaths
            Write-Host "Program verileri temizlendi, Program Files korundu." -ForegroundColor Yellow
        }
    }
}

Write-Host "Islem tamamlandi." -ForegroundColor Cyan
