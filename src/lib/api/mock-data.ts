// Frontend-side mock dataset. Used when the Tauri backend is unavailable
// (e.g. running the UI in a plain browser via `npm run dev`).
// The authoritative mock lives in Rust (src-tauri/src/device_bridge/mock.rs);
// this mirror keeps the UI fully usable during pure-web development.
import type {
  AuthenticityReport,
  Backup,
  BackupCategory,
  BackupSnapshot,
  BackupSourceInfo,
  BatterySnapshot,
  ConfigProfile,
  ContactEntry,
  DependencyInfo,
  DeviceAsset,
  DeviceFileEntry,
  DeviceInfo,
  DeviceSummary,
  ExportHistoryEntry,
  Job,
  MediaItem,
  MessageEntry,
  MessageThread,
  NoteEntry,
  OperationLog,
  ProfileTemplate,
  SupervisionInfo,
  PrivacySummary,
  Report,
  RetentionPolicy,
  ScheduledBackup,
  SecurityFinding,
  SecurityScan,
} from "@/lib/db-types";

const now = () => new Date().toISOString();
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86400000).toISOString();

export const mockDevices: DeviceSummary[] = [
  {
    udid: "00008110-000A1B2C3D4E5F6G",
    name: "Personal iPhone",
    kind: "iphone",
    product_type: "iPhone15,3",
    model: "iPhone 14 Pro Max",
    os_version: "17.5.1",
    connection_state: "connected",
    trust_state: "trusted",
    is_mock: true,
  },
  {
    udid: "00008027-9A8B7C6D5E4F3G2H",
    name: "Business iPad",
    kind: "ipad",
    product_type: "iPad14,5",
    model: "iPad Pro 12.9 (6th gen)",
    os_version: "17.4",
    connection_state: "connected",
    trust_state: "paired",
    is_mock: true,
  },
  {
    udid: "00008103-0011AABB22CC33DD",
    name: "Kiosk iPad (Supervised)",
    kind: "ipad",
    product_type: "iPad13,4",
    model: "iPad Pro 11 (3rd gen)",
    os_version: "16.5",
    connection_state: "connected",
    trust_state: "trusted",
    is_mock: true,
  },
];

export function mockDeviceInfo(udid: string): DeviceInfo {
  const summary =
    mockDevices.find((d) => d.udid === udid) ?? mockDevices[0];
  const isIpad = summary.kind === "ipad";
  return {
    udid: summary.udid,
    serial_number: isIpad ? "DMPX1A2B3C4D" : "F2LX9K8J7H6G",
    name: summary.name,
    kind: summary.kind,
    model: summary.model,
    product_type: summary.product_type,
    os_version: summary.os_version,
    build_version: isIpad ? "21E219" : "21F90",
    device_class: isIpad ? "iPad" : "iPhone",
    cpu_architecture: "arm64e",
    region_info: "LL/A",
    wifi_address: "a4:83:e7:xx:xx:xx",
    bluetooth_address: "a4:83:e7:yy:yy:yy",
    phone_number: isIpad ? null : "+1 (555) 010-2030",
    activation_state: "Activated",
    battery: {
      level_percent: isIpad ? 76 : 63,
      health_percent: isIpad ? 98 : 89,
      cycle_count: isIpad ? 84 : 342,
      is_charging: false,
      state: "Discharging",
    },
    storage: {
      total_bytes: isIpad ? 256 * 1024 ** 3 : 512 * 1024 ** 3,
      used_bytes: isIpad ? 121 * 1024 ** 3 : 388 * 1024 ** 3,
      free_bytes: isIpad ? 135 * 1024 ** 3 : 124 * 1024 ** 3,
    },
    connection_state: summary.connection_state,
    trust_state: summary.trust_state,
    is_mock: true,
    raw: {
      DeviceName: summary.name,
      ProductType: summary.product_type,
      ProductVersion: summary.os_version,
      BuildVersion: isIpad ? "21E219" : "21F90",
      DeviceColor: "1",
      DeviceEnclosureColor: "1",
      HardwareModel: isIpad ? "J617AP" : "D74AP",
      ModelNumber: isIpad ? "MNXR3" : "MQ9X3",
      RegionInfo: "LL/A",
      TelephonyCapability: isIpad ? "false" : "true",
      WiFiAddress: "a4:83:e7:xx:xx:xx",
      TimeZone: "Asia/Jerusalem",
      "com.apple.mobile.battery/BatteryCurrentCapacity": isIpad ? "76" : "63",
    },
  };
}

