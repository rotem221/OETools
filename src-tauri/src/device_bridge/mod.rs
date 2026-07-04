pub mod libimobiledevice;
pub mod mock;
pub mod parser;

use crate::core::errors::CommandError;
use crate::models::{DeviceInfo, DeviceSummary, MediaItem, MediaMeta, MediaThumb};

/// Selects between the mock bridge and the real libimobiledevice bridge.
/// When `mock` is true (settings or missing dependencies), the deterministic
/// mock data is served so the app is always usable.
pub struct Bridge {
    pub mock: bool,
}

impl Bridge {
    pub fn new(mock: bool) -> Self {
        Self { mock }
    }

    pub fn list_devices(&self) -> Result<Vec<DeviceSummary>, CommandError> {
        if self.mock {
            Ok(mock::mock_devices())
        } else {
            libimobiledevice::list_devices()
        }
    }

    pub fn get_device_info(&self, udid: &str) -> Result<DeviceInfo, CommandError> {
        if self.mock {
            Ok(mock::mock_device_info(udid))
        } else {
            libimobiledevice::get_device_info(udid)
        }
    }

    pub fn pair(&self, udid: &str) -> Result<(), CommandError> {
        if self.mock {
            Ok(())
        } else {
            libimobiledevice::pair(udid)
        }
    }

    pub fn trust_state(&self, udid: &str) -> String {
        if self.mock {
            "trusted".into()
        } else {
            libimobiledevice::trust_state(udid)
        }
    }

    pub fn list_media(&self, udid: &str) -> Result<Vec<MediaItem>, CommandError> {
        if self.mock {
            Ok(mock::mock_media())
        } else {
            libimobiledevice::list_media(udid)
        }
    }

    /// Lazy per-item size/date metadata.
    pub fn media_meta(&self, udid: &str, remote: &str) -> Result<MediaMeta, CommandError> {
        if self.mock {
            Ok(MediaMeta {
                size_bytes: 0,
                created_at: String::new(),
            })
        } else {
            libimobiledevice::media_meta(udid, remote)
        }
    }

    /// Lazy per-item thumbnail preview (base64 data URI) + metadata.
    pub fn media_thumbnail(
        &self,
        udid: &str,
        remote: &str,
        kind: &str,
    ) -> Result<MediaThumb, CommandError> {
        if self.mock {
            Ok(MediaThumb {
                data_uri: None,
                size_bytes: 0,
                created_at: String::new(),
                kind: kind.to_string(),
            })
        } else {
            libimobiledevice::media_thumbnail(udid, remote, kind)
        }
    }

    /// Copy a single camera-roll file from the device to a local destination.
    pub fn export_media_file(
        &self,
        udid: &str,
        remote_path: &str,
        dest: &str,
    ) -> Result<(), CommandError> {
        if self.mock {
            Ok(())
        } else {
            libimobiledevice::afc_get(udid, remote_path, dest)
        }
    }
}
