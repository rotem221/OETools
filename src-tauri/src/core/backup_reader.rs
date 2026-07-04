//! Read-only reader for iTunes/Finder-style iOS backups (as produced by
//! `idevicebackup2`). Supports **unencrypted** backups: it opens the SQLite
//! `Manifest.db` index and resolves individual files. Encrypted backups are
//! detected and reported (their contents can't be read without the password).
//!
//! SECURITY: everything here is read-only and fully local. No files are ever
//! uploaded, and nothing outside a user-selected backup folder is touched.

use crate::core::errors::CommandError;
use crate::models::{BackupCategory, BackupSourceInfo};
use rusqlite::{Connection, OpenFlags};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

/// Well-known local backup locations to auto-detect (platform-aware).
pub fn default_backup_locations() -> Vec<PathBuf> {
    let mut v = Vec::new();
    if let Some(home) = dirs::home_dir() {
        #[cfg(target_os = "macos")]
        v.push(home.join("Library/Application Support/MobileSync/Backup"));
        #[cfg(target_os = "windows")]
        {
            // Microsoft Store version of iTunes/Apple Devices app.
            v.push(home.join("Apple").join("MobileSync").join("Backup"));
        }
    }
    // Windows classic iTunes stores under Roaming AppData.
    #[cfg(target_os = "windows")]
    if let Some(data) = dirs::data_dir() {
        v.push(data.join("Apple Computer").join("MobileSync").join("Backup"));
        v.push(data.join("Apple").join("MobileSync").join("Backup"));
    }
    v
}

/// A backup root is a directory that contains `Info.plist`/`Manifest.plist`.
pub fn is_backup_root(dir: &Path) -> bool {
    dir.join("Manifest.plist").exists() || dir.join("Info.plist").exists()
}

/// Recursively locate backup roots under `dir`, up to `max_depth` levels deep
/// (our own backups nest as `<udid>/<timestamp>/<udid>`).
pub fn find_backup_roots(dir: &Path, max_depth: usize) -> Vec<PathBuf> {
    let mut out = Vec::new();
    walk(dir, max_depth, &mut out);
    out
}

fn walk(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    if is_backup_root(dir) {
        out.push(dir.to_path_buf());
        return;
    }
    if depth == 0 {
        return;
    }
    if let Ok(entries) = std::fs::read_dir(dir) {
        for e in entries.flatten() {
            let p = e.path();
            if p.is_dir() {
                walk(&p, depth - 1, out);
            }
        }
    }
}

fn dict_string(v: &Option<plist::Value>, key: &str) -> Option<String> {
    v.as_ref()
        .and_then(|v| v.as_dictionary())
        .and_then(|d| d.get(key))
        .and_then(|v| v.as_string().map(|s| s.to_string()))
}

fn dict_date(v: &Option<plist::Value>, key: &str) -> Option<String> {
    let date = v
        .as_ref()
        .and_then(|v| v.as_dictionary())
        .and_then(|d| d.get(key))
        .and_then(|v| v.as_date())?;
    let st: SystemTime = date.into();
    Some(chrono::DateTime::<chrono::Utc>::from(st).to_rfc3339())
}

/// Read backup metadata from `Info.plist` + `Manifest.plist` (both unencrypted
/// even for encrypted backups).
pub fn read_backup_info(root: &Path, source_label: &str) -> BackupSourceInfo {
    let info = plist::Value::from_file(root.join("Info.plist")).ok();
    let manifest = plist::Value::from_file(root.join("Manifest.plist")).ok();

    let encrypted = manifest
        .as_ref()
        .and_then(|m| m.as_dictionary())
        .and_then(|d| d.get("IsEncrypted"))
        .and_then(|v| v.as_boolean())
        .unwrap_or(false);

    BackupSourceInfo {
        id: root.to_string_lossy().to_string(),
        path: root.to_string_lossy().to_string(),
        device_name: dict_string(&info, "Device Name").or_else(|| dict_string(&info, "Display Name")),
        product_type: dict_string(&info, "Product Type"),
        product_version: dict_string(&info, "Product Version"),
        serial_number: dict_string(&info, "Serial Number"),
        last_backup_date: dict_date(&info, "Last Backup Date").or_else(|| dict_date(&manifest, "Date")),
        encrypted,
        source_label: source_label.to_string(),
    }
}

