# Developer Documentation

## Architecture overview

OETools is a **Tauri 2** desktop app split into clear layers:

```
┌─────────────────────────────────────────────────────────┐
│ Desktop UI Layer  (React + TS + Tailwind + shadcn/ui)     │
│   src/                                                    │
├─────────────────────────────────────────────────────────┤
│ Tauri IPC (invoke) — uniform CommandResult<T> envelope    │
├─────────────────────────────────────────────────────────┤
│ Local Core Layer  (Rust)                                  │
│   commands/ · core/ (state, jobs, deps, fs, errors)       │
├──────────────┬───────────────────────┬───────────────────┤
│ Device Bridge│ Local Storage         │ Security          │
│ (mock + libi)│ (SQLite + migrations) │ (paths, runner)   │
└──────────────┴───────────────────────┴───────────────────┘
```

### Frontend structure (`src/`)

```
app/            App bootstrap, routes, providers
components/
  layout/       app shell, device guard
  sidebar/      left navigation
  topbar/       device selector, activity button
  ui/           shadcn/ui primitives
  shared/       page header, info row, empty state, badges, copy
  feedback/     toaster, confirm dialog
  charts/       recharts wrappers
features/
  onboarding/ devices/ dashboard/ backups/ media/
  diagnostics/ reports/ settings/ jobs/
lib/
  api/          Tauri client + JS mock fallback + events
  i18n/         i18next + en/he locales
  db-types/     TS types mirroring backend
  store/        Zustand stores (app, toast)
  validation/   Zod schemas
  utils/        cn, formatters
styles/         globals.css (theme tokens)
```

### Backend structure (`src-tauri/src/`)

```
main.rs / lib.rs      entry + command registration
commands/             thin Tauri command handlers
  devices, backups, media, diagnostics, reports, settings, jobs
core/
  app_state.rs        shared state, bridge selection, cancel flags
  errors.rs           CommandError + CommandResult envelope
  job_queue.rs        job lifecycle + event emission
  filesystem.rs       app-data dirs, storage bootstrap
  dependency_manager.rs  tool detection via `which`
device_bridge/
  mod.rs              Bridge (mock vs real dispatch)
  libimobiledevice.rs real device tools
  mock.rs             deterministic mock dataset
  parser.rs           key/value parsing + safe-field filter
database/
  mod.rs              connection + WAL
  migrations.rs       ordered, tracked migrations
  repositories/       devices, backups, reports, jobs, logs, settings, dependencies
security/
  path_validation.rs  path/identifier sanitization
  command_runner.rs   no-shell process execution with timeout
```

## The command envelope

Every command returns `CommandResult<T>`:

```rust
pub struct CommandResult<T> { success: bool, data: Option<T>, error: Option<CommandError> }
```

Frontend helpers in `src/lib/api/client.ts` unwrap this. When Tauri is not
present (pure `vite` dev), the client transparently serves a JS mock so the UI
stays fully functional.

## Events

- `job://update` — emitted whenever a job is created or its progress/status
  changes. Consumed by the Zustand app store and the Job Drawer.
- `log://line` — emitted for live log streaming (diagnostics).

## Jobs

Long-running operations (`backup_create`, `media_export`, `log_collect`, …) run
on a worker thread. They:

1. persist a `Job` row and emit `job://update`,
2. periodically report progress,
3. honor a per-job cancellation flag (`AppState::register_cancel`),
4. finalize as `completed` / `failed` / `cancelled`.

## Adding a new command

1. Add the handler in the appropriate `src-tauri/src/commands/*.rs`, returning
   `CommandResult<T>` via `envelope(...)`.
2. Register it in `lib.rs` `generate_handler![...]`.
3. Add a typed wrapper in `src/lib/api/client.ts` (+ mock fallback).
4. Add any new types to `src/lib/db-types/index.ts` and Rust `models.rs`.

## Database migrations

Add a new `(name, sql)` tuple to `MIGRATIONS` in `database/migrations.rs`.
Migrations are applied once and tracked in `schema_migrations`.

## Localization

- All UI strings live in `src/lib/i18n/locales/{en,he}.json`.
- `applyLanguage()` sets `<html lang dir>` for correct LTR/RTL.
- Prefer logical CSS (`ps-*`, `pe-*`, `start`, `end`) so RTL mirrors correctly.

## Testing the mock

Run `npm run dev` (no Rust) and the JS mock powers the whole UI. Inside the
Tauri shell, keep **Mock Mode** enabled in Settings to use the Rust mock bridge.

## Useful scripts

```bash
npm run lint        # tsc type-check
npm run build       # production frontend build
npm run tauri:dev   # full desktop app (debug)
npm run tauri:build # installers (release)
```
