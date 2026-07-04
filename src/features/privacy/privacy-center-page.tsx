import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  Lock,
  FolderOpen,
  Smartphone,
  Archive,
  FileText,
  ScrollText,
  Database,
  ShieldAlert,
  Download,
  Activity,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/toast-store";
import type { PrivacySummary } from "@/lib/db-types";

interface CategoryDef {
  key: string;
  category: string;
  icon: React.ReactNode;
  count: (s: PrivacySummary) => number;
}

const CATEGORIES: CategoryDef[] = [
  { key: "deviceData", category: "devices", icon: <Smartphone className="h-4 w-4" />, count: (s) => s.devices },
  { key: "backups", category: "backups", icon: <Archive className="h-4 w-4" />, count: (s) => s.backups + s.snapshots },
  { key: "reports", category: "reports", icon: <FileText className="h-4 w-4" />, count: (s) => s.reports },
  { key: "logs", category: "logs", icon: <ScrollText className="h-4 w-4" />, count: (s) => s.logs },
  { key: "indexes", category: "indexes", icon: <Database className="h-4 w-4" />, count: (s) => s.index_items },
  { key: "securityScans", category: "security", icon: <ShieldAlert className="h-4 w-4" />, count: (s) => s.security_scans },
  { key: "exportsData", category: "exports", icon: <Download className="h-4 w-4" />, count: (s) => s.data_exports },
  { key: "jobs", category: "jobs", icon: <Activity className="h-4 w-4" />, count: (s) => s.jobs },
];

export function PrivacyCenterPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [confirmCategory, setConfirmCategory] = useState<string | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const summaryQuery = useQuery({
    queryKey: ["privacy-summary"],
    queryFn: async () => {
      const res = await api.getPrivacySummary();
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });

  const summary = summaryQuery.data;

  const refresh = () => qc.invalidateQueries({ queryKey: ["privacy-summary"] });

  const deleteCategory = async (category: string) => {
    const res = await api.deletePrivacyCategory(category);
    if (res.success) {
      toast.success(t("privacy.deleted"));
      refresh();
    } else {
      toast.error(t("toast.error"), res.error?.message);
    }
  };

  const deleteAll = async () => {
    const res = await api.factoryResetApp();
    if (res.success) {
      toast.success(t("privacy.deleted"));
      setDeleteAllOpen(false);
      setTyped("");
      refresh();
    } else {
      toast.error(t("toast.error"), res.error?.message);
    }
  };

  return (
    <>
      <PageHeader
        icon={<ShieldCheck className="h-5 w-5" />}
        title={t("privacy.title")}
        description={t("privacy.subtitle")}
        actions={
          <div className="flex items-center gap-2">
            {summary?.local_only && (
              <Badge variant="success">
                <Lock className="h-3.5 w-3.5" />
                {t("privacy.localOnlyBadge")}
              </Badge>
            )}
            {summary && !summary.telemetry_enabled && (
              <Badge variant="muted">{t("privacy.telemetryOff")}</Badge>
            )}
          </div>
        }
      />

      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              {t("privacy.storageLocation")}
            </p>
            <p className="truncate font-mono text-sm" dir="ltr">
              {summary?.app_data_dir ?? "—"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => api.openAppDataFolder()}
          >
            <FolderOpen className="h-4 w-4" />
            {t("privacy.openFolder")}
          </Button>
        </CardContent>
      </Card>

      <h2 className="mb-3 text-sm font-medium text-muted-foreground">
        {t("privacy.storedTitle")}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map((cat) => {
          const count = summary ? cat.count(summary) : 0;
          return (
            <Card key={cat.key}>
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    {cat.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t(`privacy.${cat.key}`)}</p>
                    <p className="text-xs text-muted-foreground">
                      {count} {t("privacy.items")}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={count === 0}
                  onClick={() => setConfirmCategory(cat.category)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("privacy.delete")}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 border-destructive/40">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-destructive">
              {t("privacy.deleteAllTitle")}
            </p>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">
              {t("privacy.deleteAllBody")}
            </p>
          </div>
          <Button variant="destructive" onClick={() => setDeleteAllOpen(true)}>
            <Trash2 className="h-4 w-4" />
            {t("privacy.deleteAllAction")}
          </Button>
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        {t("privacy.telemetryNote")}
      </p>

      <ConfirmDialog
        open={!!confirmCategory}
        onOpenChange={(o) => !o && setConfirmCategory(null)}
        title={t("privacy.deleteAllTitle")}
        description={t("confirm.destructiveHint")}
        confirmLabel={t("privacy.delete")}
        onConfirm={() => confirmCategory && deleteCategory(confirmCategory)}
      />

      <Dialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              {t("privacy.deleteAllTitle")}
            </DialogTitle>
            <DialogDescription>{t("privacy.deleteAllBody")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>{t("privacy.deleteAllConfirm")}</Label>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="DELETE"
              dir="ltr"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteAllOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={typed !== "DELETE"}
              onClick={deleteAll}
            >
              {t("privacy.deleteAllAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
