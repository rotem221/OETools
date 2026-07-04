use crate::core::app_state::AppState;
use crate::core::errors::{envelope, CommandError, CommandResult};
use crate::core::filesystem;
use crate::database::repositories::{privacy as repo, settings as settings_repo};
use crate::models::PrivacySummary;
use tauri::State;

#[tauri::command]
pub fn get_privacy_summary(state: State<AppState>) -> CommandResult<PrivacySummary> {
    let conn = state.db.conn.lock().unwrap();
    let counts = repo::counts(&conn);
    let settings = settings_repo::get(&conn);
    drop(conn);

    envelope(Ok(PrivacySummary {
        devices: counts.devices,
        backups: counts.backups,
        snapshots: counts.snapshots,
        reports: counts.reports,
        logs: counts.logs,
        jobs: counts.jobs,
        index_items: counts.index_items,
        security_scans: counts.security_scans,
        data_exports: counts.data_exports,
        app_data_dir: filesystem::app_data_dir().display().to_string(),
        local_only: settings.local_only_mode,
        telemetry_enabled: settings.telemetry_enabled,
    }))
}

#[tauri::command]
pub fn delete_privacy_category(state: State<AppState>, category: String) -> CommandResult<()> {
    let conn = state.db.conn.lock().unwrap();
    envelope(repo::delete_category(&conn, &category).map_err(CommandError::new))
}

/// Wipe all local user/device data and reset settings to defaults. This is the
/// "Delete all app data" action gated behind a typed confirmation in the UI.
#[tauri::command]
pub fn factory_reset_app(state: State<AppState>) -> CommandResult<()> {
    let conn = state.db.conn.lock().unwrap();
    envelope((|| {
        repo::factory_reset(&conn).map_err(CommandError::new)?;
        settings_repo::reset(&conn).map_err(CommandError::from)?;
        Ok(())
    })())
}
