import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { DomainTabs, type DomainTab } from "@/components/layout/domain-tabs";
import { OnboardingPage } from "@/features/onboarding/onboarding-page";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { DeviceInfoPage } from "@/features/devices/device-info-page";
import { DevicesPage } from "@/features/devices/devices-page";
import { BackupsPage } from "@/features/backups/backups-page";
import { BackupTimelinePage } from "@/features/backups/backup-timeline-page";
import { ScheduledBackupsPage } from "@/features/backups/scheduled-backups-page";
import { BackupBrowserPage } from "@/features/backups/backup-browser-page";
import { MediaPage } from "@/features/media/media-page";
import { QuickTransferPage } from "@/features/transfer/quick-transfer-page";
import { FileBrowserPage } from "@/features/transfer/file-browser-page";
import { ConverterPage } from "@/features/transfer/converter-page";
import { MessagesPage } from "@/features/data-export/messages-page";
import { ContactsPage } from "@/features/data-export/contacts-page";
import { NotesPage } from "@/features/data-export/notes-page";
import { WhatsAppPage } from "@/features/data-export/whatsapp-page";
import { ExportAllPage } from "@/features/data-export/export-all-page";
import { DiagnosticsPage } from "@/features/diagnostics/diagnostics-page";
import { SecurityAnalyzerPage } from "@/features/security/security-analyzer-page";
import { LogsPage } from "@/features/security/logs-page";
import { ReportsPage } from "@/features/reports/reports-page";
import { EvidenceExportPage } from "@/features/reports/evidence-export-page";
import { ExportHistoryPage } from "@/features/reports/export-history-page";
import { AuthenticityPage } from "@/features/reports/authenticity-page";
import { ProfilesPage } from "@/features/business/profiles-page";
import { ProfileEditorPage } from "@/features/business/profile-editor-page";
import { SupervisionPage } from "@/features/business/supervision-page";
import { FleetPage } from "@/features/business/fleet-page";
import { PrivacyCenterPage } from "@/features/privacy/privacy-center-page";
import { SettingsPage } from "@/features/settings/settings-page";

const backupsTabs: DomainTab[] = [
  { to: "/backups", labelKey: "nav.backupManager", end: true },
  { to: "/backups/timeline", labelKey: "nav.backupTimeline" },
  { to: "/backups/scheduled", labelKey: "nav.scheduledBackups" },
  { to: "/backups/browser", labelKey: "nav.backupBrowser" },
];

const transferTabs: DomainTab[] = [
  { to: "/transfer", labelKey: "nav.mediaManager", end: true },
  { to: "/transfer/quick", labelKey: "nav.quickTransfer" },
  { to: "/transfer/files", labelKey: "nav.fileBrowser" },
  { to: "/transfer/converter", labelKey: "nav.converter" },
];

const exportTabs: DomainTab[] = [
  { to: "/export", labelKey: "nav.messages", end: true },
  { to: "/export/contacts", labelKey: "nav.contacts" },
  { to: "/export/notes", labelKey: "nav.notes" },
  { to: "/export/whatsapp", labelKey: "nav.whatsapp" },
  { to: "/export/all", labelKey: "nav.exportAll" },
];

const reportsTabs: DomainTab[] = [
  { to: "/reports", labelKey: "nav.deviceReports", end: true },
  { to: "/reports/authenticity", labelKey: "nav.authenticity" },
  { to: "/reports/evidence", labelKey: "nav.evidenceExport" },
  { to: "/reports/history", labelKey: "nav.exportHistory" },
];

const securityTabs: DomainTab[] = [
  { to: "/security", labelKey: "nav.diagnostics", end: true },
  { to: "/security/analyzer", labelKey: "nav.securityAnalyzer" },
  { to: "/security/logs", labelKey: "nav.logs" },
];

const businessTabs: DomainTab[] = [
  { to: "/business", labelKey: "nav.profiles", end: true },
  { to: "/business/profile-editor", labelKey: "nav.profileEditor" },
  { to: "/business/supervision", labelKey: "nav.supervision" },
  { to: "/business/fleet", labelKey: "nav.fleet" },
];

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="/device-info" element={<DeviceInfoPage />} />

        {/* Backups */}
        <Route path="/backups" element={<DomainTabs tabs={backupsTabs} />}>
          <Route index element={<BackupsPage />} />
          <Route path="timeline" element={<BackupTimelinePage />} />
          <Route path="scheduled" element={<ScheduledBackupsPage />} />
          <Route path="browser" element={<BackupBrowserPage />} />
        </Route>

        {/* Transfer */}
        <Route path="/transfer" element={<DomainTabs tabs={transferTabs} />}>
          <Route index element={<MediaPage />} />
          <Route path="quick" element={<QuickTransferPage />} />
          <Route path="files" element={<FileBrowserPage />} />
          <Route path="converter" element={<ConverterPage />} />
        </Route>

        {/* Data Export */}
        <Route path="/export" element={<DomainTabs tabs={exportTabs} />}>
          <Route index element={<MessagesPage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="whatsapp" element={<WhatsAppPage />} />
          <Route path="all" element={<ExportAllPage />} />
        </Route>

        {/* Reports */}
        <Route path="/reports" element={<DomainTabs tabs={reportsTabs} />}>
          <Route index element={<ReportsPage />} />
          <Route path="authenticity" element={<AuthenticityPage />} />
          <Route path="evidence" element={<EvidenceExportPage />} />
          <Route path="history" element={<ExportHistoryPage />} />
        </Route>

        {/* Security */}
        <Route path="/security" element={<DomainTabs tabs={securityTabs} />}>
          <Route index element={<DiagnosticsPage />} />
          <Route path="analyzer" element={<SecurityAnalyzerPage />} />
          <Route path="logs" element={<LogsPage />} />
        </Route>

        {/* Business */}
        <Route path="/business" element={<DomainTabs tabs={businessTabs} />}>
          <Route index element={<ProfilesPage />} />
          <Route path="profile-editor" element={<ProfileEditorPage />} />
          <Route path="supervision" element={<SupervisionPage />} />
          <Route path="fleet" element={<FleetPage />} />
        </Route>

        {/* Settings & Privacy */}
        <Route path="/privacy" element={<PrivacyCenterPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        {/* Back-compat redirects for older links */}
        <Route path="/media" element={<Navigate to="/transfer" replace />} />
        <Route path="/diagnostics" element={<Navigate to="/security" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
