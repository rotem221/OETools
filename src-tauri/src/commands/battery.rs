use crate::core::app_state::AppState;
use crate::core::errors::{envelope, CommandError, CommandResult};
use crate::database::repositories::battery as battery_repo;
use crate::models::{BatterySnapshot, DeviceInfo};
use crate::security::path_validation::sanitize_identifier;
use tauri::State;

/// Return the recorded battery history (oldest → newest) for trend charts.
#[tauri::command]
pub fn list_battery_history(
    state: State<AppState>,
    udid: String,
) -> CommandResult<Vec<BatterySnapshot>> {
    envelope((|| {
        let udid = sanitize_identifier(&udid)?;
        let conn = state.db.conn.lock().unwrap();
        battery_repo::list(&conn, &udid, 500).map_err(CommandError::from)
    })())
}

/// Record a battery snapshot from a freshly-read `DeviceInfo`, but no more than
/// once per hour per device (so navigating around doesn't spam the history).
pub fn capture_from_info(state: &AppState, info: &DeviceInfo) {
    if info.battery.level_percent.is_none()
        && info.battery.health_percent.is_none()
        && info.battery.cycle_count.is_none()
    {
        return;
    }
    let conn = state.db.conn.lock().unwrap();
    if let Some(last) = battery_repo::last_captured_at(&conn, &info.udid) {
        if let Ok(ts) = chrono::DateTime::parse_from_rfc3339(&last) {
            if (chrono::Utc::now() - ts.with_timezone(&chrono::Utc)).num_minutes() < 60 {
                return;
            }
        }
    }
    let _ = battery_repo::insert(
        &conn,
        &info.udid,
        info.battery.level_percent,
        info.battery.health_percent,
        info.battery.cycle_count,
        info.battery.is_charging,
    );
}