/// Open the backup's `Manifest.db` read-only. Fails clearly for encrypted or
/// unsupported backups.
pub fn open_manifest(root: &Path) -> Result<Connection, CommandError> {
    let info = read_backup_info(root, "");
    if info.encrypted {
        return Err(CommandError::new(
            "This backup is encrypted. Reading its contents requires the backup password (not yet supported).",
        ));
    }
    let dbp = root.join("Manifest.db");
    if !dbp.exists() {
        return Err(CommandError::new(
            "This backup uses a legacy format without Manifest.db and can't be browsed.",
        ));
    }
    Connection::open_with_flags(&dbp, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| CommandError::new("Could not open the backup index.").with_details(e.to_string()))
}

/// Resolve a backup fileID to its on-disk path (`<root>/<id[0:2]>/<id>`).
pub fn file_path(root: &Path, file_id: &str) -> Option<PathBuf> {
    if file_id.len() < 2 {
        return None;
    }
    Some(root.join(&file_id[0..2]).join(file_id))
}

struct CategoryDef {
    id: &'static str,
    label: &'static str,
    /// SQL predicate on the Manifest.db `Files` table. Hardcoded (no user input).
    predicate: &'static str,
    exportable: bool,
}

const CATEGORIES: &[CategoryDef] = &[
    CategoryDef { id: "photos", label: "Photos & Videos", predicate: "domain = 'CameraRollDomain' AND relativePath LIKE 'Media/DCIM/%'", exportable: true },
    CategoryDef { id: "messages", label: "Messages", predicate: "relativePath LIKE 'Library/SMS/%'", exportable: true },
    CategoryDef { id: "contacts", label: "Contacts", predicate: "relativePath LIKE '%AddressBook%'", exportable: true },
    CategoryDef { id: "notes", label: "Notes", predicate: "relativePath LIKE '%NoteStore%' OR relativePath LIKE 'Library/Notes/%'", exportable: true },
    CategoryDef { id: "calendars", label: "Calendars", predicate: "relativePath LIKE '%Calendar%'", exportable: true },
    CategoryDef { id: "safari", label: "Safari", predicate: "relativePath LIKE 'Library/Safari/%'", exportable: true },
    CategoryDef { id: "call_history", label: "Call History", predicate: "relativePath LIKE '%CallHistory%'", exportable: true },
    CategoryDef { id: "voicemail", label: "Voicemail", predicate: "relativePath LIKE 'Library/Voicemail/%'", exportable: true },
    CategoryDef { id: "voice_memos", label: "Voice Memos", predicate: "relativePath LIKE '%Recordings/%'", exportable: true },
    CategoryDef { id: "whatsapp", label: "WhatsApp", predicate: "domain LIKE '%net.whatsapp.WhatsApp%'", exportable: true },
];

/// Count items per known category from the Manifest index.
pub fn category_counts(root: &Path) -> Result<Vec<BackupCategory>, CommandError> {
    let conn = open_manifest(root)?;
    let mut out = Vec::new();
    for c in CATEGORIES {
        let count: i64 = conn
            .query_row(
                &format!("SELECT COUNT(*) FROM Files WHERE ({})", c.predicate),
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);
        out.push(BackupCategory {
            id: c.id.to_string(),
            label: c.label.to_string(),
            item_count: count,
            total_size_bytes: 0,
            exportable: c.exportable,
        });
    }
    Ok(out)
}

fn predicate_for(category: &str) -> Option<&'static str> {
    CATEGORIES.iter().find(|c| c.id == category).map(|c| c.predicate)
}

/// (fileID, relativePath) pairs for every file in a category.
pub fn category_files(root: &Path, category: &str) -> Result<Vec<(String, String)>, CommandError> {
    let predicate = predicate_for(category)
        .ok_or_else(|| CommandError::new("Unknown backup category."))?;
    let conn = open_manifest(root)?;
    let mut stmt = conn
        .prepare(&format!(
            "SELECT fileID, relativePath FROM Files WHERE ({predicate}) AND flags = 1"
        ))
        .map_err(|e| CommandError::internal(e.to_string()))?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(|e| CommandError::internal(e.to_string()))?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

/// Look up the on-disk path of a single logical file (domain + relativePath).
pub fn resolve_named_file(root: &Path, relative_like: &str) -> Option<PathBuf> {
    let conn = open_manifest(root).ok()?;
    let file_id: String = conn
        .query_row(
            "SELECT fileID FROM Files WHERE relativePath = ?1 LIMIT 1",
            [relative_like],
            |r| r.get(0),
        )
        .ok()?;
    file_path(root, &file_id).filter(|p| p.exists())
}
