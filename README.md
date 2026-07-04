# OETools

### Or Eliav Tools

A polished, **privacy-first, local** desktop utility for managing connected
iPhone / iPad devices over USB. Inspired by tools like 3uTools, but focused
**only** on safe, legal, and privacy-respecting device management.

> OETools is **not** a hacking, jailbreak, or bypass tool. It never
> circumvents Apple security protections and never uploads your data anywhere.

![Tech](https://img.shields.io/badge/Tauri-2-blue) ![React](https://img.shields.io/badge/React-18-61dafb) ![Rust](https://img.shields.io/badge/Rust-stable-orange) ![License](https://img.shields.io/badge/local--first-100%25-brightgreen)

---

## What the app does

- **Device detection** — detect connected iOS/iPadOS devices, trust/pair status, multiple-device architecture.
- **Dashboard** — battery, storage (with chart), iOS version, backup status, quick actions.
- **Device Info** — full, *safe-only* device information with copy & JSON export.
- **Backups** — create full local backups (encrypted flag supported), progress tracking, cancellation, history.
- **Media** — browse & export photos/videos to a folder, grid/list, filters, multi-select.
- **Diagnostics** — live system-log viewer, crash-report collection, dependency & connection diagnostics, export.
- **Reports** — generate Basic / Technical / Pre-Service / Backup-Summary reports as printable HTML + JSON.
- **Job queue** — every long-running operation is tracked with progress, logs, and cancellation.
- **Settings** — language (EN/HE), theme, storage folders, privacy controls, dependency manager.
- **Localization** — full **English (LTR)** and **Hebrew (RTL)** support.
- **Mock Mode** — a complete simulated device so the app is fully usable without hardware or dependencies.

## What the app does NOT do

By design, OETools **will never** implement any of the following:

- iCloud bypass, Activation Lock bypass, passcode bypass
- Jailbreaking or illegal IPA installation
- Spyware-like features, hidden extraction, or unauthorized data access
- Firmware manipulation that risks bricking the device
- Fake "repair" features
- Anything that circumvents Apple security protections
- Any cloud upload of device data, or telemetry, by default

## Supported platforms

| Platform | Status |
|----------|--------|
| Windows  | Primary target |
| macOS    | Supported |
| Linux    | Optional / best-effort |

The architecture is cross-platform from day one.

## Required dependencies (for real devices)

Real-device features rely on the open-source
[**libimobiledevice**](https://libimobiledevice.org/) tool suite:

| Tool | Purpose |
|------|---------|
| `idevice_id` | list connected devices |
| `ideviceinfo` | device information |
| `idevicepair` | pairing / trust |
| `idevicebackup2` | backups |
| `idevicesyslog` | live logs |
| `idevicecrashreport` | crash reports |
| `usbmuxd` | USB multiplexing daemon |
| `ifuse` *(optional)* | AFC filesystem access |

**Install:**

- **macOS:** `brew install libimobiledevice ifuse`
- **Linux (Debian/Ubuntu):** `sudo apt install libimobiledevice-utils ifuse usbmuxd`
- **Windows:** install **Apple Mobile Device Support** (bundled with iTunes) for the USB driver, plus a libimobiledevice build. See *Troubleshooting*.

> If dependencies are missing, OETools automatically falls back to **Mock Mode** so you can still explore the full UI.

## How to run locally

Prerequisites: **Node.js 18+**, **Rust (stable)**, and the platform's Tauri
system prerequisites (see <https://tauri.app/start/prerequisites/>).

```bash
# 1. Install frontend dependencies
npm install

# 2. Run the desktop app in development (Vite + Rust)
npm run tauri:dev
```

Frontend-only preview (no Rust, uses the built-in JS mock):

```bash
npm run dev        # open http://localhost:1420
```

## How to enable Mock Mode

Mock Mode is **on by default**. You can toggle it in:

- **Onboarding → Connect** step, or
- **Settings → General → Mock Mode**

In Mock Mode the app simulates one iPhone and one iPad, including device info,
storage, battery, backup progress, media, logs, and report generation.

## How to build installers

```bash
npm run tauri:build
```

Artifacts are produced under `src-tauri/target/release/bundle/`:

- Windows: `.msi` / `.exe` (NSIS)
- macOS: `.dmg` / `.app`
- Linux: `.deb` / `.AppImage`

## Privacy explanation

- **Local-first:** all backups, reports, logs, and metadata are stored on *your*
  computer under your chosen folders and a local SQLite database.
- **No cloud:** device data is never uploaded. Local-only mode is always on in v1.
- **No telemetry:** the app collects zero analytics.
- **Safe data only:** the Device Info viewer filters to a known list of
  non-sensitive keys; secrets, tokens, and protected identifiers are never surfaced.
- **You are in control:** clear history, delete known devices, and open your local
  data folder any time from Settings → Privacy.

## Safety limitations

- Restore-from-backup is intentionally **disabled/experimental** in v1 for safety.
- Real media browsing via AFC/ifuse is a placeholder in v1 (Mock Mode fully works).
- The app performs no destructive operations without an explicit confirmation dialog.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Device not trusted" | Unlock the device, tap **Trust**, enter passcode, then re-pair. |
| "Missing dependency" | Install libimobiledevice (see above) and re-check in Settings → Dependencies. |
| Device not detected on Windows | Install **Apple Mobile Device Support** (iTunes) so the USB driver is present. |
| Folder not writable | Choose a different folder in Settings → Storage. |
| Nothing detected but device is plugged in | Try a different cable/port; run **Diagnostics → Connection diagnostics**. |

See also: [`SECURITY.md`](./SECURITY.md), [`docs/DEVELOPER.md`](./docs/DEVELOPER.md),
[`docs/KNOWN_LIMITATIONS.md`](./docs/KNOWN_LIMITATIONS.md),
[`docs/ROADMAP.md`](./docs/ROADMAP.md).
