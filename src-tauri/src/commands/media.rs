use crate::core::app_state::AppState;
use crate::core::errors::{envelope, CommandError, CommandResult};
use crate::core::job_queue;
use crate::models::{Job, MediaItem, MediaMeta, MediaThumb};
use crate::security::path_validation::{sanitize_identifier, validate_writable_dir};
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn list_media(state: State<AppState>, udid: String) -> CommandResult<Vec<MediaItem>> {
    envelope((|| {
        let udid = sanitize_identifier(&udid)?;
        state.bridge().list_media(&udid)
    })())
}

#[tauri::command]
pub fn media_info(
    state: State<AppState>,
    udid: String,
    relative_path: String,
) -> CommandResult<MediaMeta> {
    envelope((|| {
        let udid = sanitize_identifier(&udid)?;
        let remote = to_media_path(&relative_path)?;
        state.bridge().media_meta(&udid, &remote)
    })())
}

#[tauri::command]
pub fn media_thumbnail(
    state: State<AppState>,
    udid: String,
    relative_path: String,
    kind: String,
) -> CommandResult<MediaThumb> {
    envelope((|| {
        let udid = sanitize_identifier(&udid)?;
        let remote = to_media_path(&relative_path)?;
        state.bridge().media_thumbnail(&udid, &remote, &kind)
    })())
}

/// Normalize a UI-supplied relative path (e.g. `DCIM/100APPLE/IMG.HEIC`) into a
/// validated absolute camera-roll path, rejecting traversal.
fn to_media_path(relative: &str) -> Result<String, CommandError> {
    let trimmed = relative.trim_start_matches('/');
    let full = format!("/{trimmed}");
    if is_media_path(&full) {
        Ok(full)
    } else {
        Err(CommandError::new("Invalid media path."))
    }
}

#[tauri::command]
pub fn export_media(
    app: AppHandle,
    state: State<AppState>,
    udid: String,
    ids: Vec<String>,
    destination: String,
) -> CommandResult<Job> {
    envelope((|| {
        let udid = sanitize_identifier(&udid)?;
        validate_writable_dir(&destination)?;
        if ids.is_empty() {
            return Err(CommandError::new("No media selected for export."));
        }

        let job = job_queue::create(
            &state.db,
            &app,
            "media_export",
            &format!("Media export — {} files", ids.len()),
            Some(&format!("Export to {destination}")),
            Some(&udid),
            true,
        );

        let bridge = state.bridge();
        let is_mock = bridge.mock;
        let cancel = state.register_cancel(&job.id);
        let db = state.db.clone();
        let total = ids.len() as i64;
        let mut worker_job = job.clone();
        let udid_clone = udid.clone();

        std::thread::spawn(move || {
            let mut copied = 0i64;
            let mut failed = 0i64;

            for (idx, remote) in ids.iter().enumerate() {
                if cancel.load(Ordering::SeqCst) {
                    job_queue::cancel(&db, &app, &mut worker_job);
                    return;
                }

                if is_mock {
                    std::thread::sleep(Duration::from_millis(150));
                    copied += 1;
                } else if !is_media_path(remote) {
                    // Reject anything outside the camera roll.
                    failed += 1;
                    job_queue::log(
                        &db,
                        &app,
                        Some(&worker_job.id),
                        Some(&udid_clone),
                        "warn",
                        "Skipped file outside the camera roll",
                        Some(remote),
                    );
                } else {
                    let file_name = remote.rsplit('/').next().unwrap_or("file");
                    let dest_path = std::path::Path::new(&destination).join(file_name);
                    match bridge.export_media_file(
                        &udid_clone,
                        remote,
                        &dest_path.to_string_lossy(),
                    ) {
                        Ok(_) => copied += 1,
                        Err(e) => {
                            failed += 1;
                            job_queue::log(
                                &db,
                                &app,
                                Some(&worker_job.id),
                                Some(&udid_clone),
                                "error",
                                &format!("Failed to export {file_name}"),
                                Some(&e.message),
                            );
                        }
                    }
                }

                let done = (idx as i64) + 1;
                job_queue::progress(&db, &app, &mut worker_job, (done * 100) / total);
            }

            job_queue::complete(&db, &app, &mut worker_job);
            job_queue::log(
                &db,
                &app,
                Some(&worker_job.id),
                Some(&udid_clone),
                "info",
                &format!("Media export finished: {copied} copied, {failed} failed"),
                None,
            );
        });

        Ok(job)
    })())
}

#[tauri::command]
pub fn cancel_media_export(state: State<AppState>, job_id: String) -> CommandResult<()> {
    state.request_cancel(&job_id);
    envelope(Ok(()))
}

/// Restrict exports to the device camera roll and block path traversal so a
/// crafted id can never read arbitrary device paths.
fn is_media_path(path: &str) -> bool {
    path.starts_with("/DCIM/") && !path.contains("..") && !path.contains('\0')
}
