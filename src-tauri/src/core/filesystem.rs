use crate::core::errors::CommandError;
use crate::models::AppSettings;
use crate::security::path_validation::{expand_home, validate_writable_dir};
use std::path::PathBuf;

/// Ensure all configured storage folders exist and are writable.
pub fn ensure_storage_dirs(settings: &AppSettings) -> Result<(), CommandError> {
    for dir in [
        &settings.backup_folder,
        &settings.export_folder,
        &settings.reports_folder,
        &settings.logs_folder,
    ] {
        validate_writable_dir(dir)?;
    }
    // firmware-cache placeholder + temp
    let base = app_data_dir();
    let _ = std::fs::create_dir_all(base.join("firmware-cache"));
    let _ = std::fs::create_dir_all(base.join("temp"));
    Ok(())
}

/// Root application data directory (DB + caches live here).
pub fn app_data_dir() -> PathBuf {
    let base = dirs::data_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    let dir = base.join("OETools");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

pub fn database_path() -> PathBuf {
    app_data_dir().join("oetools.sqlite3")
}

pub fn resolve(path: &str) -> PathBuf {
    expand_home(path)
}
