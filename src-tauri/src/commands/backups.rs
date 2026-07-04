use crate::core::app_state::AppState;
use crate::core::errors::{envelope, CommandError, CommandResult};
use crate::core::{filesystem, job_queue};
use crate::database::repositories::{backups as backups_repo, devices as devices_repo, settings as settings_repo};
use crate::models::{now_iso, Backup, Job};
use crate::security::path_validation::sanitize_identifier;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, State};
use uuid::Uuid;

#[tauri::command]
pub fn create_backup(
    app: AppHandle,
    state: State<AppState>,
    udid: String,
    encrypted: bool,
) -> CommandResult<Job> {
    envelope((|| {
        let udid = sanitize_identifier(&udid)?;

        let settings = {
            let conn = state.db.conn.lock().unwrap();
            settings_repo::get(&conn)
        };

        // Validate the backup destination is writable.
        let backup_root = filesystem::resolve(&settings.backup_folder);
        let dest = backup_root.join(&udid).join(
            chrono::Utc::now().format("%Y-%m-%d_%H%M%S").to_string(),
        );
        std::fs::create_dir_all(&dest)
            .map_err(|_| CommandError::folder_not_writable(&dest.display().to_string()))?;

        let backup = Backup {
            id: Uuid::new_v4().to_string(),
            device_udid: udid.clone(),
            path: dest.display().to_string(),
            size_bytes: None,
            encrypted,
            status: "in_progress".into(),
            started_at: Some(now_iso()),
            completed_at: None,
            error_message: None,
            created_at: now_iso(),
        };
        {
            let conn = state.db.conn.lock().unwrap();
            backups_repo::insert(&conn, &backup)?;
        }

        let job = job_queue::create(
            &state.db,
            &app,
            "backup_create",
            &format!("Backup — {udid}"),
            Some("Full local backup"),
            Some(&udid),
            true,
        );

        let cancel = state.register_cancel(&job.id);
        let db = state.db.clone();
        let mock = state.bridge().mock;
        let backup_id = backup.id.clone();
        let udid_clone = udid.clone();
        let dest_str = dest.display().to_string();
        let mut worker_job = job.clone();

        // Run the backup off the command thread so the UI stays responsive.
        std::thread::spawn(move || {
            run_backup(
                &db,
                &app,
                &mut worker_job,
                &backup_id,
                &udid_clone,
                &dest_str,
                mock,
                cancel,
            );
        });

        Ok(job)
    })())
}

