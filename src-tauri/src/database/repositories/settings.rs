use crate::models::{now_iso, AppSettings};
use rusqlite::Connection;

const SETTINGS_KEY: &str = "app_settings";

pub fn default_settings() -> AppSettings {
    let base = dirs::document_dir()
        .or_else(dirs::home_dir)
        .map(|p| p.join("OETools"))
        .unwrap_or_else(|| std::path::PathBuf::from("./OETools"));
    let s = |sub: &str| base.join(sub).to_string_lossy().to_string();

    AppSettings {
        language: "en".into(),
        theme: "system".into(),
        mock_mode: false,
        local_only_mode: true,
        telemetry_enabled: false,
        startup_behavior: "dashboard".into(),
        default_device_view: "dashboard".into(),
        onboarding_completed: false,
        experimental_modules: false,
        detailed_command_logs: false,
        data_retention_days: 90,
        backup_folder: s("backups"),
        export_folder: s("exports"),
        reports_folder: s("reports"),
        logs_folder: s("logs"),
    }
}

pub fn get(conn: &Connection) -> AppSettings {
    let row: Option<String> = conn
        .query_row(
            "SELECT value_json FROM settings WHERE key = ?1",
            [SETTINGS_KEY],
            |r| r.get(0),
        )
        .ok();

    match row {
        Some(json) => serde_json::from_str(&json).unwrap_or_else(|_| default_settings()),
        None => {
            let def = default_settings();
            let _ = save(conn, &def);
            def
        }
    }
}

pub fn save(conn: &Connection, settings: &AppSettings) -> rusqlite::Result<()> {
    let json = serde_json::to_string(settings).unwrap_or_default();
    conn.execute(
        "INSERT INTO settings (key, value_json, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET value_json = ?2, updated_at = ?3",
        rusqlite::params![SETTINGS_KEY, json, now_iso()],
    )?;
    Ok(())
}

pub fn reset(conn: &Connection) -> rusqlite::Result<AppSettings> {
    let def = default_settings();
    save(conn, &def)?;
    Ok(def)
}
