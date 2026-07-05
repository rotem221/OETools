import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, FolderOpen, Trash2, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/toast-store";
import { formatDateTime } from "@/lib/utils";

export function ExportHistoryPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();

  const { data: history, isLoading } = useQuery({
    queryKey: ["export-history"],
    queryFn: async () => {
      const res = await api.listExportHistory();
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });

  const open = async (path: string | null) => {
    if (!path) return;
    await api.openExport(path);
  };

  const remove = async (id: string, kind: string) => {
    const res = await api.deleteExport(id, kind);
    if (res.success) {
      toast.success(t("exportsUi.deleted"));
      qc.invalidateQueries({ queryKey: ["export-history"] });
    } else {
      toast.error(t("toast.error"), res.error?.message);
    }
  };

  return (
    <>
      <PageHeader
        icon={<History className="h-5 w-5" />}
        title={t("modules.exportHistory.title")}
        description={t("modules.exportHistory.description")}
      />

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg bg-muted/40" />
      ) : !history || history.length === 0 ? (
        <EmptyState
          icon={<History className="h-6 w-6" />}
          title={t("exportsUi.none")}
          description={t("exportsUi.noneHint")}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {history.map((e) => (
                <div key={`${e.kind}-${e.id}`} className="flex items-center gap-3 p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    {e.evidence ? <ShieldCheck className="h-4 w-4" /> : <History className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium capitalize">{e.label}</span>
                      {e.evidence && <Badge variant="muted" className="text-[10px]">{t("exportsUi.evidenceBadge")}</Badge>}
                      {e.item_count != null && (
                        <span className="text-xs text-muted-foreground">· {e.item_count.toLocaleString()} {t("exportsUi.items")}</span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{e.output_path ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDateTime(e.created_at, i18n.language)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => open(e.output_path)} disabled={!e.output_path}>
                      <FolderOpen className="h-4 w-4" /> {t("exportsUi.open")}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(e.id, e.kind)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
