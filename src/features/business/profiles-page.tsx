import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollText, FileUp, Download, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/toast-store";
import { formatDateTime } from "@/lib/utils";

export function ProfilesPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const res = await api.listProfiles();
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });

  const importProfile = async () => {
    const picked = await api.selectFiles();
    if (!picked.success || !picked.data || picked.data.length === 0) return;
    for (const p of picked.data) {
      const res = await api.importProfile(p);
      if (!res.success) {
        toast.error(t("toast.error"), res.error?.message);
        return;
      }
    }
    toast.success(t("businessUi.imported"));
    qc.invalidateQueries({ queryKey: ["profiles"] });
  };

  const exportProfile = async (id: string) => {
    const dest = await api.selectFolder();
    if (!dest.success || !dest.data) return;
    const res = await api.exportProfile(id, dest.data);
    if (res.success && res.data) toast.success(t("businessUi.export"), res.data);
    else toast.error(t("toast.error"), res.error?.message);
  };

  const remove = async (id: string) => {
    const res = await api.deleteProfile(id);
    if (res.success) qc.invalidateQueries({ queryKey: ["profiles"] });
    else toast.error(t("toast.error"), res.error?.message);
  };

  return (
    <>
      <PageHeader
        icon={<ScrollText className="h-5 w-5" />}
        title={t("modules.profiles.title")}
        description={t("modules.profiles.description")}
        actions={
          <Button size="sm" onClick={importProfile}>
            <FileUp className="h-4 w-4" /> {t("businessUi.import")}
          </Button>
        }
      />

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg bg-muted/40" />
      ) : !profiles || profiles.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-6 w-6" />}
          title={t("businessUi.noProfiles")}
          description={t("businessUi.noProfilesHint")}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {profiles.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <ScrollText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{p.name ?? "—"}</span>
                      {p.profile_type && <Badge variant="muted" className="text-[10px]">{p.profile_type}</Badge>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {[p.organization, p.identifier].filter(Boolean).join(" · ") || "—"}
                    </p>
                    {p.installed_at && (
                      <p className="text-[10px] text-muted-foreground">
                        {t("businessUi.installed")}: {formatDateTime(p.installed_at, i18n.language)}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => exportProfile(p.id)}>
                      <Download className="h-4 w-4" /> {t("businessUi.export")}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(p.id)}>
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
