use crate::core::app_state::AppState;
use crate::core::errors::{envelope, CommandError, CommandResult};
use crate::core::filesystem;
use crate::database::repositories::{settings as settings_repo, snapshots as repo};
use crate::device_bridge::mock;
use crate::models::{now_iso, BackupSnapshot, RetentionPolicy};
use crate::security::path_validation::sanitize_identifier;
use std::io::Write;
use tauri::State;

/// Ensure mock snapshots exist for a device the first time they are viewed in
/// mock mode, so the timeline feels populated without a real backup history.
fn seed_mock_if_needed(state: &AppState, udid: &str) {
    if !state.bridge().mock {
        return;
    }
    let conn = state.db.conn.lock().unwrap();
    if repo::count(&conn, udid).unwrap_or(0) == 0 {
        for s in mock::mock_snapshots(udid) {
            let _ = repo::insert(&conn, &s);
        }
    }
}

#[tauri::command]
pub fn list_snapshots(
    state: State<AppState>,
    udid: Option<String>,
) -> CommandResult<Vec<BackupSnapshot>> {
    envelope((|| {
        let udid = match udid {
            Some(u) => Some(sanitize_identifier(&u)?),
            None => None,
        };
        if let Some(u) = &udid {
            seed_mock_if_needed(&state, u);
        }
        let conn = state.db.conn.lock().unwrap();
        repo::list(&conn, udid.as_deref()).map_err(CommandError::from)
    })())
}

#[tauri::command]
pub fn set_snapshot_protected(
    state: State<AppState>,
    id: String,
    protected: bool,
) -> CommandResult<()> {
    let conn = state.db.conn.lock().unwrap();
    envelope(repo::set_protected(&conn, &id, protected).map_err(CommandError::from))
}

#[tauri::command]
pub fn update_snapshot(
    state: State<AppState>,
    id: String,
    label: Option<String>,
    notes: Option<String>,
) -> CommandResult<()> {
    let conn = state.db.conn.lock().unwrap();
    envelope(
        repo::update_meta(&conn, &id, label.as_deref(), notes.as_deref())
            .map_err(CommandError::from),
    )
}

#[tauri::command]
pub fn delete_snapshot(state: State<AppState>, id: String) -> CommandResult<()> {
    let conn = state.db.conn.lock().unwrap();
    envelope(repo::delete(&conn, &id).map_err(CommandError::from))
}

#[tauri::command]
pub fn get_retention_policy(state: State<AppState>) -> CommandResult<RetentionPolicy> {
    let conn = state.db.conn.lock().unwrap();
    envelope(repo::get_global_policy(&conn).map_err(CommandError::from))
}

#[tauri::command]
pub fn save_retention_policy(
    state: State<AppState>,
    policy: RetentionPolicy,
) -> CommandResult<RetentionPolicy> {
    envelope((|| {
        let mut policy = policy;
        policy.updated_at = now_iso();
        let conn = state.db.conn.lock().unwrap();
        repo::save_policy(&conn, &policy)?;
        Ok(policy)
    })())
}

/// Snapshots recommended for cleanup under the current retention policy.
/// Never includes protected snapshots. Oldest unprotected snapshots beyond the
/// total keep count are suggested first.
#[tauri::command]
pub fn cleanup_recommendations(
    state: State<AppState>,
    udid: Option<String>,
) -> CommandResult<Vec<BackupSnapshot>> {
    envelope((|| {
        if let Some(u) = &udid {
            seed_mock_if_needed(&state, u);
        }
        let conn = state.db.conn.lock().unwrap();
        let policy = repo::get_global_policy(&conn)?;
        let keep_total = (policy.keep_daily_count
            + policy.keep_weekly_count
            + policy.keep_monthly_count)
            .max(1) as usize;

        let mut snapshots = repo::list(&conn, udid.as_deref())?;
        // Newest first already; keep the newest `keep_total`, recommend the rest.
        let mut recommendations = Vec::new();
        let mut kept = 0usize;
        for snap in snapshots.drain(..) {
            if snap.is_protected {
                continue;
            }
            if kept < keep_total {
                kept += 1;
            } else {
                recommendations.push(snap);
            }
        }
        Ok(recommendations)
    })())
}

/// Export snapshot metadata (no backup contents) as a local JSON file.
#[tauri::command]
pub fn export_snapshot_metadata(
    state: State<AppState>,
    udid: Option<String>,
) -> CommandResult<String> {
    envelope((|| {
        let (snapshots, export_dir) = {
            let conn = state.db.conn.lock().unwrap();
            let settings = settings_repo::get(&conn);
            let snaps = repo::list(&conn, udid.as_deref())?;
            (snaps, settings.export_folder)
        };

        let dir = filesystem::resolve(&export_dir);
        std::fs::create_dir_all(&dir)
            .map_err(|e| CommandError::internal(e.to_string()))?;
        let file = dir.join(format!(
            "snapshot-metadata-{}.json",
            udid.as_deref().unwrap_or("all")
        ));
        let json = serde_json::to_string_pretty(&snapshots)
            .map_err(|e| CommandError::internal(e.to_string()))?;
        let mut f = std::fs::File::create(&file)
            .map_err(|e| CommandError::internal(e.to_string()))?;
        f.write_all(json.as_bytes())
            .map_err(|e| CommandError::internal(e.to_string()))?;
        Ok(file.display().to_string())
    })())
}

#[tauri::command]
pub fn open_snapshot_folder(path: String) -> CommandResult<()> {
    crate::commands::backups::open_path(&path);
    envelope(Ok(()))
}
