import type {
  AppSettings,
  AuthenticityReport,
  Backup,
  BackupCategory,
  BackupSnapshot,
  BackupSourceInfo,
  BatterySnapshot,
  CommandResult,
  ConfigProfile,
  ContactEntry,
  ConvertResult,
  DependencyInfo,
  DeviceAsset,
  DeviceFileEntry,
  DeviceInfo,
  DeviceSummary,
  ExportHistoryEntry,
  Job,
  MediaItem,
  MediaMeta,
  MediaThumb,
  MessageEntry,
  MessageThread,
  NoteEntry,
  OperationLog,
  PrivacySummary,
  ProfileTemplate,
  Report,
  ReportType,
  RetentionPolicy,
  ScheduledBackup,
  SecurityFinding,
  SecurityScan,
  SupervisionInfo,
} from "@/lib/db-types";
import * as mock from "./mock-data";

/** True when running inside the Tauri native shell. */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// Lazily import the Tauri API only when available so the bundle works in a
// plain browser during pure-frontend development.
async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ok<T>(data: T): CommandResult<T> {
  return { success: true, data, error: null };
}

/**
 * Frontend fallback used only when the Rust backend is unavailable.
 * The real backend enforces all safety/validation; this mirror keeps the
 * UI demonstrable during web-only development.
 */
const browserMock = {
  async list_devices(): Promise<CommandResult<DeviceSummary[]>> {
    await delay(150);
    return ok(mock.mockDevices);
  },
  async get_device_info(udid: string): Promise<CommandResult<DeviceInfo>> {
    await delay(120);
    return ok(mock.mockDeviceInfo(udid));
  },
  async list_backups(): Promise<CommandResult<Backup[]>> {
    return ok(mock.mockBackups);
  },
  async list_media(): Promise<CommandResult<MediaItem[]>> {
    await delay(200);
    return ok(mock.mockMedia());
  },
  async list_reports(): Promise<CommandResult<Report[]>> {
    return ok(mock.mockReports);
  },
  async list_jobs(): Promise<CommandResult<Job[]>> {
    return ok(mock.mockJobs);
  },
  async recent_logs(): Promise<CommandResult<OperationLog[]>> {
    return ok(mock.mockLogs);
  },
  async run_dependency_check(): Promise<CommandResult<DependencyInfo[]>> {
    await delay(300);
    return ok(mock.mockDependencies);
  },
};

// In-memory settings used only for the browser mock.
let browserSettings: AppSettings = {
  language: "en",
  theme: "system",
  mock_mode: true,
  local_only_mode: true,
  telemetry_enabled: false,
  startup_behavior: "dashboard",
  default_device_view: "dashboard",
  onboarding_completed: false,
  experimental_modules: false,
  detailed_command_logs: false,
  data_retention_days: 90,
  backup_folder: "~/OETools/backups",
  export_folder: "~/OETools/exports",
  reports_folder: "~/OETools/reports",
  logs_folder: "~/OETools/logs",
};

/**
 * Unified API surface. Every method returns a `CommandResult<T>` envelope.
 * When Tauri is present the call is forwarded to the Rust backend; otherwise
 * a local mock keeps the UI functional.
 */
