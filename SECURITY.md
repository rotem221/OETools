# Security & Privacy Notes

OETools is built around a **safe-by-default, local-first** philosophy.
This document describes the security model and the concrete measures in place.

## Threat model & principles

1. **No security bypasses.** The app only uses documented, legitimate device
   management flows exposed by Apple/usbmuxd via libimobiledevice. It contains
   no code for jailbreaking, activation-lock / iCloud / passcode bypass, or
   firmware manipulation.
2. **Local-only by default.** No network calls are made for device data. There
   is no telemetry. `local_only_mode` is enforced on in v1.
3. **Explicit consent for destructive actions.** Any operation that deletes or
   overwrites data is gated behind a confirmation dialog.

## Command execution safety

- **No shell.** External tools are launched via `std::process::Command` with a
  **discrete argument vector** (`src-tauri/src/security/command_runner.rs`).
  User input is never concatenated into a shell string, eliminating shell
  injection.
- **Timeouts.** Every external command runs under a timeout and is killed if it
  exceeds it, returning a structured `command_timed_out` error.
- **Identifier sanitization.** UDIDs and other identifiers forwarded as CLI
  arguments are validated against a strict allowlist
  (`sanitize_identifier` — ASCII alphanumerics, `-`, `_`, `.`, max length).

## Filesystem safety

- **Path validation** (`src-tauri/src/security/path_validation.rs`):
  - Rejects paths containing `..` (traversal).
  - Expands `~` safely to the user home.
  - Verifies target directories exist and are **writable** via a probe file
    before any write operation.
- Storage folders (backups/exports/reports/logs) are user-configurable and
  validated on every change.

## Data handling

- **Safe-only device fields.** `device_bridge/parser.rs` filters raw
  `ideviceinfo` output to a known allowlist of non-sensitive keys before it is
  shown or exported. Secrets, certificates, tokens, and similar values are
  never surfaced.
- **Local SQLite database** stored in the OS app-data directory; contains only
  device metadata, backup/report bookkeeping, jobs, logs, and settings.
- **User-controlled deletion.** Settings → Privacy provides *Clear app history*,
  *Delete known devices*, and *Open local data folder*.

## Error handling

Every backend command returns a uniform envelope:

```jsonc
{
  "success": false,
  "data": null,
  "error": {
    "message": "user-friendly message",
    "technical_details": "optional low-level detail",
    "suggested_fix": "actionable guidance",
    "related_dependency": "e.g. ideviceinfo"
  }
}
```

This ensures the UI can always present a readable message plus an optional
technical detail and remediation hint, without leaking sensitive data.

## Reporting

This is a reference project. For real deployments, report security concerns
privately to the maintainers before public disclosure.
