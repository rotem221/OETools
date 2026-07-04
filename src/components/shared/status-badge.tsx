import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { BackupStatus, JobStatus, TrustState } from "@/lib/db-types";

export function TrustBadge({ state }: { state: TrustState }) {
  const { t } = useTranslation();
  const variant =
    state === "trusted"
      ? "success"
      : state === "paired"
        ? "default"
        : state === "not_paired" || state === "untrusted"
          ? "warning"
          : "muted";
  return <Badge variant={variant}>{t(`trust.${state}`)}</Badge>;
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const { t } = useTranslation();
  const variant =
    status === "completed"
      ? "success"
      : status === "failed"
        ? "destructive"
        : status === "in_progress" || status === "queued"
          ? "default"
          : "muted";
  return <Badge variant={variant}>{t(`jobStatus.${status}`)}</Badge>;
}

export function BackupStatusBadge({ status }: { status: BackupStatus }) {
  const { t } = useTranslation();
  const variant =
    status === "completed"
      ? "success"
      : status === "failed"
        ? "destructive"
        : status === "in_progress"
          ? "default"
          : "muted";
  return <Badge variant={variant}>{t(`backupStatus.${status}`)}</Badge>;
}