export const mockBackups: Backup[] = [
  {
    id: "bkp_1001",
    device_udid: mockDevices[0].udid,
    path: "~/OETools/backups/00008110-.../2026-06-28",
    size_bytes: 42.6 * 1024 ** 3,
    encrypted: true,
    status: "completed",
    started_at: daysAgo(5),
    completed_at: daysAgo(5),
    error_message: null,
    created_at: daysAgo(5),
  },
  {
    id: "bkp_1000",
    device_udid: mockDevices[0].udid,
    path: "~/OETools/backups/00008110-.../2026-06-10",
    size_bytes: 39.1 * 1024 ** 3,
    encrypted: false,
    status: "completed",
    started_at: daysAgo(23),
    completed_at: daysAgo(23),
    error_message: null,
    created_at: daysAgo(23),
  },
];

export function mockMedia(count = 24): MediaItem[] {
  const items: MediaItem[] = [];
  for (let i = 0; i < count; i++) {
    const isVideo = i % 5 === 0;
    items.push({
      id: `media_${i}`,
      name: isVideo ? `IMG_${4200 + i}.MOV` : `IMG_${4200 + i}.HEIC`,
      kind: isVideo ? "video" : "image",
      size_bytes: isVideo
        ? (30 + (i % 12) * 8) * 1024 ** 2
        : (1.2 + (i % 9) * 0.6) * 1024 ** 2,
      created_at: daysAgo(i),
      relative_path: `DCIM/100APPLE/IMG_${4200 + i}`,
      thumbnail_data_uri: null,
    });
  }
  return items;
}

export const mockReports: Report[] = [
  {
    id: "rep_2001",
    device_udid: mockDevices[0].udid,
    report_type: "technical",
    path: "~/OETools/reports/technical-2026-06-28.html",
    format: "html",
    created_at: daysAgo(5),
    summary_json: JSON.stringify({ device: "Rotem's iPhone", os: "17.5.1" }),
  },
];

export const mockJobs: Job[] = [
  {
    id: "job_3001",
    job_type: "backup_create",
    status: "completed",
    progress: 100,
    device_udid: mockDevices[0].udid,
    title: "Backup — Rotem's iPhone",
    description: "Full local backup",
    error_message: null,
    started_at: daysAgo(5),
    completed_at: daysAgo(5),
    created_at: daysAgo(5),
    cancellable: false,
  },
];

export const mockLogs: OperationLog[] = [
  {
    id: "log_1",
    job_id: null,
    device_udid: mockDevices[0].udid,
    level: "info",
    message: "Device connected via USB",
    technical_details: "usbmuxd: attached 00008110-...",
    created_at: now(),
  },
  {
    id: "log_2",
    job_id: null,
    device_udid: mockDevices[0].udid,
    level: "info",
    message: "Pairing record validated",
    technical_details: "lockdownd: trusted host",
    created_at: now(),
  },
];

export function mockSnapshots(udid: string): BackupSnapshot[] {
  return Array.from({ length: 8 }).map((_, i) => ({
    id: `snap_${udid}_${i}`,
    device_udid: udid,
    backup_id: null,
    snapshot_label:
      i === 0 ? "Before iOS update" : i === 3 ? "Monthly archive" : null,
    notes:
      i === 0 ? "Full snapshot taken prior to a major iOS update." : null,
    path: `~/OETools/backups/${udid}/snapshot-${i}`,
    size_bytes: (18 + ((i * 3) % 11)) * 1024 ** 3,
    encrypted: i % 2 === 0,
    is_protected: i === 3 || i === 7,
    created_at: daysAgo(i * 4 + 1),
    completed_at: daysAgo(i * 4 + 1),
    status: "completed",
    source_type: i === 5 ? "imported" : i % 3 === 0 ? "wifi" : "usb",
    os_version: "17.5.1",
    app_version: "0.1.0",
    error_message: null,
  }));
}

export function mockSchedule(udid: string): ScheduledBackup {
  return {
    id: `sched_${udid}`,
    device_udid: udid,
    enabled: true,
    schedule_type: "on_connect",
    preferred_time: "02:00",
    weekdays_json: "[1,3,5]",
    destination_path: `~/OETools/backups/${udid}`,
    encrypted_preferred: true,
    last_run_at: daysAgo(2),
    next_run_at: new Date(Date.now() + 86400000).toISOString(),
    last_status: "completed",
    created_at: daysAgo(30),
    updated_at: daysAgo(2),
  };
}

