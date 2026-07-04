use crate::models::*;
use std::collections::BTreeMap;

/// Deterministic mock device set used for development and when no hardware or
/// dependencies are available. Mirrors the frontend mock dataset.
/// Stable mock device UDIDs, reused by snapshot/schedule/supervision mocks.
pub const MOCK_IPHONE: &str = "00008110-000A1B2C3D4E5F6G";
pub const MOCK_IPAD: &str = "00008027-9A8B7C6D5E4F3G2H";
pub const MOCK_KIOSK: &str = "00008103-0011AABB22CC33DD";

pub fn mock_devices() -> Vec<DeviceSummary> {
    vec![
        DeviceSummary {
            udid: MOCK_IPHONE.into(),
            name: "Personal iPhone".into(),
            kind: "iphone".into(),
            product_type: "iPhone15,3".into(),
            model: "iPhone 14 Pro Max".into(),
            os_version: "17.5.1".into(),
            connection_state: "connected".into(),
            trust_state: "trusted".into(),
            is_mock: true,
        },
        DeviceSummary {
            udid: MOCK_IPAD.into(),
            name: "Business iPad".into(),
            kind: "ipad".into(),
            product_type: "iPad14,5".into(),
            model: "iPad Pro 12.9 (6th gen)".into(),
            os_version: "17.4".into(),
            connection_state: "connected".into(),
            trust_state: "paired".into(),
            is_mock: true,
        },
        DeviceSummary {
            udid: MOCK_KIOSK.into(),
            name: "Kiosk iPad (Supervised)".into(),
            kind: "ipad".into(),
            product_type: "iPad13,4".into(),
            model: "iPad Pro 11 (3rd gen)".into(),
            os_version: "16.5".into(),
            connection_state: "connected".into(),
            trust_state: "trusted".into(),
            is_mock: true,
        },
    ]
}

/// Deterministic mock backup snapshots spread over time for a device.
pub fn mock_snapshots(udid: &str) -> Vec<BackupSnapshot> {
    let now = chrono::Utc::now();
    (0..8)
        .map(|i| {
            let created = now - chrono::Duration::days(i as i64 * 4 + 1);
            let size = (18_i64 + ((i as i64 * 3) % 11)) * 1024 * 1024 * 1024;
            BackupSnapshot {
                id: format!("snap_{udid}_{i}"),
                device_udid: udid.to_string(),
                backup_id: None,
                snapshot_label: match i {
                    0 => Some("Before iOS update".into()),
                    3 => Some("Monthly archive".into()),
                    _ => None,
                },
                notes: if i == 0 {
                    Some("Full snapshot taken prior to a major iOS update.".into())
                } else {
                    None
                },
                path: format!("~/OETools/backups/{udid}/snapshot-{i}"),
                size_bytes: Some(size),
                encrypted: i % 2 == 0,
                is_protected: i == 3 || i == 7,
                created_at: created.to_rfc3339(),
                completed_at: Some((created + chrono::Duration::minutes(6)).to_rfc3339()),
                status: "completed".into(),
                source_type: match i {
                    5 => "imported".into(),
                    n if n % 3 == 0 => "wifi".into(),
                    _ => "usb".into(),
                },
                os_version: Some("17.5.1".into()),
                app_version: Some(env!("CARGO_PKG_VERSION").into()),
                error_message: None,
            }
        })
        .collect()
}

/// A single mock scheduled-backup configuration for a device.
pub fn mock_schedule(udid: &str) -> ScheduledBackup {
    let now = now_iso();
    ScheduledBackup {
        id: format!("sched_{udid}"),
        device_udid: udid.to_string(),
        enabled: true,
        schedule_type: "on_connect".into(),
        preferred_time: Some("02:00".into()),
        weekdays_json: Some("[1,3,5]".into()),
        destination_path: Some(format!("~/OETools/backups/{udid}")),
        encrypted_preferred: true,
        last_run_at: Some((chrono::Utc::now() - chrono::Duration::days(2)).to_rfc3339()),
        next_run_at: Some((chrono::Utc::now() + chrono::Duration::days(1)).to_rfc3339()),
        last_status: Some("completed".into()),
        created_at: now.clone(),
        updated_at: now,
    }
}

