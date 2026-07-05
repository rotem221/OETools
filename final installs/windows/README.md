# Windows installer

The Windows `.exe` (NSIS) and `.msi` (WiX) installers land here once built,
alongside the signed auto-updater payloads (`*.nsis.zip` + `*.nsis.zip.sig`).

They are **not** included pre-built because a Windows installer cannot be
produced on macOS. Generate them either via GitHub Actions (recommended — it
also signs the updater artifacts and publishes `latest.json`) or on a Windows PC
— see `../README.md` for step-by-step instructions.

Quick local build (on Windows):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-windows.ps1
```

## Automatic updates

Once installed, OETools checks GitHub Releases on startup (and from
Settings → About) and updates itself in place — no need to re-download the
installer manually for future versions.
