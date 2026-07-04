# OETools — Final Installers

This folder holds the distributable installers for **OETools (Or Eliav Tools)**.

```
final installs/
├── macos/     ← ready-to-use macOS installer (built here)
└── windows/   ← Windows installer (built on Windows — see below)
```

## macOS  ✅ ready

| File | What it is |
|------|------------|
| `OETools_0.1.0_aarch64.dmg` | Disk image installer for Apple Silicon (M1–M4). Open it and drag **OETools** to Applications. |
| `OETools_0.1.0_macos-app.zip` | The `.app` bundle, zipped. Unzip and move to Applications. |

> First launch: because the build is not code-signed/notarized yet, right‑click the app → **Open** → **Open** to bypass Gatekeeper once. (For public distribution, sign & notarize with an Apple Developer ID.)

An **Intel (x86_64)** macOS `.dmg` is produced automatically by the CI pipeline (see below).

## Windows  ⚙️ build required

A Windows installer (`.exe` / `.msi`) **cannot be cross‑built from a Mac** — it
needs the Windows MSVC toolchain, the WebView2 SDK and the WiX/NSIS bundlers,
which only run on Windows. You have two easy ways to get it:

### Option A — GitHub Actions (recommended, no Windows PC needed)
This repo ships a ready CI pipeline at **`ci/build-installers.yml`** that builds
the macOS **and** Windows installers on native runners.

1. Activate it by moving the file into the workflows folder:
   ```bash
   mkdir -p .github/workflows && git mv ci/build-installers.yml .github/workflows/
   git commit -m "Enable installer CI" && git push
   ```
   (Pushing files under `.github/workflows/` needs a token with the `workflow`
   scope: `gh auth refresh -s workflow` once, then push.)
2. Go to **Actions → Build installers → Run workflow** (or push a `v*` tag).
3. When it finishes, download the **`OETools-x86_64-pc-windows-msvc`** artifact —
   it contains the `.exe` and `.msi`. Drop them into `final installs/windows/`.

### Option B — build on a Windows machine
Install Node 20+, Rust (MSVC), the C++ Build Tools and the WebView2 runtime,
then run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-windows.ps1
```

The script copies the resulting `.exe` and `.msi` into `final installs\windows\`.

## Cross‑platform notes
OETools is fully cross‑platform. On Windows it uses the same open‑source
`libimobiledevice` tools; install them with `scoop install libimobiledevice`
and install the **Apple Devices app / iTunes** for the USB drivers. Image
conversion falls back from macOS `sips` to `ffmpeg` automatically, and iTunes
backups are auto‑detected under `%APPDATA%\Apple Computer\MobileSync\Backup`.
