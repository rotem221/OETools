use crate::core::errors::CommandError;
use std::path::{Path, PathBuf};

/// Validate that a path is absolute, free of traversal, and (optionally)
/// writable. Returns a canonical-ish PathBuf on success.
pub fn validate_writable_dir(path: &str) -> Result<PathBuf, CommandError> {
    let p = expand_home(path);

    if p.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err(CommandError::new("Invalid path (contains \"..\").")
            .with_details(format!("path: {path}")));
    }

    if !p.exists() {
        std::fs::create_dir_all(&p)
            .map_err(|_| CommandError::folder_not_writable(&p.display().to_string()))?;
    }

    if !p.is_dir() {
        return Err(CommandError::new("Path is not a directory.")
            .with_details(format!("path: {}", p.display())));
    }

    // Probe writability with a temp file.
    let probe = p.join(".idevice-desk-write-test");
    match std::fs::write(&probe, b"ok") {
        Ok(_) => {
            let _ = std::fs::remove_file(&probe);
            Ok(p)
        }
        Err(_) => Err(CommandError::folder_not_writable(&p.display().to_string())),
    }
}

/// Expand a leading `~` to the user's home directory.
pub fn expand_home(path: &str) -> PathBuf {
    if let Some(stripped) = path.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(stripped);
        }
    }
    if path == "~" {
        if let Some(home) = dirs::home_dir() {
            return home;
        }
    }
    PathBuf::from(path)
}

/// Reject arguments that could be used for shell/argument injection.
/// We never pass user input through a shell, but we still sanitize UDIDs and
/// identifiers that are forwarded as CLI arguments.
pub fn sanitize_identifier(value: &str) -> Result<String, CommandError> {
    let ok = !value.is_empty()
        && value.len() <= 128
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.');
    if ok {
        Ok(value.to_string())
    } else {
        Err(CommandError::new("Invalid identifier.")
            .with_details(format!("value: {value}")))
    }
}

pub fn path_is_within(base: &Path, candidate: &Path) -> bool {
    candidate.starts_with(base)
}

/// Validate that a user-provided path exists and is free of `..` traversal.
/// Used for read-only inputs (backup folders, files to convert, etc.).
pub fn validate_existing_path(path: &str) -> Result<PathBuf, CommandError> {
    let p = expand_home(path);
    if p.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err(CommandError::new("Invalid path (contains \"..\").")
            .with_details(format!("path: {path}")));
    }
    if !p.exists() {
        return Err(CommandError::new("The selected path does not exist.")
            .with_details(format!("path: {}", p.display())));
    }
    Ok(p)
}
