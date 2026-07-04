# Windows installer

The Windows `.exe` (NSIS) and `.msi` (WiX) installers land here once built.

They are **not** included pre-built because a Windows installer cannot be
produced on macOS. Generate them either via GitHub Actions or on a Windows PC —
see `../README.md` for step-by-step instructions.

Quick local build (on Windows):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-windows.ps1
```