export const mockRetentionPolicy: RetentionPolicy = {
  id: "ret_global",
  device_udid: null,
  keep_daily_count: 7,
  keep_weekly_count: 4,
  keep_monthly_count: 6,
  max_storage_bytes: null,
  auto_cleanup_enabled: false,
  protect_first_backup: true,
  created_at: daysAgo(60),
  updated_at: daysAgo(1),
};

export const mockPrivacySummary: PrivacySummary = {
  devices: mockDevices.length,
  backups: mockBackups.length,
  snapshots: 8,
  reports: mockReports.length,
  logs: mockLogs.length,
  jobs: mockJobs.length,
  index_items: 0,
  security_scans: 1,
  data_exports: 0,
  app_data_dir: "~/Library/Application Support/OETools",
  local_only: true,
  telemetry_enabled: false,
};

export const mockDependencies: DependencyInfo[] = [
  {
    id: "idevice_id",
    name: "idevice_id",
    detected: true,
    version: "1.4.0",
    path: "/opt/homebrew/bin/idevice_id",
    install_hint: "brew install libimobiledevice",
    optional: false,
    last_checked_at: now(),
  },
  {
    id: "ideviceinfo",
    name: "ideviceinfo",
    detected: true,
    version: "1.4.0",
    path: "/opt/homebrew/bin/ideviceinfo",
    install_hint: "brew install libimobiledevice",
    optional: false,
    last_checked_at: now(),
  },
  {
    id: "idevicepair",
    name: "idevicepair",
    detected: true,
    version: "1.4.0",
    path: "/opt/homebrew/bin/idevicepair",
    install_hint: "brew install libimobiledevice",
    optional: false,
    last_checked_at: now(),
  },
  {
    id: "idevicebackup2",
    name: "idevicebackup2",
    detected: true,
    version: "1.4.0",
    path: "/opt/homebrew/bin/idevicebackup2",
    install_hint: "brew install libimobiledevice",
    optional: false,
    last_checked_at: now(),
  },
  {
    id: "idevicesyslog",
    name: "idevicesyslog",
    detected: true,
    version: "1.4.0",
    path: "/opt/homebrew/bin/idevicesyslog",
    install_hint: "brew install libimobiledevice",
    optional: false,
    last_checked_at: now(),
  },
  {
    id: "idevicecrashreport",
    name: "idevicecrashreport",
    detected: true,
    version: null,
    path: "/opt/homebrew/bin/idevicecrashreport",
    install_hint: "brew install libimobiledevice",
    optional: true,
    last_checked_at: now(),
  },
  {
    id: "usbmuxd",
    name: "usbmuxd",
    detected: true,
    version: "system",
    path: "system (com.apple.usbmuxd)",
    install_hint:
      "Built into macOS; on Windows install Apple Mobile Device Support (iTunes).",
    optional: false,
    last_checked_at: now(),
  },
  {
    id: "ifuse",
    name: "ifuse",
    detected: false,
    version: null,
    path: null,
    install_hint:
      "Optional: brew install --cask macfuse && brew install ifuse (macOS/Linux only)",
    optional: true,
    last_checked_at: now(),
  },
];

// ---- Battery history ----

export function mockBatteryHistory(udid: string): BatterySnapshot[] {
  const out: BatterySnapshot[] = [];
  for (let i = 30; i >= 0; i -= 3) {
    out.push({
      id: `bat-${i}`,
      device_udid: udid,
      level_percent: 40 + Math.round(Math.random() * 55),
      health_percent: 92 - Math.round((30 - i) / 6),
      cycle_count: 300 + (30 - i) * 4,
      is_charging: i % 2 === 0,
      captured_at: daysAgo(i),
    });
  }
  return out;
}

// ---- Device authenticity ----

export function mockAuthenticityReport(udid: string): AuthenticityReport {
  return {
    udid,
    name: "Personal iPhone",
    model: "iPhone 14 Pro Max",
    product_type: "iPhone15,3",
    os_version: "17.5.1",
    serial_number: "F2LW1234ABCD",
    battery_health: 89,
    cycle_count: 356,
    activation_state: "Activated",
    trust_state: "trusted",
    supervised: false,
    verdict: "genuine",
    checks: [
      { id: "model", label: "Model identifier", status: "pass", detail: "iPhone 14 Pro Max (iPhone15,3)" },
      { id: "serial", label: "Serial number", status: "pass", detail: "F2LW1234ABCD" },
      { id: "firmware", label: "iOS/iPadOS version", status: "pass", detail: "17.5.1 21F90" },
      { id: "battery", label: "Battery health", status: "pass", detail: "89% of design capacity" },
      { id: "cycles", label: "Battery charge cycles", status: "info", detail: "356 cycles" },
      { id: "activation", label: "Activation state", status: "pass", detail: "Activated" },
      { id: "trust", label: "Pairing trust", status: "pass", detail: "This computer is trusted." },
    ],
  };
}