export const api = {
  // ---- Devices ----
  async listDevices(): Promise<CommandResult<DeviceSummary[]>> {
    if (isTauri()) return tauriInvoke("list_devices");
    return browserMock.list_devices();
  },
  async getDeviceInfo(udid: string): Promise<CommandResult<DeviceInfo>> {
    if (isTauri()) return tauriInvoke("get_device_info", { udid });
    return browserMock.get_device_info(udid);
  },
  async refreshDevice(udid: string): Promise<CommandResult<DeviceInfo>> {
    if (isTauri()) return tauriInvoke("refresh_device", { udid });
    return browserMock.get_device_info(udid);
  },
  async pairDevice(udid: string): Promise<CommandResult<DeviceSummary>> {
    if (isTauri()) return tauriInvoke("pair_device", { udid });
    await delay(400);
    return ok({ ...mock.mockDevices[0], udid, trust_state: "trusted" });
  },
  async getTrustStatus(udid: string): Promise<CommandResult<string>> {
    if (isTauri()) return tauriInvoke("get_trust_status", { udid });
    return ok("trusted");
  },

  // ---- Backups ----
  async createBackup(
    udid: string,
    encrypted: boolean,
  ): Promise<CommandResult<Job>> {
    if (isTauri()) return tauriInvoke("create_backup", { udid, encrypted });
    await delay(200);
    return ok({ ...mock.mockJobs[0], status: "in_progress", progress: 0 });
  },
  async listBackups(udid?: string): Promise<CommandResult<Backup[]>> {
    if (isTauri()) return tauriInvoke("list_backups", { udid: udid ?? null });
    return browserMock.list_backups();
  },
  async getBackupDetails(id: string): Promise<CommandResult<Backup>> {
    if (isTauri()) return tauriInvoke("get_backup_details", { id });
    return ok(mock.mockBackups[0]);
  },
  async cancelBackup(jobId: string): Promise<CommandResult<null>> {
    if (isTauri()) return tauriInvoke("cancel_backup", { jobId });
    return ok(null);
  },
  async openBackupFolder(path: string): Promise<CommandResult<null>> {
    if (isTauri()) return tauriInvoke("open_backup_folder", { path });
    return ok(null);
  },

  // ---- Media ----
  async listMedia(udid: string): Promise<CommandResult<MediaItem[]>> {
    if (isTauri()) return tauriInvoke("list_media", { udid });
    return browserMock.list_media();
  },
  async mediaInfo(
    udid: string,
    relativePath: string,
  ): Promise<CommandResult<MediaMeta>> {
    if (isTauri()) return tauriInvoke("media_info", { udid, relativePath });
    return ok({ size_bytes: 0, created_at: "" });
  },
  async mediaThumbnail(
    udid: string,
    relativePath: string,
    kind: string,
  ): Promise<CommandResult<MediaThumb>> {
    if (isTauri())
      return tauriInvoke("media_thumbnail", { udid, relativePath, kind });
    return ok({ data_uri: null, size_bytes: 0, created_at: "", kind });
  },
  async exportMedia(
    udid: string,
    ids: string[],
    destination: string,
  ): Promise<CommandResult<Job>> {
    if (isTauri())
      return tauriInvoke("export_media", { udid, ids, destination });
    await delay(200);
    return ok({ ...mock.mockJobs[0], job_type: "media_export", progress: 0 });
  },
  async cancelMediaExport(jobId: string): Promise<CommandResult<null>> {
    if (isTauri()) return tauriInvoke("cancel_media_export", { jobId });
    return ok(null);
  },

  // ---- Diagnostics ----
  async startSyslog(udid: string): Promise<CommandResult<Job>> {
    if (isTauri()) return tauriInvoke("start_syslog", { udid });
    return ok({ ...mock.mockJobs[0], job_type: "log_collect" });
  },
  async stopSyslog(jobId: string): Promise<CommandResult<null>> {
    if (isTauri()) return tauriInvoke("stop_syslog", { jobId });
    return ok(null);
  },
  async collectCrashReports(udid: string): Promise<CommandResult<Job>> {
    if (isTauri()) return tauriInvoke("collect_crash_reports", { udid });
    return ok({ ...mock.mockJobs[0], job_type: "log_collect" });
  },
  async exportLogs(destination: string): Promise<CommandResult<string>> {
    if (isTauri()) return tauriInvoke("export_logs", { destination });
    return ok(`${destination}/idevice-desk-logs.txt`);
  },
  async recentLogs(udid?: string): Promise<CommandResult<OperationLog[]>> {
    if (isTauri()) return tauriInvoke("recent_logs", { udid: udid ?? null });
    return browserMock.recent_logs();
  },
  async runDependencyCheck(): Promise<CommandResult<DependencyInfo[]>> {
    if (isTauri()) return tauriInvoke("run_dependency_check");
    return browserMock.run_dependency_check();
  },

  // ---- Reports ----
  async generateReport(
    udid: string,
    reportType: ReportType,
    notes: string,
  ): Promise<CommandResult<Report>> {
    if (isTauri())
      return tauriInvoke("generate_report", { udid, reportType, notes });
    await delay(300);
    return ok({ ...mock.mockReports[0], report_type: reportType });
  },
  async listReports(udid?: string): Promise<CommandResult<Report[]>> {
    if (isTauri()) return tauriInvoke("list_reports", { udid: udid ?? null });
    return browserMock.list_reports();
  },
  async openReport(id: string): Promise<CommandResult<null>> {
    if (isTauri()) return tauriInvoke("open_report", { id });
    return ok(null);
  },
  async deleteReport(id: string): Promise<CommandResult<null>> {
    if (isTauri()) return tauriInvoke("delete_report", { id });
    return ok(null);
  },

  // ---- Settings ----
  async getSettings(): Promise<CommandResult<AppSettings>> {
    if (isTauri()) return tauriInvoke("get_settings");
    return ok(browserSettings);
  },
  async updateSettings(
    patch: Partial<AppSettings>,
  ): Promise<CommandResult<AppSettings>> {
    if (isTauri()) return tauriInvoke("update_settings", { patch });
    browserSettings = { ...browserSettings, ...patch };
    return ok(browserSettings);
  },
  async selectFolder(): Promise<CommandResult<string | null>> {
    if (isTauri()) return tauriInvoke("select_folder");
    return ok("~/OETools/selected");
  },
  async selectFiles(): Promise<CommandResult<string[]>> {
    if (isTauri()) return tauriInvoke("select_files");
    return ok([]);
  },
  async openAppDataFolder(): Promise<CommandResult<null>> {
    if (isTauri()) return tauriInvoke("open_app_data_folder");
    return ok(null);
  },
  async resetSettings(): Promise<CommandResult<AppSettings>> {
    if (isTauri()) return tauriInvoke("reset_settings");
    return ok(browserSettings);
  },
  async clearAppHistory(): Promise<CommandResult<null>> {
    if (isTauri()) return tauriInvoke("clear_app_history");
    return ok(null);
  },
  async deleteKnownDevices(): Promise<CommandResult<null>> {
    if (isTauri()) return tauriInvoke("delete_known_devices");
    return ok(null);
  },

  // ---- Backup snapshots / retention ----
  async listSnapshots(udid?: string): Promise<CommandResult<BackupSnapshot[]>> {
    if (isTauri()) return tauriInvoke("list_snapshots", { udid: udid ?? null });
    return ok(udid ? mock.mockSnapshots(udid) : []);
  },
  async setSnapshotProtected(
    id: string,
    protected_: boolean,
  ): Promise<CommandResult<null>> {
    if (isTauri())
      return tauriInvoke("set_snapshot_protected", { id, protected: protected_ });
    return ok(null);
  },
  async updateSnapshot(
    id: string,
    label: string | null,
    notes: string | null,
  ): Promise<CommandResult<null>> {
    if (isTauri()) return tauriInvoke("update_snapshot", { id, label, notes });
    return ok(null);
  },
  async deleteSnapshot(id: string): Promise<CommandResult<null>> {
    if (isTauri()) return tauriInvoke("delete_snapshot", { id });
    return ok(null);
  },
  async getRetentionPolicy(): Promise<CommandResult<RetentionPolicy>> {
    if (isTauri()) return tauriInvoke("get_retention_policy");
    return ok(mock.mockRetentionPolicy);
  },
  async saveRetentionPolicy(
    policy: RetentionPolicy,
  ): Promise<CommandResult<RetentionPolicy>> {
    if (isTauri()) return tauriInvoke("save_retention_policy", { policy });
    return ok(policy);
  },
  async cleanupRecommendations(
    udid?: string,
  ): Promise<CommandResult<BackupSnapshot[]>> {
    if (isTauri())
      return tauriInvoke("cleanup_recommendations", { udid: udid ?? null });
    return ok(udid ? mock.mockSnapshots(udid).filter((s, i) => !s.is_protected && i > 4) : []);
  },
  async exportSnapshotMetadata(udid?: string): Promise<CommandResult<string>> {
    if (isTauri())
      return tauriInvoke("export_snapshot_metadata", { udid: udid ?? null });
    return ok(`~/OETools/exports/snapshot-metadata-${udid ?? "all"}.json`);
  },
  async openSnapshotFolder(path: string): Promise<CommandResult<null>> {
    if (isTauri()) return tauriInvoke("open_snapshot_folder", { path });
    return ok(null);
  },

  // ---- Scheduled backups ----
  async listSchedules(udid?: string): Promise<CommandResult<ScheduledBackup[]>> {
    if (isTauri()) return tauriInvoke("list_schedules", { udid: udid ?? null });
    return ok(udid ? [mock.mockSchedule(udid)] : []);
  },
  async saveSchedule(
    schedule: ScheduledBackup,
  ): Promise<CommandResult<ScheduledBackup>> {
    if (isTauri()) return tauriInvoke("save_schedule", { schedule });
    return ok(schedule);
  },
  async deleteSchedule(id: string): Promise<CommandResult<null>> {
    if (isTauri()) return tauriInvoke("delete_schedule", { id });
    return ok(null);
  },
  async dueSchedules(): Promise<CommandResult<ScheduledBackup[]>> {
    if (isTauri()) return tauriInvoke("due_schedules");
    return ok([]);
  },

  // ---- Privacy center ----
  async getPrivacySummary(): Promise<CommandResult<PrivacySummary>> {
    if (isTauri()) return tauriInvoke("get_privacy_summary");
    return ok(mock.mockPrivacySummary);
  },
  async deletePrivacyCategory(category: string): Promise<CommandResult<null>> {
    if (isTauri()) return tauriInvoke("delete_privacy_category", { category });
    return ok(null);
  },
  async factoryResetApp(): Promise<CommandResult<null>> {
    if (isTauri()) return tauriInvoke("factory_reset_app");
    return ok(null);
  },

  // ---- Battery history ----
  async listBatteryHistory(
    udid: string,
  ): Promise<CommandResult<BatterySnapshot[]>> {
    if (isTauri()) return tauriInvoke("list_battery_history", { udid });
    return ok(mock.mockBatteryHistory(udid));
  },

  // ---- Media / ringtone converter ----
  async convertMedia(
    inputs: string[],
    outputDir: string,
    target: string,
  ): Promise<CommandResult<Job>> {
    if (isTauri())
      return tauriInvoke("convert_media", { inputs, outputDir, target });
    await delay(200);
    return ok({ ...mock.mockJobs[0], job_type: "media_convert", progress: 0 });
  },
  async makeRingtone(
    input: string,
    outputDir: string,
    startSec: number,
    durationSec: number,
  ): Promise<CommandResult<ConvertResult>> {
    if (isTauri())
      return tauriInvoke("make_ringtone", { input, outputDir, startSec, durationSec });
    await delay(200);
    return ok({ output_paths: [`${outputDir}/ringtone.m4r`], converted: 1, failed: 0, output_dir: outputDir });
  },

  // ---- Device authenticity ----
  async authenticityReport(
    udid: string,
  ): Promise<CommandResult<AuthenticityReport>> {
    if (isTauri()) return tauriInvoke("authenticity_report", { udid });
    return ok(mock.mockAuthenticityReport(udid));
  },

  // ---- Backup browser / extractor ----
  async detectBackups(): Promise<CommandResult<BackupSourceInfo[]>> {
    if (isTauri()) return tauriInvoke("detect_backups");
    return ok(mock.mockBackupSources);
  },
  async openBackupSource(
    path: string,
  ): Promise<CommandResult<BackupSourceInfo>> {
    if (isTauri()) return tauriInvoke("open_backup_source", { path });
    return ok(mock.mockBackupSources[0]);
  },
  async listBackupCategories(
    path: string,
  ): Promise<CommandResult<BackupCategory[]>> {
    if (isTauri()) return tauriInvoke("list_backup_categories", { path });
    return ok(mock.mockBackupCategories);
  },
  async exportBackupCategory(
    path: string,
    category: string,
    destination: string,
  ): Promise<CommandResult<Job>> {
    if (isTauri())
      return tauriInvoke("export_backup_category", { path, category, destination });
    await delay(200);
    return ok({ ...mock.mockJobs[0], job_type: "backup_extract", progress: 0 });
  },

  // ---- Messages ----
  async listConversations(
    path: string,
  ): Promise<CommandResult<MessageThread[]>> {
    if (isTauri()) return tauriInvoke("list_conversations", { path });
    return ok(mock.mockConversations);
  },
  async getConversation(
    path: string,
    chatId: string,
    limit?: number,
  ): Promise<CommandResult<MessageEntry[]>> {
    if (isTauri())
      return tauriInvoke("get_conversation", { path, chatId, limit: limit ?? null });
    return ok(mock.mockConversationMessages);
  },
  async exportMessages(
    path: string,
    chatId: string,
    destination: string,
    format: string,
  ): Promise<CommandResult<string>> {
    if (isTauri())
      return tauriInvoke("export_messages", { path, chatId, destination, format });
    return ok(`${destination}/messages.${format}`);
  },

  // ---- Data export: contacts ----
  async listContacts(path: string): Promise<CommandResult<ContactEntry[]>> {
    if (isTauri()) return tauriInvoke("list_contacts", { path });
    return ok(mock.mockContacts);
  },
  async exportContacts(
    path: string,
    destination: string,
    format: string,
  ): Promise<CommandResult<string>> {
    if (isTauri())
      return tauriInvoke("export_contacts", { path, destination, format });
    return ok(`${destination}/contacts.${format === "csv" ? "csv" : "vcf"}`);
  },

  // ---- Data export: notes ----
  async listNotes(path: string): Promise<CommandResult<NoteEntry[]>> {
    if (isTauri()) return tauriInvoke("list_notes", { path });
    return ok(mock.mockNotes);
  },
  async getNote(path: string, noteId: string): Promise<CommandResult<NoteEntry>> {
    if (isTauri()) return tauriInvoke("get_note", { path, noteId });
    return ok(mock.mockNotes.find((n) => n.id === noteId) ?? mock.mockNotes[0]);
  },
  async exportNotes(
    path: string,
    destination: string,
    format: string,
  ): Promise<CommandResult<string>> {
    if (isTauri())
      return tauriInvoke("export_notes", { path, destination, format });
    return ok(`${destination}/notes.${format === "csv" ? "csv" : "html"}`);
  },

  // ---- Data export: WhatsApp ----
  async listWaChats(path: string): Promise<CommandResult<MessageThread[]>> {
    if (isTauri()) return tauriInvoke("list_wa_chats", { path });
    return ok(mock.mockConversations);
  },
  async getWaChat(
    path: string,
    chatId: string,
    limit?: number,
  ): Promise<CommandResult<MessageEntry[]>> {
    if (isTauri())
      return tauriInvoke("get_wa_chat", { path, chatId, limit: limit ?? null });
    return ok(mock.mockConversationMessages);
  },
  async exportWaChat(
    path: string,
    chatId: string,
    destination: string,
    format: string,
  ): Promise<CommandResult<string>> {
    if (isTauri())
      return tauriInvoke("export_wa_chat", { path, chatId, destination, format });
    return ok(`${destination}/whatsapp.${format}`);
  },

  // ---- Data export: export everything ----
  async exportAllData(
    path: string,
    destination: string,
  ): Promise<CommandResult<Job>> {
    if (isTauri()) return tauriInvoke("export_all_data", { path, destination });
    await delay(200);
    return ok({ ...mock.mockJobs[0], job_type: "data_export", progress: 0 });
  },

  // ---- Device file browser + quick transfer ----
  async listDeviceFiles(
    udid: string,
    path: string,
  ): Promise<CommandResult<DeviceFileEntry[]>> {
    if (isTauri()) return tauriInvoke("list_device_files", { udid, path });
    return ok(mock.mockDeviceDir(path));
  },
  async downloadDeviceFiles(
    udid: string,
    paths: string[],
    destination: string,
  ): Promise<CommandResult<Job>> {
    if (isTauri())
      return tauriInvoke("download_device_files", { udid, paths, destination });
    await delay(200);
    return ok({ ...mock.mockJobs[0], job_type: "device_transfer", progress: 0 });
  },
  async uploadToDevice(
    udid: string,
    files: string[],
    remoteDir: string,
  ): Promise<CommandResult<Job>> {
    if (isTauri())
      return tauriInvoke("upload_to_device", { udid, files, remoteDir });
    await delay(200);
    return ok({ ...mock.mockJobs[0], job_type: "device_transfer", progress: 0 });
  },
  async cancelTransfer(jobId: string): Promise<CommandResult<null>> {
    if (isTauri()) return tauriInvoke("cancel_transfer", { jobId });
    return ok(null);
  },

  // ---- Export history + evidence ----
  async listExportHistory(): Promise<CommandResult<ExportHistoryEntry[]>> {
    if (isTauri()) return tauriInvoke("list_export_history");
    return ok(mock.mockExportHistory);
  },
  async openExport(path: string): Promise<CommandResult<null>> {
    if (isTauri()) return tauriInvoke("open_export", { path });
    return ok(null);
  },
  async deleteExport(id: string, kind: string): Promise<CommandResult<null>> {
    if (isTauri()) return tauriInvoke("delete_export", { id, kind });
    return ok(null);
  },
  async createEvidencePackage(
    path: string,
    categories: string[],
    destination: string,
    operator?: string,
    organization?: string,
    caseId?: string,
    notes?: string,
  ): Promise<CommandResult<Job>> {
    if (isTauri())
      return tauriInvoke("create_evidence_package", {
        path,
        categories,
        destination,
        operator: operator ?? null,
        organization: organization ?? null,
        caseId: caseId ?? null,
        notes: notes ?? null,
      });
    await delay(200);
    return ok({ ...mock.mockJobs[0], job_type: "data_export", progress: 0 });
  },

  // ---- Business: configuration profiles ----
  async importProfile(path: string): Promise<CommandResult<ConfigProfile>> {
    if (isTauri()) return tauriInvoke("import_profile", { path });
    return ok(mock.mockProfiles[0]);
  },
  async listProfiles(): Promise<CommandResult<ConfigProfile[]>> {
    if (isTauri()) return tauriInvoke("list_profiles");
    return ok(mock.mockProfiles);
  },
  async deleteProfile(id: string): Promise<CommandResult<null>> {
    if (isTauri()) return tauriInvoke("delete_profile", { id });
    return ok(null);
  },
  async exportProfile(id: string, destination: string): Promise<CommandResult<string>> {
    if (isTauri()) return tauriInvoke("export_profile", { id, destination });
    return ok(`${destination}/profile.mobileconfig`);
  },

  // ---- Business: profile generator ----
  async listProfileTemplates(): Promise<CommandResult<ProfileTemplate[]>> {
    if (isTauri()) return tauriInvoke("list_profile_templates");
    return ok(mock.mockProfileTemplates);
  },
  async saveProfileTemplate(
    template: ProfileTemplate,
  ): Promise<CommandResult<ProfileTemplate>> {
    if (isTauri()) return tauriInvoke("save_profile_template", { template });
    return ok(template);
  },
  async deleteProfileTemplate(id: string): Promise<CommandResult<null>> {
    if (isTauri()) return tauriInvoke("delete_profile_template", { id });
    return ok(null);
  },
  async exportProfileTemplate(id: string, destination: string): Promise<CommandResult<string>> {
    if (isTauri()) return tauriInvoke("export_profile_template", { id, destination });
    return ok(`${destination}/profile.mobileconfig`);
  },

  // ---- Business: supervision ----
  async listSupervision(): Promise<CommandResult<SupervisionInfo[]>> {
    if (isTauri()) return tauriInvoke("list_supervision");
    return ok(mock.mockSupervision);
  },
  async refreshSupervision(udid: string): Promise<CommandResult<SupervisionInfo>> {
    if (isTauri()) return tauriInvoke("refresh_supervision", { udid });
    return ok(mock.mockSupervision.find((s) => s.udid === udid) ?? mock.mockSupervision[0]);
  },
  async setSupervisionOrg(
    udid: string,
    organization: string | null,
  ): Promise<CommandResult<null>> {
    if (isTauri()) return tauriInvoke("set_supervision_org", { udid, organization });
    return ok(null);
  },

  // ---- Business: fleet / assets ----
  async listAssets(): Promise<CommandResult<DeviceAsset[]>> {
    if (isTauri()) return tauriInvoke("list_assets");
    return ok(mock.mockAssets);
  },
  async saveAsset(asset: DeviceAsset): Promise<CommandResult<null>> {
    if (isTauri()) return tauriInvoke("save_asset", { asset });
    return ok(null);
  },

  // ---- Security analyzer ----
  async runSecurityScan(
    path: string,
    udid?: string,
  ): Promise<CommandResult<SecurityScan>> {
    if (isTauri())
      return tauriInvoke("run_security_scan", { path, udid: udid ?? null });
    await delay(500);
    return ok(mock.mockSecurityScan);
  },
  async listSecurityScans(
    udid?: string,
  ): Promise<CommandResult<SecurityScan[]>> {
    if (isTauri())
      return tauriInvoke("list_security_scans", { udid: udid ?? null });
    return ok([mock.mockSecurityScan]);
  },
  async getScanFindings(
    scanId: string,
  ): Promise<CommandResult<SecurityFinding[]>> {
    if (isTauri()) return tauriInvoke("get_scan_findings", { scanId });
    return ok(mock.mockSecurityFindings(scanId));
  },

  // ---- Jobs ----
  async listJobs(): Promise<CommandResult<Job[]>> {
    if (isTauri()) return tauriInvoke("list_jobs");
    return browserMock.list_jobs();
  },
  async getJob(id: string): Promise<CommandResult<Job>> {
    if (isTauri()) return tauriInvoke("get_job", { id });
    return ok(mock.mockJobs[0]);
  },
  async cancelJob(id: string): Promise<CommandResult<null>> {
    if (isTauri()) return tauriInvoke("cancel_job", { id });
    return ok(null);
  },
  async clearCompletedJobs(): Promise<CommandResult<null>> {
    if (isTauri()) return tauriInvoke("clear_completed_jobs");
    return ok(null);
  },
};

export type Api = typeof api;
