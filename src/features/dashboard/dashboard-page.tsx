import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  BatteryMedium,
  HardDrive,
  Smartphone,
  Tablet,
  Archive,
  Images,
  FileText,
  Stethoscope,
  Settings as SettingsIcon,
  RefreshCw,
  Cpu,
  Heart,
  RotateCw,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DeviceGuard } from "@/components/layout/device-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrustBadge } from "@/components/shared/status-badge";
import { StorageDonut } from "@/components/charts/storage-donut";
import { useAppStore } from "@/lib/store/app-store";
import { useDeviceInfo } from "@/features/devices/use-devices";
import { useBackups } from "@/features/backups/use-backups";
import { formatBytes, timeAgo } from "@/lib/utils";

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        {icon}
      </div>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function DashboardInner() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const selectedUdid = useAppStore((s) => s.selectedUdid);
  const { data: info, isLoading, refetch, isFetching } = useDeviceInfo(selectedUdid);
  const { data: backups } = useBackups(selectedUdid ?? undefined);

  const lastBackup = useMemo(
    () => backups?.find((b) => b.status === "completed") ?? null,
    [backups],
  );

  if (isLoading || !info) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-xl border border-border bg-card"
          />
        ))}
      </div>
    );
  }

  const KindIcon = info.kind === "ipad" ? Tablet : Smartphone;
  const battery = info.battery;
  const storage = info.storage;

  return (
    <>
      <PageHeader
        icon={<LayoutDashboard className="h-5 w-5" />}
        title={t("dashboard.title")}
        description={info.name}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={isFetching ? "animate-spin" : ""} />
            {t("common.refresh")}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Summary card */}
        <Card className="lg:col-span-3">
          <CardContent className="flex flex-wrap items-center gap-5 p-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <KindIcon className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold truncate">{info.name}</h2>
                <TrustBadge state={info.trust_state} />
                <Badge
                  variant={
                    info.connection_state === "connected" ? "success" : "muted"
                  }
                >
                  {t(`topbar.${info.connection_state}`)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {info.model} · iOS {info.os_version}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">UDID</p>
                <p className="font-mono text-xs truncate max-w-[160px]" dir="ltr">
                  {info.udid}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("deviceInfo.fields.serialNumber")}
                </p>
                <p className="font-mono text-xs" dir="ltr">
                  {info.serial_number}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("deviceInfo.fields.activationState")}
                </p>
                <p className="text-xs">{info.activation_state ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Battery */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">{t("dashboard.battery")}</CardTitle>
            <BatteryMedium className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-2">
              <span className="text-3xl font-semibold">
                {battery.level_percent ?? "—"}
                {battery.level_percent != null && (
                  <span className="text-lg text-muted-foreground">%</span>
                )}
              </span>
            </div>
            <Progress
              value={battery.level_percent ?? 0}
              indicatorClassName={
                (battery.level_percent ?? 0) < 20
                  ? "bg-destructive"
                  : "bg-success"
              }
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" />
                {t("dashboard.batteryHealth")}: {battery.health_percent ?? "—"}%
              </span>
              <span className="flex items-center gap-1">
                <RotateCw className="h-3 w-3" />
                {t("dashboard.cycles")}: {battery.cycle_count ?? "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Storage */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">{t("dashboard.storage")}</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <StorageDonut storage={storage} />
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.used")}
                </p>
                <p className="font-medium">{formatBytes(storage.used_bytes)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.free")}
                </p>
                <p className="font-medium">{formatBytes(storage.free_bytes)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.total")}
                </p>
                <p className="font-medium">{formatBytes(storage.total_bytes)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* OS + backup */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">{t("dashboard.osVersion")}</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-3xl font-semibold">{info.os_version}</span>
              <p className="text-xs text-muted-foreground">
                Build {info.build_version ?? "—"} · {info.cpu_architecture}
              </p>
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <p className="text-xs text-muted-foreground">
                {t("dashboard.lastBackup")}
              </p>
              <p className="text-sm font-medium">
                {lastBackup
                  ? timeAgo(lastBackup.completed_at, i18n.language)
                  : t("dashboard.neverBackedUp")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="mt-6">
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
          {t("dashboard.quickActions")}
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <QuickAction
            icon={<Archive className="h-5 w-5" />}
            label={t("dashboard.createBackup")}
            onClick={() => navigate("/backups")}
          />
          <QuickAction
            icon={<Images className="h-5 w-5" />}
            label={t("dashboard.exportPhotos")}
            onClick={() => navigate("/transfer")}
          />
          <QuickAction
            icon={<FileText className="h-5 w-5" />}
            label={t("dashboard.generateReport")}
            onClick={() => navigate("/reports")}
          />
          <QuickAction
            icon={<Stethoscope className="h-5 w-5" />}
            label={t("dashboard.viewLogs")}
            onClick={() => navigate("/security/logs")}
          />
          <QuickAction
            icon={<SettingsIcon className="h-5 w-5" />}
            label={t("dashboard.openSettings")}
            onClick={() => navigate("/settings")}
          />
        </div>
      </div>
    </>
  );
}

export function DashboardPage() {
  return (
    <DeviceGuard>
      <DashboardInner />
    </DeviceGuard>
  );
}
