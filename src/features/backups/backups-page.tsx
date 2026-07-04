import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ShieldQuestion,
  FolderOpen,
  AlertTriangle,
  Lock,
  Info,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DeviceGuard } from "@/components/layout/device-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { BackupStatusBadge } from "@/components/shared/status-badge";
import { useBackups } from "./use-backups";
import { useAppStore } from "@/lib/store/app-store";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/toast-store";
import { formatBytes, formatDateTime } from "@/lib/utils";

function BackupsInner() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const selectedUdid = useAppStore((s) => s.selectedUdid);
  const upsertJob = useAppStore((s) => s.upsertJob);
  const setJobDrawerOpen = useAppStore((s) => s.setJobDrawerOpen);
  const settings = useAppStore((s) => s.settings);
  const { data: backups } = useBackups(selectedUdid ?? undefined);
  const [encrypted, setEncrypted] = useState(false);
  const [starting, setStarting] = useState(false);

  const startBackup = async () => {
    if (!selectedUdid) return;
    setStarting(true);
    const res = await api.createBackup(selectedUdid, encrypted);
    setStarting(false);
    if (res.success && res.data) {
      upsertJob(res.data);
      setJobDrawerOpen(true);
      toast.success(t("toast.backupStarted"));
      void qc.invalidateQueries({ queryKey: ["backups"] });
    } else {
      toast.error(t("toast.error"), res.error?.message);
    }
  };

  return (
    <>
      <PageHeader
        icon={<Archive className="h-5 w-5" />}
        title={t("backups.title")}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">{t("backups.createTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("backups.createBody")}
            </p>

            <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-warning-foreground shrink-0" />
              <p className="text-xs text-warning-foreground">
                {t("backups.warning")}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="enc" className="cursor-pointer">
                  {t("backups.encrypted")}
                </Label>
              </div>
              <Switch id="enc" checked={encrypted} onCheckedChange={setEncrypted} />
            </div>
            {encrypted && (
              <p className="text-xs text-muted-foreground">
                {t("backups.encryptedHint")}
              </p>
            )}

            <div className="text-xs text-muted-foreground">
              <span className="font-medium">{t("backups.path")}: </span>
              <span className="font-mono" dir="ltr">
                {settings?.backup_folder ?? "—"}
              </span>
            </div>

            <Button className="w-full" onClick={startBackup} disabled={starting}>
              <Archive className="h-4 w-4" />
              {t("backups.startBackup")}
            </Button>

            <div className="flex items-center gap-2 rounded-lg bg-muted/60 p-3">
              <Info className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                {t("backups.restoreDisabled")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("backups.history")}</CardTitle>
          </CardHeader>
          <CardContent>
            {!backups || backups.length === 0 ? (
              <EmptyState
                className="border-0"
                icon={<ShieldQuestion className="h-6 w-6" />}
                title={t("backups.noBackups")}
              />
            ) : (
              <div className="space-y-2">
                {backups.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {formatDateTime(b.completed_at ?? b.created_at, i18n.language)}
                        </span>
                        {b.encrypted && (
                          <Badge variant="secondary" className="gap-1">
                            <Lock className="h-3 w-3" />
                            {t("backups.encrypted")}
                          </Badge>
                        )}
                      </div>
                      <p className="truncate font-mono text-xs text-muted-foreground" dir="ltr">
                        {b.path}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm text-muted-foreground">
                        {formatBytes(b.size_bytes)}
                      </span>
                      <BackupStatusBadge status={b.status} />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => api.openBackupFolder(b.path)}
                      >
                        <FolderOpen className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export function BackupsPage() {
  return (
    <DeviceGuard>
      <BackupsInner />
    </DeviceGuard>
  );
}