pub fn mock_device_info(udid: &str) -> DeviceInfo {
    let devices = mock_devices();
    let summary = devices
        .iter()
        .find(|d| d.udid == udid)
        .cloned()
        .unwrap_or_else(|| devices[0].clone());
    let is_ipad = summary.kind == "ipad";

    let mut raw = BTreeMap::new();
    raw.insert("DeviceName".into(), summary.name.clone());
    raw.insert("ProductType".into(), summary.product_type.clone());
    raw.insert("ProductVersion".into(), summary.os_version.clone());
    raw.insert(
        "BuildVersion".into(),
        if is_ipad { "21E219" } else { "21F90" }.into(),
    );
    raw.insert(
        "DeviceClass".into(),
        if is_ipad { "iPad" } else { "iPhone" }.into(),
    );
    raw.insert("RegionInfo".into(), "LL/A".into());
    raw.insert("CPUArchitecture".into(), "arm64e".into());
    raw.insert("TimeZone".into(), "Asia/Jerusalem".into());
    raw.insert(
        "TelephonyCapability".into(),
        if is_ipad { "false" } else { "true" }.into(),
    );
    raw.insert("WiFiAddress".into(), "a4:83:e7:xx:xx:xx".into());

    DeviceInfo {
        udid: summary.udid.clone(),
        serial_number: if is_ipad { "DMPX1A2B3C4D" } else { "F2LX9K8J7H6G" }.into(),
        name: summary.name,
        kind: summary.kind,
        model: summary.model,
        product_type: summary.product_type,
        os_version: summary.os_version,
        build_version: Some(if is_ipad { "21E219" } else { "21F90" }.into()),
        device_class: Some(if is_ipad { "iPad" } else { "iPhone" }.into()),
        cpu_architecture: Some("arm64e".into()),
        region_info: Some("LL/A".into()),
        wifi_address: Some("a4:83:e7:xx:xx:xx".into()),
        bluetooth_address: Some("a4:83:e7:yy:yy:yy".into()),
        phone_number: if is_ipad {
            None
        } else {
            Some("+1 (555) 010-2030".into())
        },
        activation_state: Some("Activated".into()),
        battery: BatteryInfo {
            level_percent: Some(if is_ipad { 76 } else { 63 }),
            health_percent: Some(if is_ipad { 98 } else { 89 }),
            cycle_count: Some(if is_ipad { 84 } else { 342 }),
            is_charging: Some(false),
            state: Some("Discharging".into()),
        },
        storage: StorageInfo {
            total_bytes: Some(if is_ipad { 256 } else { 512 } * 1024 * 1024 * 1024),
            used_bytes: Some(if is_ipad { 121 } else { 388 } * 1024 * 1024 * 1024),
            free_bytes: Some(if is_ipad { 135 } else { 124 } * 1024 * 1024 * 1024),
        },
        connection_state: summary.connection_state,
        trust_state: summary.trust_state,
        is_mock: true,
        raw,
    }
}

pub fn mock_media() -> Vec<MediaItem> {
    (0..24)
        .map(|i| {
            let is_video = i % 5 == 0;
            MediaItem {
                id: format!("media_{i}"),
                name: if is_video {
                    format!("IMG_{}.MOV", 4200 + i)
                } else {
                    format!("IMG_{}.HEIC", 4200 + i)
                },
                kind: if is_video { "video" } else { "image" }.into(),
                size_bytes: if is_video {
                    (30 + (i % 12) * 8) * 1024 * 1024
                } else {
                    ((12 + (i % 9) * 6) * 1024 * 1024) / 10
                },
                created_at: chrono::Utc::now().to_rfc3339(),
                relative_path: format!("DCIM/100APPLE/IMG_{}", 4200 + i),
                thumbnail_data_uri: None,
            }
        })
        .collect()
}
