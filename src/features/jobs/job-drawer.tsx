import { useTranslation } from "react-i18next";
import {
  Archive,
  Images,
  FileText,
  Stethoscope,
  ScanLine,
  PackageSearch,
  FileAudio,
  FolderInput,
  MessageSquare,
  ShieldAlert,
  X,
  Ban,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/shared/empty-state";
import { JobStatusBadge } from "@/components/shared/status-badge";
import { useAppStore } from "@/lib/store/app-store";
import { api } from "@/lib/api/client";
import { timeAgo } from "@/lib/utils";
import type { Job, JobType } from "@/lib/db-types";
import { cn } from "@/lib/utils";

const jobIcons: Record<JobType, typeof Archive> = {
  backup_create: Archive,
  media_export: Images,
  report_generate: FileText,
  log_collect: Stethoscope,
  device_scan: ScanLine,
  dependency_check: PackageSearch,
  media_convert: FileAudio,
  backup_extract: FolderInput,
  message_export: MessageSquare,
  security_scan: ShieldAlert,
};

function JobItem({ job }: { job: Job }) {
  const { t, i18n } = useTranslation();
  const upsertJob = useAppStore((s) => s.upsertJob);
  const Icon = jobIcons[job.job_type];
  const active = job.status === "in_progress" || job.status === "queued";
  // A live stream (e.g. syslog) has no finite progress — show a "Live"
  // indicator instead of a bar frozen at 0%.
  const streaming = active && job.job_type === "log_collect" && job.cancellable;

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg",
            active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">{job.title}</p>
            <JobStatusBadge status={job.status} />
          </div>
          <p className="text-xs text-muted-foreground">
            {t(`jobs.types.${job.job_type}`)} ·{" "}
            {timeAgo(job.created_at, i18n.language)}
          </p>
          {active && (
            <div className="mt-2">
              {streaming ? (
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full w-full animate-pulse rounded-full bg-primary/70" />
                </div>
              ) : (
                <Progress value={job.progress} />
              )}
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  {streaming ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                      {t("jobs.live")}
                    </span>
                  ) : (
                    `${job.progress}%`
                  )}
                </span>
                {job.cancellable && (
                  <button
                    className="inline-flex items-center gap-1 text-[11px] text-destructive hover:underline"
                    onClick={async () => {
                      await api.cancelJob(job.id);
                      upsertJob({ ...job, status: "cancelled" });
                    }}
                  >
                    <Ban className="h-3 w-3" />
                    {t("common.cancel")}
                  </button>
                )}
              </div>
            </div>
          )}
          {job.error_message && (
            <p className="mt-1.5 text-xs text-destructive break-words">
              {job.error_message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function JobDrawer() {
  const { t } = useTranslation();
  const open = useAppStore((s) => s.jobDrawerOpen);
  const setOpen = useAppStore((s) => s.setJobDrawerOpen);
  const jobs = useAppStore((s) => s.jobs);
  const setJobs = useAppStore((s) => s.setJobs);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={() => setOpen(false)}
      />
      <div className="fixed end-0 top-0 z-50 flex h-full w-[360px] flex-col border-s border-border bg-background shadow-xl animate-slide-in-right">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <h2 className="text-sm font-semibold">{t("jobs.title")}</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={t("jobs.clearCompleted")}
              onClick={async () => {
                await api.clearCompletedJobs();
                setJobs(
                  jobs.filter(
                    (j) =>
                      j.status === "in_progress" || j.status === "queued",
                  ),
                );
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-2 p-3">
            {jobs.length === 0 ? (
              <EmptyState
                className="border-0 py-10"
                icon={<PackageSearch className="h-6 w-6" />}
                title={t("jobs.empty")}
              />
            ) : (
              jobs.map((j) => <JobItem key={j.id} job={j} />)
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
