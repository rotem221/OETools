use crate::core::app_state::AppState;
use crate::core::errors::{envelope, CommandError, CommandResult};
use crate::database::repositories::devices as devices_repo;
use crate::models::{DeviceInfo, DeviceSummary};
use crate::security::path_validation::sanitize_identifier;
use tauri::State;

#[tauri::command]
pub fn list_devices(state: State<AppState>) -> CommandResult<Vec<DeviceSummary>> {
    let bridge = state.bridge();
    envelope(bridge.list_devices().inspect(|devices| {
        let conn = state.db.conn.lock().unwrap();
        for d in devices {
            let _ = devices_repo::upsert(&conn, d);
        }
    }))
}

#[tauri::command]
pub fn get_device_info(state: State<AppState>, udid: String) -> CommandResult<DeviceInfo> {
    envelope((|| {
        let udid = sanitize_identifier(&udid)?;
        let info = state.bridge().get_device_info(&udid)?;
        // Opportunistically record a battery snapshot for the history chart.
        crate::commands::battery::capture_from_info(&state, &info);
        Ok(info)
    })())
}

#[tauri::command]
pub fn refresh_device(state: State<AppState>, udid: String) -> CommandResult<DeviceInfo> {
    get_device_info(state, udid)
}

#[tauri::command]
pub fn pair_device(state: State<AppState>, udid: String) -> CommandResult<DeviceSummary> {
    envelope((|| {
        let udid = sanitize_identifier(&udid)?;
        let bridge = state.bridge();
        bridge.pair(&udid)?;
        let devices = bridge.list_devices()?;
        devices
            .into_iter()
            .find(|d| d.udid == udid)
            .ok_or_else(CommandError::device_not_found)
    })())
}

#[tauri::command]
pub fn get_trust_status(state: State<AppState>, udid: String) -> CommandResult<String> {
    envelope((|| {
        let udid = sanitize_identifier(&udid)?;
        Ok(state.bridge().trust_state(&udid))
    })())
}