// ---- Backup browser ----

export const mockBackupSources: BackupSourceInfo[] = [
  {
    id: "/Users/demo/Library/.../00008110",
    path: "/Users/demo/Library/Application Support/MobileSync/Backup/00008110",
    device_name: "Personal iPhone",
    product_type: "iPhone15,3",
    product_version: "17.5.1",
    serial_number: "F2LW1234ABCD",
    last_backup_date: daysAgo(2),
    encrypted: false,
    source_label: "Finder / iTunes",
  },
];

export const mockBackupCategories: BackupCategory[] = [
  { id: "photos", label: "Photos & Videos", item_count: 3421, total_size_bytes: 0, exportable: true },
  { id: "messages", label: "Messages", item_count: 12, total_size_bytes: 0, exportable: true },
  { id: "contacts", label: "Contacts", item_count: 3, total_size_bytes: 0, exportable: true },
  { id: "notes", label: "Notes", item_count: 4, total_size_bytes: 0, exportable: true },
  { id: "calendars", label: "Calendars", item_count: 2, total_size_bytes: 0, exportable: true },
  { id: "safari", label: "Safari", item_count: 9, total_size_bytes: 0, exportable: true },
  { id: "call_history", label: "Call History", item_count: 1, total_size_bytes: 0, exportable: true },
  { id: "voicemail", label: "Voicemail", item_count: 6, total_size_bytes: 0, exportable: true },
  { id: "voice_memos", label: "Voice Memos", item_count: 5, total_size_bytes: 0, exportable: true },
  { id: "whatsapp", label: "WhatsApp", item_count: 240, total_size_bytes: 0, exportable: true },
];

// ---- Messages ----

export const mockConversations: MessageThread[] = [
  {
    chat_id: "1",
    display_name: "Alex Johnson",
    handle: "+15551234567",
    service: "iMessage",
    message_count: 842,
    last_message_at: daysAgo(1),
    last_snippet: "See you tomorrow!",
  },
  {
    chat_id: "2",
    display_name: "Family",
    handle: "chat-family",
    service: "iMessage",
    message_count: 3120,
    last_message_at: daysAgo(3),
    last_snippet: "Photos from the trip 📎",
  },
];

export const mockConversationMessages: MessageEntry[] = [
  { id: "m1", from_me: false, sender: "+15551234567", text: "Hey, are we still on for tomorrow?", sent_at: daysAgo(1), service: "iMessage", has_attachment: false },
  { id: "m2", from_me: true, sender: "Me", text: "Yes! 10am works.", sent_at: daysAgo(1), service: "iMessage", has_attachment: false },
  { id: "m3", from_me: false, sender: "+15551234567", text: "See you tomorrow!", sent_at: daysAgo(1), service: "iMessage", has_attachment: false },
];

// ---- Data export: contacts & notes ----

export const mockContacts: ContactEntry[] = [
  { id: "1", name: "Alex Johnson", organization: "Acme Inc.", phones: ["+15551234567"], emails: ["alex@example.com"] },
  { id: "2", name: "Dana Levi", organization: null, phones: ["+15559876543"], emails: ["dana@example.com", "dana.work@example.com"] },
  { id: "3", name: "Sam Cohen", organization: "Studio 5", phones: ["+15550001111"], emails: [] },
];

export const mockNotes: NoteEntry[] = [
  { id: "1", title: "Shopping list", snippet: "Milk, eggs, bread…", folder: "Notes", modified_at: daysAgo(1), body: "Milk\nEggs\nBread\nCoffee" },
  { id: "2", title: "Trip ideas", snippet: "Places to visit next summer", folder: "Travel", modified_at: daysAgo(9), body: "Places to visit next summer:\n- Lisbon\n- Kyoto\n- Reykjavik" },
];

// ---- Device file browser ----

export function mockDeviceDir(path: string): DeviceFileEntry[] {
  const base = !path || path === "/" ? "" : path.replace(/\/$/, "");
  if (!base) {
    return ["DCIM", "Downloads", "Photos", "Books", "PublicStaging"].map((d) => ({
      name: d,
      path: `/${d}`,
      is_dir: true,
      size_bytes: 0,
      modified_at: now(),
    }));
  }
  return Array.from({ length: 6 }, (_, i) => {
    const isDir = i < 2;
    const name = isDir ? `${100 + i}APPLE` : `IMG_${4200 + i}.HEIC`;
    return {
      name,
      path: `${base}/${name}`,
      is_dir: isDir,
      size_bytes: isDir ? 0 : (2 + i) * 1024 * 1024,
      modified_at: now(),
    };
  });
}

