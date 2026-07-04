# Known Limitations (v0.1.0 / MVP)

This MVP intentionally ships a **complete, clean, and useful** core while
leaving some real-device integrations as clearly-marked placeholders. Nothing
here compromises safety.

## Device bridge

- **Real backup progress** is coarse. `create_backup` currently drives a
  progress model rather than parsing granular `idevicebackup2` output. Backups
  are created into the configured folder; fine-grained progress parsing is
  planned.
- **Real media browsing** (AFC / `ifuse`) is a **placeholder**. In real mode
  `list_media` returns an empty list (the UI shows an "unavailable" state).
  **Mock Mode** provides a full media experience.
- **Real live syslog streaming** is stubbed in v1: Mock Mode synthesizes log
  lines; wiring `idevicesyslog` stdout line-by-line is planned.
- **Crash report collection** records the operation but does not yet copy
  `idevicecrashreport` output.
- **Battery health / cycle count** are only reliably available for some
  devices/OS versions; shown as `N/A` when unavailable. Mock Mode shows sample values.

## Safety-driven restrictions

- **Restore from backup** is **disabled/experimental** by design in v1.
- No destructive action runs without an explicit confirmation dialog.

## Platform

- **Windows** requires Apple Mobile Device Support (USB driver) plus a
  libimobiledevice build; packaging those is out of scope for the MVP.
- **Linux** support is best-effort and depends on distro packaging of
  `usbmuxd`/`libimobiledevice`.

## UI / product

- Multiple devices are supported in the architecture; the v1 UI focuses on one
  selected device at a time.
- Duplicate detection and media import are placeholders (labeled in the UI).
- Reports export as **printable HTML + JSON**; native PDF export is deferred
  (print the HTML to PDF from the browser/OS in the meantime).

## Not implemented — and never will be

By explicit product policy: iCloud/Activation-Lock/passcode bypass, jailbreak,
illegal IPA install, spyware/hidden extraction, unauthorized access, risky
firmware manipulation, or any Apple-security circumvention.
