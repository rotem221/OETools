import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Settings as SettingsIcon,
  FolderOpen,
  RefreshCw,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import { CopyButton } from "@/components/shared/copy-button";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useAppStore } from "@/lib/store/app-store";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/toast-store";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { AppSettings, Language, ThemeMode } from "@/lib/db-types";
import { AboutSection } from "@/features/about/about-page";

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border/60 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function FolderInput({
  label,
  value,
  onPick,
}: {
  label: string;
  value: string;
  onPick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input value={value} readOnly className="font-mono text-xs" dir="ltr" />
        <Button variant="outline" size="sm" onClick={onPick} className="shrink-0">
          <FolderOpen className="h-4 w-4" />
          {t("common.browse")}
        </Button>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") === "about" ? "about" : "general";

  const { data: deps, refetch, isFetching } = useQuery({
    queryKey: ["dependencies"],
    queryFn: async () => {
      const res = await api.runDependencyCheck();
      if (!res.success || !res.data) throw new Error();
      return res.data;
    },
  });

  if (!settings) return null;

  const save = async (patch: Partial<AppSettings>) => {
    await updateSettings(patch);
    toast.success(t("toast.settingsSaved"));
  };

  const pickFolder = async (key: keyof AppSettings) => {
    const res = await api.selectFolder();
    if (res.data) await save({ [key]: res.data } as Partial<AppSettings>);
  };

  const detected = deps?.filter((d) => d.detected) ?? [];
  const missingRequired =
    deps?.filter((d) => !d.detected && !d.optional) ?? [];
  const realReady = missingRequired.length === 0 && (deps?.length ?? 0) > 0;

  return (
    <>
      <PageHeader
        icon={<SettingsIcon className="h-5 w-5" />}
        title={t("settings.title")}
      />

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="general">{t("settings.general")}</TabsTrigger>
          <TabsTrigger value="storage">{t("settings.storage")}</TabsTrigger>
          <TabsTrigger value="privacy">{t("settings.privacy")}</TabsTrigger>
          <TabsTrigger value="dependencies">{t("settings.dependencies")}</TabsTrigger>
          <TabsTrigger value="advanced">{t("settings.advanced")}</TabsTrigger>
          <TabsTrigger value="about">{t("about.title")}</TabsTrigger>
        </TabsList>

        {/* GENERAL */}
        <TabsContent value="general">
          <Card>
            <CardContent className="pt-5">
              <SettingRow label={t("settings.language")}>
                <Select
                  value={settings.language}
                  onValueChange={(v) => save({ language: v as Language })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="he">עברית</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
              <SettingRow label={t("settings.theme")}>
                <Select
                  value={settings.theme}
                  onValueChange={(v) => save({ theme: v as ThemeMode })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">{t("settings.themeLight")}</SelectItem>
                    <SelectItem value="dark">{t("settings.themeDark")}</SelectItem>
                    <SelectItem value="system">{t("settings.themeSystem")}</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
              <SettingRow label={t("settings.startupBehavior")}>
                <Select
                  value={settings.startup_behavior}
                  onValueChange={(v) =>
                    save({ startup_behavior: v as AppSettings["startup_behavior"] })
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dashboard">{t("settings.startupDashboard")}</SelectItem>
                    <SelectItem value="last_view">{t("settings.startupLastView")}</SelectItem>
                    <SelectItem value="devices">{t("settings.startupDevices")}</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
              <SettingRow
                label={t("settings.mockMode")}
                hint={t("settings.mockModeHint")}
              >
                <Switch
                  checked={settings.mock_mode}
                  onCheckedChange={(v) => save({ mock_mode: v })}
                />
              </SettingRow>
            </CardContent>
          </Card>
        </TabsContent>

        {/* STORAGE */}
        <TabsContent value="storage">
          <Card>
            <CardContent className="space-y-4 pt-5">
              <FolderInput
                label={t("settings.backupFolder")}
                value={settings.backup_folder}
                onPick={() => pickFolder("backup_folder")}
              />
              <FolderInput
                label={t("settings.exportFolder")}
                value={settings.export_folder}
                onPick={() => pickFolder("export_folder")}
              />
              <FolderInput
                label={t("settings.reportsFolder")}
                value={settings.reports_folder}
                onPick={() => pickFolder("reports_folder")}
              />
              <FolderInput
                label={t("settings.logsFolder")}
                value={settings.logs_folder}
                onPick={() => pickFolder("logs_folder")}
              />
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => api.openAppDataFolder()}>
                  <FolderOpen className="h-4 w-4" />
                  {t("settings.openDataFolder")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRIVACY */}
        <TabsContent value="privacy">
          <Card>
            <CardContent className="pt-5">
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3">
                <ShieldCheck className="h-4 w-4 text-success shrink-0" />
                <p className="text-xs text-success">{t("app.tagline")}</p>
              </div>
              <SettingRow
                label={t("settings.localOnly")}
                hint={t("settings.localOnlyHint")}
              >
                <Switch checked disabled />
              </SettingRow>
              <SettingRow
                label={t("settings.telemetry")}
                hint={t("settings.telemetryHint")}
              >
                <Switch checked={false} disabled />
              </SettingRow>
              <SettingRow label={t("settings.retention")}>
                <Input
                  type="number"
                  className="w-24"
                  value={settings.data_retention_days}
                  onChange={(e) =>
                    save({ data_retention_days: Number(e.target.value) || 0 })
                  }
                />
              </SettingRow>
              <div className="flex flex-wrap gap-2 pt-4">
                <Button variant="outline" onClick={() => api.clearAppHistory()}>
                  <Trash2 className="h-4 w-4" />
                  {t("settings.clearHistory")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  {t("settings.deleteDevices")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DEPENDENCIES */}
        <TabsContent value="dependencies">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{t("settings.dependencies")}</CardTitle>
                <CardDescription>{t("onboarding.dependenciesBody")}</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={isFetching ? "animate-spin" : ""} />
                {t("settings.recheck")}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {(deps ?? []).map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {d.detected ? (
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    ) : d.optional ? (
                      <MinusCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-warning-foreground shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium font-mono">{d.name}</p>
                      {d.detected && d.path ? (
                        <p className="text-xs text-muted-foreground font-mono truncate" dir="ltr">
                          {d.path}
                        </p>
                      ) : (
                        !d.detected && (
                          <p className="text-xs text-muted-foreground font-mono truncate" dir="ltr">
                            {d.install_hint}
                          </p>
                        )
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!d.detected && <CopyButton value={d.install_hint} />}
                    {d.detected ? (
                      <Badge variant="success">
                        {d.version ?? t("common.enabled")}
                      </Badge>
                    ) : d.optional ? (
                      <Badge variant="muted">{t("settings.optionalTool")}</Badge>
                    ) : (
                      <Badge variant="warning">{t("settings.missingTools")}</Badge>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-4 pt-2 text-xs text-muted-foreground">
                <span>{t("settings.detectedTools")}: {detected.length}</span>
                <span>{t("settings.missingRequired")}: {missingRequired.length}</span>
                {realReady ? (
                  <span className="flex items-center gap-1 text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t("settings.realReady")}
                  </span>
                ) : (
                  <span className="text-warning-foreground">
                    {t("settings.realNotReady")}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ADVANCED */}
        <TabsContent value="advanced">
          <Card>
            <CardContent className="pt-5">
              <SettingRow label={t("settings.experimental")}>
                <Switch
                  checked={settings.experimental_modules}
                  onCheckedChange={(v) => save({ experimental_modules: v })}
                />
              </SettingRow>
              <SettingRow label={t("settings.detailedLogs")}>
                <Switch
                  checked={settings.detailed_command_logs}
                  onCheckedChange={(v) => save({ detailed_command_logs: v })}
                />
              </SettingRow>
            </CardContent>
          </Card>

          <Card className="mt-4 border-destructive/40">
            <CardHeader>
              <CardTitle className="text-base text-destructive">
                {t("settings.dangerZone")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setConfirmReset(true)}>
                {t("settings.resetSettings")}
              </Button>
              <Button variant="outline" onClick={() => api.exportLogs("~/OETools/exports")}>
                {t("settings.exportDiagnostics")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABOUT */}
        <TabsContent value="about">
          <AboutSection />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={t("settings.resetSettings")}
        onConfirm={async () => {
          await api.resetSettings();
          await useAppStore.getState().loadSettings();
          toast.success(t("toast.settingsSaved"));
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("settings.deleteDevices")}
        onConfirm={async () => {
          await api.deleteKnownDevices();
          toast.success(t("toast.settingsSaved"));
        }}
      />
    </>
  );
}
