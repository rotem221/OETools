import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  History,
  Shield,
  ShieldCheck,
  Clock,
  HardDrive,
  Lock,
  FolderOpen,
  Download,
  Pencil,
  Trash2,
  Sparkles,
  Settings2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DeviceGuard } from "@/components/layout/device-guard";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useAppStore } from "@/lib/store/app-store";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/toast-store";
import { formatBytes, formatDateTime, timeAgo } from "@/lib/utils";
import type { BackupSnapshot, RetentionPolicy } from "@/lib/db-types";

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineInner() {
  const { t, i18n } = useTranslation();
  const selectedUdid = useAppStore((s) => s.selectedUdid);
  const qc = useQueryClient();

  const [editing, setEditing] = useState<BackupSnapshot | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [retentionOpen, setRetentionOpen] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);

  const snapshotsQuery = useQuery({
    queryKey: ["snapshots", selectedUdid],
    enabled: !!selectedUdid,
    queryFn: async () => {
      const res = await api.listSnapshots(selectedUdid!);
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });

  const recommendationsQuery = useQuery({
    queryKey: ["cleanup-recommendations", selectedUdid],
    enabled: !!selectedUdid,
    queryFn: async () => {
      const res = await api.cleanupRecommendations(selectedUdid!);
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });

  const snapshots = snapshotsQuery.data ?? [];
  const recommendations = recommendationsQuery.data ?? [];

  const stats = useMemo(() => {
    const completed = snapshots.filter((s) => s.status === "completed");
    const totalBytes = completed.reduce((sum, s) => sum + (s.size_bytes ?? 0), 0);
    const protectedCount = snapshots.filter((s) => s.is_protected).length;
    const latest = completed[0] ?? null;
    const oldest = completed[completed.length - 1] ?? null;
    return { totalBytes, protectedCount, latest, oldest };
  }, [snapshots]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["snapshots", selectedUdid] });
    qc.invalidateQueries({ queryKey: ["cleanup-recommendations", selectedUdid] });
  };

  const toggleProtected = async (snap: BackupSnapshot) => {
    const res = await api.setSnapshotProtected(snap.id, !snap.is_protected);
    if (res.success) refresh();
    else toast.error(t("toast.error"), res.error?.message);
  };

  const openEdit = (snap: BackupSnapshot) => {
    setEditing(snap);
    setEditLabel(snap.snapshot_label ?? "");
    setEditNotes(snap.notes ?? "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    const res = await api.updateSnapshot(
      editing.id,
      editLabel || null,
      editNotes || null,
    );
    if (res.success) {
      setEditing(null);
      refresh();
    } else {
      toast.error(t("toast.error"), res.error?.message);
    }
  };

  const exportMetadata = async () => {
    const res = await api.exportSnapshotMetadata(selectedUdid ?? undefined);
    if (res.success && res.data) toast.success(t("timeline.exportMetadata"), res.data);
    else toast.error(t("toast.error"), res.error?.message);
  };

  const runCleanup = async () => {
    for (const snap of recommendations) {
      await api.deleteSnapshot(snap.id);
    }
    toast.success(t("timeline.runCleanup"));
    refresh();
  };

  return (
    <>
      <PageHeader
        icon={<History className="h-5 w-5" />}
        title={t("timeline.title")}
        description={t("timeline.subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setRetentionOpen(true)}>
              <Settings2 className="h-4 w-4" />
              {t("retention.title")}
            </Button>
            <Button variant="outline" size="sm" onClick={exportMetadata}>
              <Download className="h-4 w-4" />
              {t("timeline.exportMetadata")}
            </Button>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label={t("timeline.latest")}
          value={
            stats.latest
              ? timeAgo(stats.latest.created_at, i18n.language)
              : t("dashboard.neverBackedUp")
          }
        />
        <StatCard
          icon={<History className="h-5 w-5" />}
          label={t("timeline.oldest")}
          value={
            stats.oldest
              ? formatDateTime(stats.oldest.created_at, i18n.language)
              : "—"
          }
        />
        <StatCard
          icon={<ShieldCheck className="h-5 w-5" />}
          label={t("timeline.protected")}
          value={`${stats.protectedCount} / ${snapshots.length}`}
        />
        <StatCard
          icon={<HardDrive className="h-5 w-5" />}
          label={t("timeline.usedStorage")}
          value={formatBytes(stats.totalBytes)}
        />
      </div>

      {recommendations.length > 0 && (
        <Card className="mb-5 border-warning/40 bg-warning/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-warning-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {t("timeline.recommendationsTitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("timeline.cleanupBody")}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCleanupOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              {t("timeline.runCleanup")} ({recommendations.length})
            </Button>
          </CardContent>
        </Card>
      )}

      {snapshotsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : snapshots.length === 0 ? (
        <EmptyState
          icon={<History className="h-7 w-7" />}
          title={t("timeline.noSnapshots")}
          description={t("timeline.noSnapshotsHint")}
        />
      ) : (
        <div className="relative space-y-3 ps-4 before:absolute before:inset-y-2 before:start-1 before:w-px before:bg-border">
          {snapshots.map((snap) => (
            <SnapshotRow
              key={snap.id}
              snap={snap}
              locale={i18n.language}
              onToggleProtected={() => toggleProtected(snap)}
              onEdit={() => openEdit(snap)}
              onOpenFolder={() => api.openSnapshotFolder(snap.path)}
            />
          ))}
        </div>
      )}

      {/* Edit snapshot dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("timeline.editSnapshot")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("timeline.label")}</Label>
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder={t("timeline.labelPlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("timeline.notes")}</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder={t("timeline.notesPlaceholder")}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={saveEdit}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retention policy dialog */}
      <RetentionDialog
        open={retentionOpen}
        onOpenChange={setRetentionOpen}
        onSaved={refresh}
      />

      {/* Cleanup confirmation */}
      <ConfirmDialog
        open={cleanupOpen}
        onOpenChange={setCleanupOpen}
        title={t("timeline.cleanupTitle")}
        description={t("timeline.cleanupBody")}
        confirmLabel={t("timeline.runCleanup")}
        onConfirm={runCleanup}
      />
    </>
  );
}

