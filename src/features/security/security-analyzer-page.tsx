import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldAlert,
  ShieldCheck,
  ScanSearch,
  AlertTriangle,
  Info,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { BackupSourcePicker } from "@/features/backups/backup-source-picker";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/toast-store";
import { cn } from "@/lib/utils";
import type { BackupSourceInfo, SecurityScan } from "@/lib/db-types";

const SEVERITY_STYLES: Record<string, { badge: string; icon: typeof Info }> = {
  high: { badge: "bg-destructive/15 text-destructive border-destructive/30", icon: AlertTriangle },
  medium: { badge: "bg-warning/15 text-warning-foreground border-warning/30", icon: AlertTriangle },
  low: { badge: "bg-muted text-muted-foreground border-border", icon: Info },
  info: { badge: "bg-accent text-accent-foreground border-border", icon: Info },
};

export function SecurityAnalyzerPage() {
  const { t } = useTranslation();
  const [source, setSource] = useState<BackupSourceInfo | null>(null);
  const [scan, setScan] = useState<SecurityScan | null>(null);
  const [scanning, setScanning] = useState(false);

  const { data: findings } = useQuery({
    queryKey: ["scan-findings", scan?.id],
    enabled: !!scan,
    queryFn: async () => {
      const res = await api.getScanFindings(scan!.id);
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });

  const runScan = async () => {
    if (!source) return;
    setScanning(true);
    setScan(null);
    const res = await api.runSecurityScan(source.path);
    setScanning(false);
    if (res.success && res.data) {
      setScan(res.data);
      toast.success(t("securityAnalyzer.scanComplete"));
    } else {
      toast.error(t("toast.error"), res.error?.message);
    }
  };

  const risk = scan?.risk_level ?? "clean";
  const highRisk = risk === "high" || risk === "medium";

  return (
    <>
      <PageHeader
        icon={<ShieldAlert className="h-5 w-5" />}
        title={t("modules.securityAnalyzer.title")}
        description={t("modules.securityAnalyzer.description")}
        actions={<Badge variant="warning">{t("comingSoon.experimental")}</Badge>}
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        <p className="text-xs text-muted-foreground">{t("securityAnalyzer.disclaimer")}</p>
      </div>

      <div className="mb-4">
        <BackupSourcePicker selected={source} onSelect={(s) => { setSource(s); setScan(null); }} />
      </div>

      {source && (
        <div className="mb-4 flex items-center gap-3">
          <Button onClick={runScan} disabled={scanning}>
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
            {t("securityAnalyzer.runScan")}
          </Button>
          {scan && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t("securityAnalyzer.riskLevel")}:</span>
              <Badge
                className={cn(
                  "capitalize",
                  highRisk ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success",
                )}
              >
                {risk}
              </Badge>
            </div>
          )}
        </div>
      )}

      {scan && findings && (
        findings.length === 0 ? (
          <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title={t("securityAnalyzer.clean")} />
        ) : (
          <div className="space-y-3">
            {findings.map((f) => {
              const style = SEVERITY_STYLES[f.severity] ?? SEVERITY_STYLES.info;
              const Icon = style.icon;
              return (
                <Card key={f.id}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="text-sm font-medium">{f.title}</span>
                      </div>
                      <Badge className={cn("border capitalize", style.badge)}>{f.severity}</Badge>
                    </div>
                    {f.description && (
                      <p className="text-sm text-muted-foreground">{f.description}</p>
                    )}
                    {f.evidence && (
                      <pre className="overflow-x-auto rounded-lg bg-muted/60 p-2 text-xs" dir="ltr">
                        {f.evidence}
                      </pre>
                    )}
                    {f.recommendation && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">{t("securityAnalyzer.recommendation")}: </span>
                        {f.recommendation}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      )}
    </>
  );
}
