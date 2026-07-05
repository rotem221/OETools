//! Device File Browser + Quick Transfer over AFC.
//!
//! - File Browser lists directories on the device's accessible AFC storage and
//!   downloads selected files.
//! - Quick Transfer uploads local files into a chosen device folder over AFC.
//!
//! All device access is sandboxed by AFC to the media/file-sharing area; paths
//! are validated to block traversal.

use crate::core::app_state::AppState;
use crate::core::errors::{envelope, CommandError, CommandResult};
use crate::core::job_queue;
use crate::models::{DeviceFileEntry, Job};
use crate::security::path_validation::{sanitize_identifier, validate_existing_path, validate_writable_dir};
use std::sync::atomic::Ordering;
use tauri::{AppHandle, State};

/// Validate an AFC device path: absolute, no traversal, no NUL.
fn valid_device_path(path: &str) -> Result<String, CommandError> {
    if path.is_empty() {
        return Ok("/".into());
    }
    if path.contains('\0') || path.contains("..") || !path.starts_with('/') {
        return Err(CommandError::new("Invalid device path."));
    }
    Ok(path.to_string())
}

#[tauri::command]
pub fn list_device_files(
    state: State<AppState>,
    udid: String,
    path: String,
) -> CommandResult<Vec<DeviceFileEntry>> {
    envelope((|| {
        let udid = sanitize_identifier(&udid)?;
        let path = valid_device_path(&path)?;
        state.bridge().list_dir(&udid, &path)
    })())
}

/// Download selected device files (absolute AFC paths) to a local folder.
#[tauri::command]
pub fn download_device_files(
    app: AppHandle,
    state: State<AppState>,
    udid: String,
    paths: Vec<String>,
    destination: String,
) -> CommandResult<Job> {
    envelope((|| {
        let udid = sanitize_identifier(&udid)?;
        validate_writable_dir(&destination)?;
        if paths.is_empty() {
            return Err(CommandError::new("No files selected to download."));
        }
        for p in &paths {
            valid_device_path(p)?;
        }

        let job = job_queue::create(
            &state.db,
            &app,
            "device_transfer",
            &format!("Download {} file(s)", paths.len()),
            Some(&format!("From device to {destination}")),
            Some(&udid),
            true,
        );

        let bridge = state.bridge();
        let cancel = state.register_cancel(&job.id);
        let db = state.db.clone();
        let total = paths.len() as i64;
        let mut worker = job.clone();
        let udid_c = udid.clone();

        std::thread::spawn(move || {
            let mut ok = 0i64;
            let mut failed = 0i64;
            for (idx, remote) in paths.iter().enumerate() {
                if cancel.load(Ordering::SeqCst) {
                    job_queue::cancel(&db, &app, &mut worker);
                    return;
                }
                let name = remote.rsplit('/').next().unwrap_or("file");
                let dest = std::path::Path::new(&destination).join(name);
                match bridge.download_file(&udid_c, remote, &dest.to_string_lossy()) {
                    Ok(_) => ok += 1,
                    Err(e) => {
                        failed += 1;
                        job_queue::log(&db, &app, Some(&worker.id), Some(&udid_c), "error", &format!("Failed to download {name}"), Some(&e.message));
                    }
                }
                job_queue::progress(&db, &app, &mut worker, ((idx as i64 + 1) * 100) / total);
            }
            job_queue::log(&db, &app, Some(&worker.id), Some(&udid_c), "info", &format!("Download finished: {ok} copied, {failed} failed"), None);
            job_queue::complete(&db, &app, &mut worker);
        });

        Ok(job)
    })())
}

/// Upload local files into a device folder over AFC (Quick Transfer).
#[tauri::command]
pub fn upload_to_device(
    app: AppHandle,
    state: State<AppState>,
    udid: String,
    files: Vec<String>,
    remote_dir: String,
) -> CommandResult<Job> {
    envelope((|| {
        let udid = sanitize_identifier(&udid)?;
        let remote_dir = valid_device_path(&remote_dir)?;
        if files.is_empty() {
            return Err(CommandError::new("No files selected to transfer."));
        }
        // Validate every local source exists.
        for f in &files {
            validate_existing_path(f)?;
        }

        let job = job_queue::create(
            &state.db,
            &app,
            "device_transfer",
            &format!("Transfer {} file(s) to device", files.len()),
            Some(&format!("To {remote_dir}")),
            Some(&udid),
            true,
        );

        let bridge = state.bridge();
        let cancel = state.register_cancel(&job.id);
        let db = state.db.clone();
        let total = files.len() as i64;
        let mut worker = job.clone();
        let udid_c = udid.clone();

        std::thread::spawn(move || {
            let mut ok = 0i64;
            let mut failed = 0i64;
            for (idx, local) in files.iter().enumerate() {
                if cancel.load(Ordering::SeqCst) {
                    job_queue::cancel(&db, &app, &mut worker);
                    return;
                }
                let name = std::path::Path::new(local)
                    .file_name()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_else(|| "file".into());
                let remote = format!("{}/{}", remote_dir.trim_end_matches('/'), name);
                match bridge.upload_file(&udid_c, local, &remote) {
                    Ok(_) => ok += 1,
                    Err(e) => {
                        failed += 1;
                        job_queue::log(&db, &app, Some(&worker.id), Some(&udid_c), "error", &format!("Failed to transfer {name}"), Some(&e.message));
                    }
                }
                job_queue::progress(&db, &app, &mut worker, ((idx as i64 + 1) * 100) / total);
            }
            job_queue::log(&db, &app, Some(&worker.id), Some(&udid_c), "info", &format!("Transfer finished: {ok} sent, {failed} failed"), None);
            job_queue::complete(&db, &app, &mut worker);
        });

        Ok(job)
    })())
}

#[tauri::command]
pub fn cancel_transfer(state: State<AppState>, job_id: String) -> CommandResult<()> {
    state.request_cancel(&job_id);
    envelope(Ok(()))
}
