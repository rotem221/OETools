import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  ShieldQuestion,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DeviceGuard } from "@/components/layout/device-guard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store/app-store";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const STATUS_META: Record<string, { icon: typeof Info; className: string }> = {
  pass: { icon: CheckCircle2, className: "text-success" },
  warn: { icon: AlertTriangle, className: "text-warning-foreground" },
  fail: { icon: XCircle, className: "text-destructive" },
  info: { icon: Info, className: "text-muted-foreground" },
};

function AuthenticityInner() {
  const { t } = useTranslation();
  const selectedUdid = useAppStore((s) => s.selectedUdid);

  const { data: report, isLoading } = useQuery({
    queryKey: ["authenticity", selectedUdid],
    enabled: !!selectedUdid,
    queryFn: async () => {
      const res = await api.authenticityReport(selectedUdid!);
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });

  if (isLoading || !report) {
    return <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />;
  }

  const verdictStyle =
    report.verdict === "genuine"
      ? "bg-success/15 text-success"
      : report.verdict === "review"
        ? "bg-warning/15 text-warning-foreground"
        : "bg-muted text-muted-foreground";

  return (
    <>
      <PageHeader
        icon={<BadgeCheck className="h-5 w-5" />}
        title={t("authenticity.title")}
        description={report.name}
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
        <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{t("authenticity.disclaimer")}</p>
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("authenticity.verdict")}</p>
            <div className="mt-1 flex items-center gap-3">
              <Badge className={cn("px-3 py-1 text-sm capitalize", verdictStyle)}>
                {t(`authenticity.verdicts.${report.verdict}`)}
              </Badge>
              <span className="text-sm text-muted-foreground">{report.model}</span>
            </div>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">{t("dashboard.batteryHealth")}</p>
              <p className="font-medium">{report.battery_health != null ? `${report.battery_health}%` : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("dashboard.cycles")}</p>
              <p className="font-medium">{report.cycle_count ?? "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {report.checks.map((c) => {
          const meta = STATUS_META[c.status] ?? STATUS_META.info;
          const Icon = meta.icon;
          return (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              <Icon className={cn("h-5 w-5 shrink-0", meta.className)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{c.label}</p>
                <p className="truncate text-xs text-muted-foreground">{c.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function AuthenticityPage() {
  return (
    <DeviceGuard>
      <AuthenticityInner />
    </DeviceGuard>
  );
}