#[allow(clippy::too_many_arguments)]
fn run_backup(
    db: &Arc<crate::database::Database>,
    app: &AppHandle,
    job: &mut Job,
    backup_id: &str,
    udid: &str,
    dest: &str,
    mock: bool,
    cancel: Arc<std::sync::atomic::AtomicBool>,
) {
    job_queue::log(db, app, Some(&job.id), Some(udid), "info", "Backup started", None);

    let mark_cancelled = |job: &mut Job| {
        job_queue::cancel(db, app, job);
        job_queue::log(db, app, Some(&job.id), Some(udid), "warn", "Backup cancelled", None);
        let conn = db.conn.lock().unwrap();
        let _ = backups_repo::update_status(&conn, backup_id, "cancelled", None, Some(&now_iso()), None);
    };

    if mock {
        // Simulated progress for mock mode / demo.
        let steps = 20;
        for i in 1..=steps {
            if cancel.load(Ordering::SeqCst) {
                mark_cancelled(job);
                return;
            }
            std::thread::sleep(Duration::from_millis(250));
            job_queue::progress(db, app, job, (i * 100) / steps);
        }
        let conn = db.conn.lock().unwrap();
        let _ = backups_repo::update_status(
            &conn,
            backup_id,
            "completed",
            Some(42_949_672_960_i64),
            Some(&now_iso()),
            None,
        );
        let _ = devices_repo::touch_backup(&conn, udid);
        drop(conn);
        job_queue::complete(db, app, job);
        job_queue::log(db, app, Some(&job.id), Some(udid), "info", "Backup completed", None);
        return;
    }

    // Real backup: run idevicebackup2 and stream its progress. The log closure
    // uses cloned handles so the progress closure can hold `&mut job`.
    let job_id = job.id.clone();
    let udid_owned = udid.to_string();
    let log_db = db.clone();
    let log_app = app.clone();
    let result = crate::device_bridge::libimobiledevice::backup_full(
        udid,
        dest,
        &cancel,
        |p| job_queue::progress(db, app, job, p),
        |line| {
            let lower = line.to_ascii_lowercase();
            if lower.contains("error") || lower.contains("failed") {
                job_queue::log(&log_db, &log_app, Some(&job_id), Some(&udid_owned), "error", line, None);
            }
        },
    );

    if cancel.load(Ordering::SeqCst) {
        mark_cancelled(job);
        return;
    }

    use crate::security::command_runner::StreamResult;
    match result {
        Ok(StreamResult::Exited(true)) => {
            let size = dir_size(dest);
            {
                let conn = db.conn.lock().unwrap();
                let _ = backups_repo::update_status(&conn, backup_id, "completed", size, Some(&now_iso()), None);
                let _ = devices_repo::touch_backup(&conn, udid);
            }
            job_queue::complete(db, app, job);
            job_queue::log(db, app, Some(&job.id), Some(udid), "info", "Backup completed", None);
        }
        Ok(StreamResult::Cancelled) => mark_cancelled(job),
        other => {
            let msg = match other {
                Ok(StreamResult::TimedOut) => "Backup timed out.".to_string(),
                Err(e) => e.message.clone(),
                _ => "idevicebackup2 reported a failure. Ensure the device is unlocked and trusted.".to_string(),
            };
            job_queue::fail(db, app, job, &msg);
            {
                let conn = db.conn.lock().unwrap();
                let _ = backups_repo::update_status(&conn, backup_id, "failed", None, Some(&now_iso()), Some(&msg));
            }
            job_queue::log(db, app, Some(&job.id), Some(udid), "error", "Backup failed", Some(&msg));
        }
    }
}

/// Best-effort recursive size of a finished backup directory.
fn dir_size(path: &str) -> Option<i64> {
    fn walk(p: &std::path::Path) -> i64 {
        let mut total = 0i64;
        let Ok(entries) = std::fs::read_dir(p) else {
            return 0;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                total += walk(&path);
            } else if let Ok(meta) = entry.metadata() {
                total += meta.len() as i64;
            }
        }
        total
    }
    let size = walk(std::path::Path::new(&crate::core::filesystem::resolve(path)));
    if size > 0 {
        Some(size)
    } else {
        None
    }
}

#[tauri::command]
pub fn list_backups(state: State<AppState>, udid: Option<String>) -> CommandResult<Vec<Backup>> {
    let conn = state.db.conn.lock().unwrap();
    envelope(backups_repo::list(&conn, udid.as_deref()).map_err(CommandError::from))
}

#[tauri::command]
pub fn get_backup_details(state: State<AppState>, id: String) -> CommandResult<Backup> {
    let conn = state.db.conn.lock().unwrap();
    envelope(backups_repo::get(&conn, &id).map_err(|_| CommandError::new("Backup not found.")))
}

#[tauri::command]
pub fn cancel_backup(state: State<AppState>, job_id: String) -> CommandResult<()> {
    state.request_cancel(&job_id);
    envelope(Ok(()))
}

#[tauri::command]
pub fn open_backup_folder(path: String) -> CommandResult<()> {
    open_path(&path);
    envelope(Ok(()))
}

/// Cross-platform "reveal/open path" using the OS default handler.
/// Uses discrete process args (no shell) to avoid injection.
pub fn open_path(path: &str) {
    let p = filesystem::resolve(path);
    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open").arg(&p).spawn();
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("explorer").arg(&p).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let _ = std::process::Command::new("xdg-open").arg(&p).spawn();
}
