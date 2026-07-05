import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Smartphone, Pencil } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/toast-store";
import type { DeviceAsset } from "@/lib/db-types";

export function FleetPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<DeviceAsset | null>(null);

  const { data: assets, isLoading } = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const res = await api.listAssets();
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });

  const save = async () => {
    if (!editing) return;
    const res = await api.saveAsset(editing);
    if (res.success) {
      toast.success(t("businessUi.saved"));
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["assets"] });
    } else {
      toast.error(t("toast.error"), res.error?.message);
    }
  };

  const field = (k: keyof DeviceAsset, v: string) =>
    setEditing((prev) => (prev ? { ...prev, [k]: v || null } : prev));

  return (
    <>
      <PageHeader
        icon={<Building2 className="h-5 w-5" />}
        title={t("modules.fleet.title")}
        description={t("modules.fleet.description")}
      />

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg bg-muted/40" />
      ) : !assets || assets.length === 0 ? (
        <EmptyState
          icon={<Smartphone className="h-6 w-6" />}
          title={t("businessUi.noDevices")}
          description={t("businessUi.noDevicesHint")}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {assets.map((a) => (
            <Card key={a.device_udid}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.device_name ?? a.device_udid}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.model ?? "—"} · {a.os_version ?? "—"}</p>
                  </div>
                  {a.asset_tag && <Badge variant="muted" className="shrink-0 text-[10px]">{a.asset_tag}</Badge>}
                </div>
                <dl className="space-y-1 text-xs">
                  <Row label={t("businessUi.employee")} value={a.employee_name} />
                  <Row label={t("businessUi.department")} value={a.department} />
                  <Row label={t("businessUi.location")} value={a.location} />
                  {a.notes && <Row label={t("businessUi.notes")} value={a.notes} />}
                </dl>
                <Button variant="outline" size="sm" className="w-full" onClick={() => setEditing(a)}>
                  <Pencil className="h-4 w-4" /> {t("businessUi.edit")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("businessUi.editAsset")}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <p className="text-sm font-medium">{editing.device_name ?? editing.device_udid}</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("businessUi.employee")} value={editing.employee_name} onChange={(v) => field("employee_name", v)} />
                <Field label={t("businessUi.department")} value={editing.department} onChange={(v) => field("department", v)} />
                <Field label={t("businessUi.location")} value={editing.location} onChange={(v) => field("location", v)} />
                <Field label={t("businessUi.assetTag")} value={editing.asset_tag} onChange={(v) => field("asset_tag", v)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("businessUi.notes")}</Label>
                <Textarea rows={2} value={editing.notes ?? ""} onChange={(e) => field("notes", e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={save}>{t("businessUi.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right">{value ?? "—"}</dd>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