function SnapshotRow({
  snap,
  locale,
  onToggleProtected,
  onEdit,
  onOpenFolder,
}: {
  snap: BackupSnapshot;
  locale: string;
  onToggleProtected: () => void;
  onEdit: () => void;
  onOpenFolder: () => void;
}) {
  const { t } = useTranslation();
  const sourceLabel =
    snap.source_type === "wifi"
      ? t("timeline.sourceWifi")
      : snap.source_type === "imported"
        ? t("timeline.sourceImported")
        : t("timeline.sourceUsb");

  return (
    <div className="relative rounded-xl border border-border bg-card p-4">
      <span
        className={`absolute -start-[13px] top-6 h-2.5 w-2.5 rounded-full ring-4 ring-background ${
          snap.is_protected ? "bg-success" : "bg-muted-foreground/50"
        }`}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">
              {snap.snapshot_label || formatDateTime(snap.created_at, locale)}
            </span>
            {snap.is_protected && (
              <Badge variant="success">
                <ShieldCheck className="h-3 w-3" />
                {t("timeline.protectedBadge")}
              </Badge>
            )}
            {snap.encrypted && (
              <Badge variant="muted">
                <Lock className="h-3 w-3" />
                {t("backups.encrypted")}
              </Badge>
            )}
            <Badge variant="outline">{sourceLabel}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDateTime(snap.created_at, locale)} · {formatBytes(snap.size_bytes ?? 0)}
            {snap.os_version ? ` · iOS ${snap.os_version}` : ""}
          </p>
          {snap.notes && (
            <p className="mt-1.5 text-xs text-muted-foreground/90">{snap.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" title={t("timeline.editSnapshot")} onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title={snap.is_protected ? t("timeline.unprotect") : t("timeline.protect")}
            onClick={onToggleProtected}
          >
            <Shield className={`h-4 w-4 ${snap.is_protected ? "text-success" : ""}`} />
          </Button>
          <Button variant="ghost" size="icon" title={t("timeline.openFolder")} onClick={onOpenFolder}>
            <FolderOpen className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function RetentionDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [policy, setPolicy] = useState<RetentionPolicy | null>(null);

  useQuery({
    queryKey: ["retention-policy", open],
    enabled: open,
    queryFn: async () => {
      const res = await api.getRetentionPolicy();
      if (res.success && res.data) setPolicy(res.data);
      return res.data ?? null;
    },
  });

  const update = (patch: Partial<RetentionPolicy>) =>
    setPolicy((p) => (p ? { ...p, ...patch } : p));

  const save = async () => {
    if (!policy) return;
    const res = await api.saveRetentionPolicy(policy);
    if (res.success) {
      toast.success(t("retention.saved"));
      onOpenChange(false);
      onSaved();
    } else {
      toast.error(t("toast.error"), res.error?.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("retention.title")}</DialogTitle>
        </DialogHeader>
        {policy && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">{t("retention.subtitle")}</p>
            <div className="grid grid-cols-3 gap-3">
              <NumberField
                label={t("retention.keepDaily")}
                value={policy.keep_daily_count}
                onChange={(v) => update({ keep_daily_count: v })}
              />
              <NumberField
                label={t("retention.keepWeekly")}
                value={policy.keep_weekly_count}
                onChange={(v) => update({ keep_weekly_count: v })}
              />
              <NumberField
                label={t("retention.keepMonthly")}
                value={policy.keep_monthly_count}
                onChange={(v) => update({ keep_monthly_count: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label className="text-sm">{t("retention.autoCleanup")}</Label>
              <Switch
                checked={policy.auto_cleanup_enabled}
                onCheckedChange={(v) => update({ auto_cleanup_enabled: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label className="text-sm">{t("retention.protectFirst")}</Label>
              <Switch
                checked={policy.protect_first_backup}
                onCheckedChange={(v) => update({ protect_first_backup: v })}
              />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save}>{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      />
    </div>
  );
}

export function BackupTimelinePage() {
  return (
    <DeviceGuard>
      <TimelineInner />
    </DeviceGuard>
  );
}
