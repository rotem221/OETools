//! Backup Browser / Extractor. Detects local iOS backups, lists their content
//! categories, and extracts files from a category to a chosen folder. Read-only
//! with respect to the backup; fully local.

use crate::core::app_state::AppState;
use crate::core::backup_reader;
use crate::core::errors::{envelope, CommandError, CommandResult};
use crate::core::{filesystem, job_queue};
use crate::database::repositories::settings as settings_repo;
use crate::models::{BackupCategory, BackupSourceInfo, Job};
use crate::security::path_validation::{validate_existing_path, validate_writable_dir};
use std::path::Path;
use tauri::{AppHandle, State};

/// Auto-detect backups in the standard Finder/iTunes location and the app's own
/// backup folder.
#[tauri::command]
pub fn detect_backups(state: State<AppState>) -> CommandResult<Vec<BackupSourceInfo>> {
    let mut sources: Vec<BackupSourceInfo> = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for loc in backup_reader::default_backup_locations() {
        for root in backup_reader::find_backup_roots(&loc, 1) {
            let key = root.to_string_lossy().to_string();
            if seen.insert(key) {
                sources.push(backup_reader::read_backup_info(&root, "Finder / iTunes"));
            }
        }
    }

    let backup_folder = {
        let conn = state.db.conn.lock().unwrap();
        settings_repo::get(&conn).backup_folder
    };
    let bf = filesystem::resolve(&backup_folder);
    for root in backup_reader::find_backup_roots(&bf, 3) {
        let key = root.to_string_lossy().to_string();
        if seen.insert(key) {
            sources.push(backup_reader::read_backup_info(&root, "OETools"));
        }
    }

    envelope(Ok(sources))
}

/// Read metadata for a user-picked backup folder.
#[tauri::command]
pub fn open_backup_source(path: String) -> CommandResult<BackupSourceInfo> {
    envelope((|| {
        let p = validate_existing_path(&path)?;
        let root = backup_reader::find_backup_roots(&p, 3)
            .into_iter()
            .next()
            .ok_or_else(|| {
                CommandError::new("No iOS backup was found in that folder.")
                    .with_fix("Pick the folder that contains Manifest.plist / Info.plist.")
            })?;
        Ok(backup_reader::read_backup_info(&root, "Custom"))
    })())
}

#[tauri::command]
pub fn list_backup_categories(path: String) -> CommandResult<Vec<BackupCategory>> {
    envelope((|| {
        let root = validate_existing_path(&path)?;
        backup_reader::category_counts(&root)
    })())
}

fn sanitize_name(rel: &str) -> String {
    let base = Path::new(rel)
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".into());
    base.chars()
        .map(|c| if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_') { c } else { '_' })
        .collect()
}

/// Extract every file in a category to `destination` as a background job.
#[tauri::command]
pub fn export_backup_category(
    app: AppHandle,
    state: State<AppState>,
    path: String,
    category: String,
    destination: String,
) -> CommandResult<Job> {
    envelope((|| {
        let root = validate_existing_path(&path)?;
        let dest = validate_writable_dir(&destination)?;
        let files = backup_reader::category_files(&root, &category)?;
        if files.is_empty() {
            return Err(CommandError::new("There are no files in that category to export."));
        }

        let job = job_queue::create(
            &state.db,
            &app,
            "backup_extract",
            &format!("Extract {} ({} files)", category, files.len()),
            Some("Copying files from backup"),
            None,
            false,
        );

        let db = state.db.clone();
        let mut worker = job.clone();
        std::thread::spawn(move || {
            let total = files.len();
            let mut copied = 0i64;
            for (idx, (file_id, rel)) in files.iter().enumerate() {
                if let Some(src) = backup_reader::file_path(&root, file_id) {
                    if src.exists() {
                        let out = dest.join(format!("{:04}_{}", idx, sanitize_name(rel)));
                        if std::fs::copy(&src, &out).is_ok() {
                            copied += 1;
                        }
                    }
                }
                let pct = (((idx + 1) as f64 / total as f64) * 100.0) as i64;
                job_queue::progress(&db, &app, &mut worker, pct);
            }
            job_queue::log(
                &db,
                &app,
                Some(&worker.id),
                None,
                "info",
                &format!("Extracted {copied} file(s)"),
                None,
            );
            job_queue::complete(&db, &app, &mut worker);
        });

        Ok(job)
    })())
}
