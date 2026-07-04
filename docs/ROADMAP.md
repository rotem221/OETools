# Roadmap

All future work stays within the same **safe, legal, privacy-first** boundaries.
No item below will ever include security bypasses.

## Phase 1 — Foundation ✅ (done)
- Tauri + React + Tailwind + shadcn scaffold
- Sidebar layout, theming (light/dark/system), i18n (EN/HE + RTL)
- Mock Mode, settings skeleton, job drawer, toasts

## Phase 2 — Devices ✅ (done)
- Device detection & polling, trust/pair states
- Dashboard, full Device Info, dependency checker

## Phase 3 — Data layer ✅ (done)
- SQLite + migrations, known devices, operation logs, job queue

## Phase 4 — Backups (MVP done → hardening)
- ✅ Create/track/cancel backups, history, encrypted flag
- ⬜ Granular `idevicebackup2` progress parsing
- ⬜ Safe, well-tested **restore** flow (currently disabled)

## Phase 5 — Media (MVP mock → real)
- ✅ Grid/list, filters, multi-select, export jobs (mock)
- ⬜ Real AFC/`ifuse` browsing & export
- ⬜ Duplicate detection, media import

## Phase 6 — Diagnostics (MVP → real)
- ✅ Live log viewer UI, export, dependency diagnostics
- ⬜ Real `idevicesyslog` streaming
- ⬜ Real `idevicecrashreport` collection & troubleshooting bundle

## Phase 7 — Reports
- ✅ Basic/Technical/Pre-Service/Backup-Summary as HTML + JSON
- ⬜ Native PDF export
- ⬜ Report templates & branding

## Phase 8 — Polish & packaging
- ⬜ Signed installers (Windows/macOS), auto-update channel
- ⬜ Accessibility pass, keyboard shortcuts
- ⬜ E2E tests

## Optional future cloud layer (opt-in only)
Prepared for, but **off by default** and never for device data:
- Supabase-based licensing & remote license validation
- User accounts, update channel
- Encrypted sync of **settings only** (never device data)
