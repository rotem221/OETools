import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { FolderSearch, HardDriveDownload, Lock, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/toast-store";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { BackupSourceInfo } from "@/lib/db-types";

/**
 * Lists auto-detected local iOS backups and lets the user pick a custom folder.
 * Shared by the Backup Browser, Messages, and Security Analyzer.
 */
export function BackupSourcePicker({
  selected,
  onSelect,
}: {
  selected: BackupSourceInfo | null;
  onSelect: (source: BackupSourceInfo | null) => void;
}) {
  const { t, i18n } = useTranslation();
  const [browsing, setBrowsing] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["backup-sources"],
    queryFn: async () => {
      const res = await api.detectBackups();
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });

  const browse = async () => {
    setBrowsing(true);
    const picked = await api.selectFolder();
    if (picked.success && picked.data) {
      const res = await api.openBackupSource(picked.data);
      if (res.success && res.data) {
        onSelect(res.data);
      } else {
        toast.error(t("toast.error"), res.error?.message);
      }
    }
    setBrowsing(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{t("backupBrowser.sources")}</p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
          <Button variant="outline" size="sm" onClick={browse} disabled={browsing}>
            <FolderSearch className="h-4 w-4" />
            {t("backupBrowser.browse")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-xl border border-border bg-card" />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<HardDriveDownload className="h-6 w-6" />}
          title={t("backupBrowser.noSources")}
          description={t("backupBrowser.noSourcesHint")}
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {data.map((s) => {
            const isSel = selected?.path === s.path;
            return (
              <Card
                key={s.path}
                className={cn(
                  "cursor-pointer transition-colors hover:border-primary/60",
                  isSel && "border-primary ring-1 ring-primary",
                )}
                onClick={() => onSelect(s)}
              >
                <CardContent className="space-y-1 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {s.device_name ?? t("backupBrowser.unknownDevice")}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      {s.encrypted && (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="h-3 w-3" />
                        </Badge>
                      )}
                      <Badge variant="muted">{s.source_label}</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {s.product_type ?? "—"} · {s.product_version ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.last_backup_date
                      ? formatDateTime(s.last_backup_date, i18n.language)
                      : "—"}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