// ---- Business: profiles, supervision, fleet ----

export const mockProfiles: ConfigProfile[] = [
  { id: "p1", name: "Corp Wi-Fi", organization: "Acme Inc.", identifier: "com.acme.wifi", profile_type: "Configuration", path: "~/OETools/profiles/corp-wifi.mobileconfig", installed_at: daysAgo(12) },
  { id: "p2", name: "Kiosk Restrictions", organization: "Acme Inc.", identifier: "com.acme.kiosk", profile_type: "Configuration", path: "~/OETools/profiles/kiosk.mobileconfig", installed_at: daysAgo(30) },
];

export const mockProfileTemplates: ProfileTemplate[] = [
  { id: "t1", name: "Company Portal", description: "Web clip to the company portal", payload_type: "webclip", profile_json: JSON.stringify({ label: "Portal", url: "https://portal.example.com" }), created_at: daysAgo(5), updated_at: daysAgo(5) },
];

export const mockSupervision: SupervisionInfo[] = [
  { udid: "00008110-000A1B2C3D4E5F6G", device_name: "Personal iPhone", supervised: false, organization_name: null, last_checked_at: daysAgo(1) },
  { udid: "00008103-0011AABB22CC33DD", device_name: "Kiosk iPad", supervised: true, organization_name: "Acme Inc.", last_checked_at: daysAgo(1) },
];

export const mockAssets: DeviceAsset[] = [
  { device_udid: "00008110-000A1B2C3D4E5F6G", device_name: "Personal iPhone", model: "iPhone 14 Pro Max", os_version: "17.5.1", employee_name: "Alex Johnson", department: "Sales", location: "HQ", asset_tag: "ACME-0142", notes: null, updated_at: daysAgo(3) },
  { device_udid: "00008103-0011AABB22CC33DD", device_name: "Kiosk iPad", model: "iPad (9th gen)", os_version: "17.4", employee_name: null, department: "Front desk", location: "Lobby", asset_tag: "ACME-0210", notes: "Wall-mounted", updated_at: daysAgo(8) },
];

// ---- Export history ----

export const mockExportHistory: ExportHistoryEntry[] = [
  { id: "e1", kind: "data", label: "contacts", output_path: "~/OETools/exports/contacts_20260705.vcf", item_count: 128, evidence: false, created_at: daysAgo(0) },
  { id: "e2", kind: "data", label: "messages", output_path: "~/OETools/exports/messages_1.html", item_count: 842, evidence: false, created_at: daysAgo(2) },
  { id: "e3", kind: "evidence", label: "evidence", output_path: "~/OETools/exports/OETools_evidence_20260701", item_count: null, evidence: true, created_at: daysAgo(4) },
];

// ---- Security analyzer ----

export const mockSecurityScan: SecurityScan = {
  id: "scan-1",
  backup_source_id: mockBackupSources[0].path,
  device_udid: null,
  status: "completed",
  started_at: now(),
  completed_at: now(),
  risk_level: "medium",
  findings_count: 3,
  report_path: null,
  error_message: null,
};

export function mockSecurityFindings(scanId: string): SecurityFinding[] {
  return [
    {
      id: "f1",
      scan_id: scanId,
      severity: "medium",
      category: "profiles",
      title: "Configuration profiles present",
      description: "One or more configuration/MDM profiles are installed.",
      evidence: "2 profile-related file(s)",
      recommendation: "Review installed profiles under Settings → General → VPN & Device Management.",
      created_at: now(),
    },
    {
      id: "f2",
      scan_id: scanId,
      severity: "info",
      category: "encryption",
      title: "Backup is not encrypted",
      description: "This backup is unencrypted, so anyone with file access can read its contents.",
      evidence: null,
      recommendation: "Enable encrypted backups to protect sensitive data.",
      created_at: now(),
    },
    {
      id: "f3",
      scan_id: scanId,
      severity: "info",
      category: "ioc",
      title: "No IOC matches in Safari history",
      description: "Checked Safari history against your indicators; no matches.",
      evidence: null,
      recommendation: "Keep your IOC feed up to date.",
      created_at: now(),
    },
  ];
}
