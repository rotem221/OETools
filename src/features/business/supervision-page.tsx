import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, RefreshCw, Smartphone, Check } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/toast-store";
import { formatDateTime } from "@/lib/utils";

export function SupervisionPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [orgEdits, setOrgEdits] = useState<Record<string, string>>({});

  const { data: devices, isLoading } = useQuery({
    queryKey: ["supervision"],
    queryFn: async () => {
      const res = await api.listSupervision();
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });

  const refresh = async (udid: string) => {
    const res = await api.refreshSupervision(udid);
    if (res.success) qc.invalidateQueries({ queryKey: ["supervision"] });
    else toast.error(t("toast.error"), res.error?.message);
  };

  const saveOrg = async (udid: string) => {
    const value = orgEdits[udid] ?? "";
    const res = await api.setSupervisionOrg(udid, value || null);
    if (res.success) {
      toast.success(t("businessUi.saved"));
      qc.invalidateQueries({ queryKey: ["supervision"] });
    } else {
      toast.error(t("toast.error"), res.error?.message);
    }
  };

  return (
    <>
      <PageHeader
        icon={<ShieldCheck className="h-5 w-5" />}
        title={t("modules.supervision.title")}
        description={t("modules.supervision.description")}
      />

      <div className="mb-4 flex items-start gap-3 rounded-xl border border-border bg-card p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs leading-relaxed text-muted-foreground">{t("businessUi.supervisionNote")}</p>
      </div>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg bg-muted/40" />
      ) : !devices || devices.length === 0 ? (
        <EmptyState
          icon={<Smartphone className="h-6 w-6" />}
          title={t("businessUi.noDevices")}
          description={t("businessUi.noDevicesHint")}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {devices.map((d) => (
            <Card key={d.udid}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{d.device_name ?? d.udid}</span>
                  </div>
                  <Badge variant={d.supervised ? "success" : "muted"}>
                    {d.supervised ? t("businessUi.supervised") : t("businessUi.unsupervised")}
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">{t("businessUi.organization")}</label>
                  <div className="flex gap-2">
                    <Input
                      value={orgEdits[d.udid] ?? d.organization_name ?? ""}
                      onChange={(e) => setOrgEdits((p) => ({ ...p, [d.udid]: e.target.value }))}
                      placeholder="—"
                    />
                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => saveOrg(d.udid)}>
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {d.last_checked_at ? `${t("businessUi.lastChecked")}: ${formatDateTime(d.last_checked_at, i18n.language)}` : ""}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => refresh(d.udid)}>
                    <RefreshCw className="h-4 w-4" /> {t("businessUi.refresh")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
