import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Clock,
  HeartPulse,
  Play,
  Save,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DeviceGuard } from "@/components/layout/device-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/lib/store/app-store";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/toast-store";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import type { ScheduledBackup, ScheduleType } from "@/lib/db-types";

const SCHEDULE_TYPES: ScheduleType[] = [
  "manual",
  "daily",
  "weekly",
  "on_connect",
  "on_start",
];

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

function emptySchedule(udid: string): ScheduledBackup {
  return {
    id: "",
    device_udid: udid,
    enabled: true,
    schedule_type: "on_connect",
    preferred_time: "02:00",
    weekdays_json: "[1,3,5]",
    destination_path: null,
    encrypted_preferred: true,
    last_run_at: null,
    next_run_at: null,
    last_status: null,
    created_at: "",
    updated_at: "",
  };
}

function ScheduledInner() {
  const { t, i18n } = useTranslation();
  const selectedUdid = useAppStore((s) => s.selectedUdid);
  const settings = useAppStore((s) => s.settings);
  const qc = useQueryClient();

  const [draft, setDraft] = useState<ScheduledBackup | null>(null);

  const schedulesQuery = useQuery({
    queryKey: ["schedules", selectedUdid],
    enabled: !!selectedUdid,
    queryFn: async () => {
      const res = await api.listSchedules(selectedUdid!);
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });

  const dueQuery = useQuery({
    queryKey: ["due-schedules"],
    queryFn: async () => {
      const res = await api.dueSchedules();
      return res.data ?? [];
    },
  });

  // Load the device's existing schedule into the editable draft.
  useEffect(() => {
    if (!selectedUdid) return;
    const existing = schedulesQuery.data?.[0];
    setDraft(existing ?? emptySchedule(selectedUdid));
  }, [schedulesQuery.data, selectedUdid]);

  const weekdays = useMemo<number[]>(() => {
    try {
      return JSON.parse(draft?.weekdays_json ?? "[]");
    } catch {
      return [];
    }
  }, [draft?.weekdays_json]);

  if (!draft) return null;

  const update = (patch: Partial<ScheduledBackup>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));

  const toggleWeekday = (day: number) => {
    const set = new Set(weekdays);
    set.has(day) ? set.delete(day) : set.add(day);
    update({ weekdays_json: JSON.stringify([...set].sort()) });
  };

  const save = async () => {
    const res = await api.saveSchedule({
      ...draft,
      destination_path:
        draft.destination_path || settings?.backup_folder || null,
    });
    if (res.success) {
      toast.success(t("scheduled.saved"));
      qc.invalidateQueries({ queryKey: ["schedules", selectedUdid] });
      qc.invalidateQueries({ queryKey: ["due-schedules"] });
    } else {
      toast.error(t("toast.error"), res.error?.message);
    }
  };

  const runNow = async () => {
    if (!selectedUdid) return;
    const res = await api.createBackup(selectedUdid, draft.encrypted_preferred);
    if (res.success && res.data) {
      useAppStore.getState().upsertJob(res.data);
      useAppStore.getState().setJobDrawerOpen(true);
      toast.success(t("toast.backupStarted"));
    } else {
      toast.error(t("toast.error"), res.error?.message);
    }
  };

  const health = computeHealth(draft);
  const isTimeBased = draft.schedule_type === "daily" || draft.schedule_type === "weekly";
  const isWeekly = draft.schedule_type === "weekly";
  const due = dueQuery.data ?? [];

  return (
    <>
      <PageHeader
        icon={<CalendarClock className="h-5 w-5" />}
        title={t("scheduled.title")}
        description={t("scheduled.subtitle")}
        actions={
          <Button size="sm" onClick={save}>
            <Save className="h-4 w-4" />
            {t("scheduled.save")}
          </Button>
        }
      />

      {due.length > 0 && (
        <Card className="mb-5 border-warning/40 bg-warning/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-warning-foreground" />
              <div>
                <p className="text-sm font-medium">{t("scheduled.dueTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("scheduled.dueBody")}</p>
              </div>
            </div>
            <Button size="sm" onClick={runNow}>
              <Play className="h-4 w-4" />
              {t("scheduled.runNow")}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">{t("scheduled.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label className="text-sm">{t("scheduled.enabled")}</Label>
              <Switch
                checked={draft.enabled}
                onCheckedChange={(v) => update({ enabled: v })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">{t("scheduled.type")}</Label>
              <Select
                value={draft.schedule_type}
                onValueChange={(v) => update({ schedule_type: v as ScheduleType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`scheduled.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isTimeBased && (
              <div className="space-y-1.5">
                <Label className="text-sm">{t("scheduled.preferredTime")}</Label>
                <Input
                  type="time"
                  value={draft.preferred_time ?? "02:00"}
                  onChange={(e) => update({ preferred_time: e.target.value })}
                  className="w-40"
                />
              </div>
            )}

            {isWeekly && (
              <div className="space-y-1.5">
                <Label className="text-sm">{t("scheduled.weekdays")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((day) => (
                    <button
                      key={day}
                      onClick={() => toggleWeekday(day)}
                      className={cn(
                        "h-8 w-10 rounded-md border text-xs font-medium transition-colors",
                        weekdays.includes(day)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-muted",
                      )}
                    >
                      {new Intl.DateTimeFormat(
                        i18n.language === "he" ? "he-IL" : "en-US",
                        { weekday: "short" },
                      ).format(new Date(2023, 0, 1 + day))}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-sm">{t("scheduled.destination")}</Label>
              <Input
                value={draft.destination_path ?? settings?.backup_folder ?? ""}
                onChange={(e) => update({ destination_path: e.target.value })}
                dir="ltr"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label className="text-sm">{t("scheduled.encryptedPreferred")}</Label>
              <Switch
                checked={draft.encrypted_preferred}
                onCheckedChange={(v) => update({ encrypted_preferred: v })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("scheduled.health")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  health === "healthy"
                    ? "bg-success/15 text-success"
                    : health === "missed"
                      ? "bg-warning/15 text-warning-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                <HeartPulse className="h-5 w-5" />
              </div>
              <Badge
                variant={
                  health === "healthy"
                    ? "success"
                    : health === "missed"
                      ? "warning"
                      : "muted"
                }
              >
                {t(`scheduled.${health === "never" ? "never" : health}`)}
              </Badge>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {t("scheduled.lastRun")}
                </span>
                <span>
                  {draft.last_run_at
                    ? timeAgo(draft.last_run_at, i18n.language)
                    : t("scheduled.never")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {t("scheduled.nextRun")}
                </span>
                <span>
                  {draft.next_run_at
                    ? formatDateTime(draft.next_run_at, i18n.language)
                    : "—"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function computeHealth(s: ScheduledBackup): "healthy" | "missed" | "never" {
  if (!s.last_run_at) return "never";
  if (s.next_run_at && new Date(s.next_run_at).getTime() < Date.now()) {
    return "missed";
  }
  return "healthy";
}

export function ScheduledBackupsPage() {
  return (
    <DeviceGuard>
      <ScheduledInner />
    </DeviceGuard>
  );
}
