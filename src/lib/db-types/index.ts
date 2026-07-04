// Shared domain types mirroring the Rust backend structs and SQLite schema.
// Keep these in sync with src-tauri/src/database and command return types.

export type ConnectionState = "connected" | "disconnected";
export type TrustState = "trusted" | "untrusted" | "paired" | "not_paired" | "unknown";

export type JobType =
  | "device_scan"
  | "backup_create"
  | "media_export"
  | "report_generate"
  | "log_collect"
  | "dependency_check"
  | "media_convert"
  | "backup_extract"
  | "message_export"
  | "security_scan";

export type JobStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";

export type BackupStatus = "in_progress" | "completed" | "failed" | "cancelled";

export type ReportType =
  | "basic"
  | "technical"
  | "pre_service"
  | "backup_summary";

export type ReportFormat = "html" | "json";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type DeviceKind = "iphone" | "ipad" | "ipod" | "unknown";

export interface DeviceSummary {
  udid: string;
  name: string;
  kind: DeviceKind;
  product_type: string;
  model: string;
  os_version: string;
  connection_state: ConnectionState;
  trust_state: TrustState;
  is_mock: boolean;
}

export interface BatteryInfo {
  level_percent: number | null;
  health_percent: number | null;
  cycle_count: number | null;
  is_charging: boolean | null;
  state: string | null;
}

export interface StorageInfo {
  total_bytes: number | null;
  used_bytes: number | null;
  free_bytes: number | null;
}

export interface DeviceInfo {
  udid: string;
  serial_number: string;
  name: string;
  kind: DeviceKind;
  model: string;
  product_type: string;
  os_version: string;
  build_version: string | null;
  device_class: string | null;
  cpu_architecture: string | null;
  region_info: string | null;
  wifi_address: string | null;
  bluetooth_address: string | null;
  phone_number: string | null;
  activation_state: string | null;
  battery: BatteryInfo;
  storage: StorageInfo;
  connection_state: ConnectionState;
  trust_state: TrustState;
  is_mock: boolean;
  // Raw normalized key/value pairs (safe fields only).
  raw: Record<string, string>;
}

