# Builds the OETools Windows installer (.exe + .msi).
#
# Run this ON A WINDOWS MACHINE (PowerShell). A Windows installer cannot be
# produced from macOS/Linux because it needs WebView2, the MSVC toolchain and
# the WiX/NSIS bundlers, which are Windows-only.
#
# Prerequisites (install once):
#   1. Node.js 20+            https://nodejs.org
#   2. Rust (MSVC toolchain)  https://rustup.rs   (choose the default host x86_64-pc-windows-msvc)
#   3. Microsoft C++ Build Tools (Desktop development with C++)
#   4. WebView2 Runtime       (preinstalled on Windows 11; otherwise https://developer.microsoft.com/microsoft-edge/webview2/)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\build-windows.ps1

$ErrorActionPreference = "Stop"

# Move to the repository root (this script lives in .\scripts).
Set-Location (Join-Path $PSScriptRoot "..")

# Sign the auto-updater artifacts (.nsis.zip) with the local updater key so the
# in-app updater can verify them. The matching public key lives in
# src-tauri\tauri.conf.json (plugins.updater.pubkey).
$keyFile = "src-tauri\.tauri\oetools_updater.key"
if (-not $env:TAURI_SIGNING_PRIVATE_KEY -and (Test-Path $keyFile)) {
    $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw -Path $keyFile
    if (-not $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
        $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
    }
}

Write-Host "==> Installing frontend dependencies..." -ForegroundColor Cyan
npm ci

Write-Host "==> Building OETools (release) + Windows installers..." -ForegroundColor Cyan
npm run tauri:build

$bundle = "src-tauri\target\release\bundle"
$dest = "final installs\windows"
New-Item -ItemType Directory -Force -Path $dest | Out-Null

Write-Host "==> Copying installers + updater artifacts into '$dest'..." -ForegroundColor Cyan
# .exe/.msi = installers; .nsis.zip(+.sig) = signed auto-updater payloads.
Get-ChildItem -Path $bundle -Recurse -Include *.exe, *.msi, *.nsis.zip, *.nsis.zip.sig |
    ForEach-Object {
        Copy-Item $_.FullName -Destination $dest -Force
        Write-Host "    $($_.Name)"
    }

Write-Host "==> Done. Installers are in '$dest'." -ForegroundColor Green
