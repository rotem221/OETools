use crate::core::app_state::AppState;
use crate::core::errors::{envelope, CommandError, CommandResult};
use crate::core::filesystem;
use crate::database::repositories::{
    devices as devices_repo, logs as logs_repo, settings as settings_repo,
};
use crate::models::AppSettings;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> CommandResult<AppSettings> {
    let conn = state.db.conn.lock().unwrap();
    envelope(Ok(settings_repo::get(&conn)))
}

#[tauri::command]
pub fn update_settings(
    state: State<AppState>,
    patch: serde_json::Value,
) -> CommandResult<AppSettings> {
    envelope((|| {
        let current = {
            let conn = state.db.conn.lock().unwrap();
            settings_repo::get(&conn)
        };
        // Merge the incoming patch onto the current settings JSON.
        let mut base = serde_json::to_value(&current).map_err(CommandError::from)?;
        if let (Some(base_obj), Some(patch_obj)) = (base.as_object_mut(), patch.as_object()) {
            for (k, v) in patch_obj {
                base_obj.insert(k.clone(), v.clone());
            }
        }
        let merged: AppSettings = serde_json::from_value(base)
            .map_err(|e| CommandError::new("Invalid settings").with_details(e.to_string()))?;

        {
            let conn = state.db.conn.lock().unwrap();
            settings_repo::save(&conn, &merged)?;
        }
        // Best-effort: make sure storage dirs exist after any change.
        let _ = filesystem::ensure_storage_dirs(&merged);
        Ok(merged)
    })())
}

#[tauri::command]
pub fn select_folder(app: AppHandle) -> CommandResult<Option<String>> {
    let picked = app.dialog().file().blocking_pick_folder();
    let path = picked.map(|p| p.to_string());
    envelope(Ok(path))
}

/// Pick one or more files (used by the media/ringtone converter).
#[tauri::command]
pub fn select_files(app: AppHandle) -> CommandResult<Vec<String>> {
    let picked = app.dialog().file().blocking_pick_files();
    let paths = picked
        .map(|v| v.into_iter().map(|p| p.to_string()).collect())
        .unwrap_or_default();
    envelope(Ok(paths))
}

#[tauri::command]
pub fn open_app_data_folder() -> CommandResult<()> {
    let dir = filesystem::app_data_dir();
    crate::commands::backups::open_path(&dir.display().to_string());
    envelope(Ok(()))
}

#[tauri::command]
pub fn reset_settings(state: State<AppState>) -> CommandResult<AppSettings> {
    let conn = state.db.conn.lock().unwrap();
    envelope(settings_repo::reset(&conn).map_err(CommandError::from))
}

#[tauri::command]
pub fn clear_app_history(state: State<AppState>) -> CommandResult<()> {
    let conn = state.db.conn.lock().unwrap();
    envelope(logs_repo::clear(&conn).map_err(CommandError::from))
}

#[tauri::command]
pub fn delete_known_devices(state: State<AppState>) -> CommandResult<()> {
    let conn = state.db.conn.lock().unwrap();
    envelope(devices_repo::delete_all(&conn).map_err(CommandError::from))
}