export interface Backup {
  id: string;
  device_udid: string;
  path: string;
  size_bytes: number | null;
  encrypted: boolean;
  status: BackupStatus;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface MediaItem {
  id: string;
  name: string;
  kind: "image" | "video";
  size_bytes: number;
  created_at: string;
  relative_path: string;
  thumbnail_data_uri?: string | null;
}

export interface MediaThumb {
  data_uri: string | null;
  size_bytes: number;
  created_at: string;
  kind: string;
}

export interface MediaMeta {
  size_bytes: number;
  created_at: string;
}

export interface Report {
  id: string;
  device_udid: string;
  report_type: ReportType;
  path: string;
  format: ReportFormat;
  created_at: string;
  summary_json: string;
}

export interface Job {
  id: string;
  job_type: JobType;
  status: JobStatus;
  progress: number; // 0..100
  device_udid: string | null;
  title: string;
  description: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  cancellable: boolean;
}

export interface OperationLog {
  id: string;
  job_id: string | null;
  device_udid: string | null;
  level: LogLevel;
  message: string;
  technical_details: string | null;
  created_at: string;
}

export interface DependencyInfo {
  id: string;
  name: string;
  detected: boolean;
  version: string | null;
  path: string | null;
  install_hint: string;
  optional: boolean;
  last_checked_at: string | null;
}

export type ThemeMode = "light" | "dark" | "system";
export type Language = "en" | "he";

export interface AppSettings {
  language: Language;
  theme: ThemeMode;
  mock_mode: boolean;
  local_only_mode: boolean;
  telemetry_enabled: boolean;
  startup_behavior: "dashboard" | "last_view" | "devices";
  default_device_view: string;
  onboarding_completed: boolean;
  experimental_modules: boolean;
  detailed_command_logs: boolean;
  data_retention_days: number;
  backup_folder: string;
  export_folder: string;
  reports_folder: string;
  logs_folder: string;
}

// ---- Backup snapshots / retention / schedules ----

export type SnapshotSourceType = "usb" | "wifi" | "imported";

export interface BackupSnapshot {
  id: string;
  device_udid: string;
  backup_id: string | null;
  snapshot_label: string | null;
  notes: string | null;
  path: string;
  size_bytes: number | null;
  encrypted: boolean;
  is_protected: boolean;
  created_at: string;
  completed_at: string | null;
  status: string;
  source_type: SnapshotSourceType;
  os_version: string | null;
  app_version: string | null;
  error_message: string | null;
}

export interface RetentionPolicy {
  id: string;
  device_udid: string | null;
  keep_daily_count: number;
  keep_weekly_count: number;
  keep_monthly_count: number;
  max_storage_bytes: number | null;
  auto_cleanup_enabled: boolean;
  protect_first_backup: boolean;
  created_at: string;
  updated_at: string;
}

export type ScheduleType =
  | "manual"
  | "daily"
  | "weekly"
  | "on_connect"
  | "on_start";

export interface ScheduledBackup {
  id: string;
  device_udid: string;
  enabled: boolean;
  schedule_type: ScheduleType;
  preferred_time: string | null;
  weekdays_json: string | null;
  destination_path: string | null;
  encrypted_preferred: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  last_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrivacySummary {
  devices: number;
  backups: number;
  snapshots: number;
  reports: number;
  logs: number;
  jobs: number;
  index_items: number;
  security_scans: number;
  data_exports: number;
  app_data_dir: string;
  local_only: boolean;
  telemetry_enabled: boolean;
}

// ---- Battery history ----

export interface BatterySnapshot {
  id: string;
  device_udid: string;
  level_percent: number | null;
  health_percent: number | null;
  cycle_count: number | null;
  is_charging: boolean | null;
  captured_at: string;
}

// ---- Media / ringtone converter ----

export interface ConvertResult {
  output_paths: string[];
  converted: number;
  failed: number;
  output_dir: string;
}

// ---- Device authenticity report ----

export interface AuthenticityCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "info" | "fail";
  detail: string;
}

export interface AuthenticityReport {
  udid: string;
  name: string;
  model: string;
  product_type: string;
  os_version: string;
  serial_number: string;
  battery_health: number | null;
  cycle_count: number | null;
  activation_state: string | null;
  trust_state: string;
  supervised: boolean;
  verdict: "genuine" | "review" | "unknown";
  checks: AuthenticityCheck[];
}

// ---- Backup browser / extractor ----

export interface BackupSourceInfo {
  id: string;
  path: string;
  device_name: string | null;
  product_type: string | null;
  product_version: string | null;
  serial_number: string | null;
  last_backup_date: string | null;
  encrypted: boolean;
  source_label: string;
}

export interface BackupCategory {
  id: string;
  label: string;
  item_count: number;
  total_size_bytes: number;
  exportable: boolean;
}

// ---- Messages ----

export interface MessageThread {
  chat_id: string;
  display_name: string;
  handle: string;
  service: string;
  message_count: number;
  last_message_at: string | null;
  last_snippet: string;
}

export interface MessageEntry {
  id: string;
  from_me: boolean;
  sender: string;
  text: string;
  sent_at: string | null;
  service: string;
  has_attachment: boolean;
}

// ---- Security / spyware analyzer ----

export interface SecurityFinding {
  id: string;
  scan_id: string;
  severity: "high" | "medium" | "low" | "info";
  category: string | null;
  title: string;
  description: string | null;
  evidence: string | null;
  recommendation: string | null;
  created_at: string;
}

export interface SecurityScan {
  id: string;
  backup_source_id: string | null;
  device_udid: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  risk_level: string | null;
  findings_count: number;
  report_path: string | null;
  error_message: string | null;
}

// Uniform command envelope returned by every backend command.
export interface CommandError {
  message: string;
  technical_details: string | null;
  suggested_fix: string | null;
  related_dependency: string | null;
}

export interface CommandResult<T> {
  success: boolean;
  data: T | null;
  error: CommandError | null;
}
