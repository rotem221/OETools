use serde::Serialize;

/// Structured, user-friendly error returned to the frontend.
#[derive(Debug, Clone, Serialize)]
pub struct CommandError {
    pub message: String,
    pub technical_details: Option<String>,
    pub suggested_fix: Option<String>,
    pub related_dependency: Option<String>,
}

impl CommandError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            technical_details: None,
            suggested_fix: None,
            related_dependency: None,
        }
    }

    pub fn with_details(mut self, details: impl Into<String>) -> Self {
        self.technical_details = Some(details.into());
        self
    }

    pub fn with_fix(mut self, fix: impl Into<String>) -> Self {
        self.suggested_fix = Some(fix.into());
        self
    }

    pub fn with_dependency(mut self, dep: impl Into<String>) -> Self {
        self.related_dependency = Some(dep.into());
        self
    }

    // ---- Common, well-known error constructors ----

    pub fn device_not_found() -> Self {
        Self::new("The selected device was not found.")
            .with_fix("Reconnect the device via USB and refresh.")
    }

    pub fn device_disconnected() -> Self {
        Self::new("The device was disconnected.")
            .with_fix("Reconnect the device and keep it unlocked during operations.")
    }

    pub fn device_not_trusted() -> Self {
        Self::new("This device is not trusted.")
            .with_fix("Unlock the device and tap \"Trust\" on the prompt, then pair again.")
    }

    pub fn missing_dependency(name: &str, hint: &str) -> Self {
        Self::new(format!("Required tool \"{name}\" is not installed."))
            .with_fix(format!("Install it: {hint}"))
            .with_dependency(name)
    }

    pub fn folder_not_writable(path: &str) -> Self {
        Self::new("The selected folder is not writable.")
            .with_details(format!("path: {path}"))
            .with_fix("Choose a different folder or adjust its permissions.")
    }

    pub fn unsupported() -> Self {
        Self::new("This operation is not supported in the current configuration.")
    }

    pub fn command_timed_out(cmd: &str) -> Self {
        Self::new("The operation timed out.")
            .with_details(format!("command: {cmd}"))
            .with_fix("Reconnect the device and try again.")
    }

    pub fn internal(details: impl Into<String>) -> Self {
        Self::new("An internal error occurred.").with_details(details)
    }
}

impl<E: std::error::Error> From<E> for CommandError {
    fn from(e: E) -> Self {
        CommandError::internal(e.to_string())
    }
}

/// Uniform command envelope. Every Tauri command returns this.
#[derive(Debug, Clone, Serialize)]
pub struct CommandResult<T: Serialize> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<CommandError>,
}

impl<T: Serialize> CommandResult<T> {
    pub fn ok(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn err(error: CommandError) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
        }
    }
}

/// Convert a `Result<T, CommandError>` into the serializable envelope.
pub fn envelope<T: Serialize>(res: Result<T, CommandError>) -> CommandResult<T> {
    match res {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}
