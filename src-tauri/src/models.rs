use serde::{Deserialize, Serialize};

// Domain models shared across the backend. These serialize to the exact
// shapes the frontend expects (see src/lib/db-types/index.ts).

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceSummary {
    pub udid: String,
    pub name: String,
    pub kind: String,
    pub product_type: String,
    pub model: String,
    pub os_version: String,
    pub connection_state: String,
    pub trust_state: String,
    pub is_mock: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatteryInfo {
    pub level_percent: Option<i64>,
    pub health_percent: Option<i64>,
    pub cycle_count: Option<i64>,
    pub is_charging: Option<bool>,
    pub state: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageInfo {
    pub total_bytes: Option<i64>,
    pub used_bytes: Option<i64>,
    pub free_bytes: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub udid: String,
    pub serial_number: String,
    pub name: String,
    pub kind: String,
    pub model: String,
    pub product_type: String,
    pub os_version: String,
    pub build_version: Option<String>,
    pub device_class: Option<String>,
    pub cpu_architecture: Option<String>,
    pub region_info: Option<String>,
    pub wifi_address: Option<String>,
    pub bluetooth_address: Option<String>,
    pub phone_number: Option<String>,
    pub activation_state: Option<String>,
    pub battery: BatteryInfo,
    pub storage: StorageInfo,
    pub connection_state: String,
    pub trust_state: String,
    pub is_mock: bool,
    pub raw: std::collections::BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Backup {
    pub id: String,
    pub device_udid: String,
    pub path: String,
    pub size_bytes: Option<i64>,
    pub encrypted: bool,
    pub status: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub error_message: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaItem {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub size_bytes: i64,
    pub created_at: String,
    pub relative_path: String,
    pub thumbnail_data_uri: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Report {
    pub id: String,
    pub device_udid: String,
    pub report_type: String,
    pub path: String,
    pub format: String,
    pub created_at: String,
    pub summary_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: String,
    pub job_type: String,
    pub status: String,
    pub progress: i64,
    pub device_udid: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub error_message: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub cancellable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationLog {
    pub id: String,
    pub job_id: Option<String>,
    pub device_udid: Option<String>,
    pub level: String,
    pub message: String,
    pub technical_details: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyInfo {
    pub id: String,
    pub name: String,
    pub detected: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub install_hint: String,
    pub optional: bool,
    pub last_checked_at: Option<String>,
}

/// Lazily-fetched thumbnail + basic metadata for a single media item.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaThumb {
    /// A `data:image/jpeg;base64,…` URI, or `None` when a preview could not be
    /// produced (unsupported tool, oversized video, etc.).
    pub data_uri: Option<String>,
    pub size_bytes: i64,
    pub created_at: String,
    pub kind: String,
}

/// Cheap size/date metadata for a media item (no file transfer).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaMeta {
    pub size_bytes: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupSnapshot {
    pub id: String,
    pub device_udid: String,
    pub backup_id: Option<String>,
    pub snapshot_label: Option<String>,
    pub notes: Option<String>,
    pub path: String,
    pub size_bytes: Option<i64>,
    pub encrypted: bool,
    pub is_protected: bool,
    pub created_at: String,
    pub completed_at: Option<String>,
    pub status: String,
    /// usb | wifi | imported
    pub source_type: String,
    pub os_version: Option<String>,
    pub app_version: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetentionPolicy {
    pub id: String,
    pub device_udid: Option<String>,
    pub keep_daily_count: i64,
    pub keep_weekly_count: i64,
    pub keep_monthly_count: i64,
    pub max_storage_bytes: Option<i64>,
    pub auto_cleanup_enabled: bool,
    pub protect_first_backup: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledBackup {
    pub id: String,
    pub device_udid: String,
    pub enabled: bool,
    /// manual | daily | weekly | on_connect | on_start
    pub schedule_type: String,
    pub preferred_time: Option<String>,
    pub weekdays_json: Option<String>,
    pub destination_path: Option<String>,
    pub encrypted_preferred: bool,
    pub last_run_at: Option<String>,
    pub next_run_at: Option<String>,
    pub last_status: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Aggregate counts + locations for the Privacy Center.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacySummary {
    pub devices: i64,
    pub backups: i64,
    pub snapshots: i64,
    pub reports: i64,
    pub logs: i64,
    pub jobs: i64,
    pub index_items: i64,
    pub security_scans: i64,
    pub data_exports: i64,
    pub app_data_dir: String,
    pub local_only: bool,
    pub telemetry_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub language: String,
    pub theme: String,
    pub mock_mode: bool,
    pub local_only_mode: bool,
    pub telemetry_enabled: bool,
    pub startup_behavior: String,
    pub default_device_view: String,
    pub onboarding_completed: bool,
    pub experimental_modules: bool,
    pub detailed_command_logs: bool,
    pub data_retention_days: i64,
    pub backup_folder: String,
    pub export_folder: String,
    pub reports_folder: String,
    pub logs_folder: String,
}

// ---- Battery history ----

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatterySnapshot {
    pub id: String,
    pub device_udid: String,
    pub level_percent: Option<i64>,
    pub health_percent: Option<i64>,
    pub cycle_count: Option<i64>,
    pub is_charging: Option<bool>,
    pub captured_at: String,
}

// ---- Media / ringtone converter ----

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConvertResult {
    pub output_paths: Vec<String>,
    pub converted: i64,
    pub failed: i64,
    pub output_dir: String,
}

// ---- Device authenticity & health report ----

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthenticityCheck {
    pub id: String,
    pub label: String,
    /// "pass" | "warn" | "info" | "fail"
    pub status: String,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthenticityReport {
    pub udid: String,
    pub name: String,
    pub model: String,
    pub product_type: String,
    pub os_version: String,
    pub serial_number: String,
    pub battery_health: Option<i64>,
    pub cycle_count: Option<i64>,
    pub activation_state: Option<String>,
    pub trust_state: String,
    pub supervised: bool,
    /// Overall verdict: "genuine" | "review" | "unknown".
    pub verdict: String,
    pub checks: Vec<AuthenticityCheck>,
}

// ---- Backup browser / extractor ----

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupSourceInfo {
    pub id: String,
    pub path: String,
    pub device_name: Option<String>,
    pub product_type: Option<String>,
    pub product_version: Option<String>,
    pub serial_number: Option<String>,
    pub last_backup_date: Option<String>,
    pub encrypted: bool,
    pub source_label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupCategory {
    pub id: String,
    pub label: String,
    pub item_count: i64,
    pub total_size_bytes: i64,
    pub exportable: bool,
}

// ---- Messages ----

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageThread {
    pub chat_id: String,
    pub display_name: String,
    pub handle: String,
    pub service: String,
    pub message_count: i64,
    pub last_message_at: Option<String>,
    pub last_snippet: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageEntry {
    pub id: String,
    pub from_me: bool,
    pub sender: String,
    pub text: String,
    pub sent_at: Option<String>,
    pub service: String,
    pub has_attachment: bool,
}

// ---- Security / spyware analyzer ----

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityFinding {
    pub id: String,
    pub scan_id: String,
    pub severity: String,
    pub category: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub evidence: Option<String>,
    pub recommendation: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityScan {
    pub id: String,
    pub backup_source_id: Option<String>,
    pub device_udid: Option<String>,
    pub status: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub risk_level: Option<String>,
    pub findings_count: i64,
    pub report_path: Option<String>,
    pub error_message: Option<String>,
}

pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}
