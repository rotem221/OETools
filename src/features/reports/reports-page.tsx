import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, FileOutput, ExternalLink, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DeviceGuard } from "@/components/layout/device-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { useAppStore } from "@/lib/store/app-store";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/toast-store";
import { formatDateTime } from "@/lib/utils";
import type { ReportType } from "@/lib/db-types";
import { generateReportSchema } from "@/lib/validation/schemas";

const reportTypes: ReportType[] = [
  "basic",
  "technical",
  "pre_service",
  "backup_summary",
];

function ReportsInner() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const selectedUdid = useAppStore((s) => s.selectedUdid);
  const [type, setType] = useState<ReportType>("technical");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: reports } = useQuery({
    queryKey: ["reports", selectedUdid],
    enabled: !!selectedUdid,
    queryFn: async () => {
      const res = await api.listReports(selectedUdid ?? undefined);
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });

  const generate = async () => {
    if (!selectedUdid) return;
    const parsed = generateReportSchema.safeParse({
      udid: selectedUdid,
      reportType: type,
      notes,
    });
    if (!parsed.success) {
      toast.error(t("toast.error"));
      return;
    }
    setBusy(true);
    const res = await api.generateReport(selectedUdid, type, notes);
    setBusy(false);
    if (res.success) {
      toast.success(t("reports.generated"));
      setNotes("");
      void qc.invalidateQueries({ queryKey: ["reports"] });
    } else {
      toast.error(t("toast.error"), res.error?.message);
    }
  };

  return (
    <>
      <PageHeader
        icon={<FileText className="h-5 w-5" />}
        title={t("reports.title")}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">{t("reports.generate")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("reports.type")}</Label>
              <Select value={type} onValueChange={(v) => setType(v as ReportType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((rt) => (
                    <SelectItem key={rt} value={rt}>
                      {t(`reports.${rt}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("reports.notes")}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("reports.notesPlaceholder")}
                rows={4}
              />
            </div>
            <Button className="w-full" onClick={generate} disabled={busy}>
              <FileOutput className="h-4 w-4" />
              {t("reports.generate")}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("reports.history")}</CardTitle>
          </CardHeader>
          <CardContent>
            {!reports || reports.length === 0 ? (
              <EmptyState
                className="border-0"
                icon={<FileText className="h-6 w-6" />}
                title={t("reports.noReports")}
              />
            ) : (
              <div className="space-y-2">
                {reports.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {t(`reports.${r.report_type}`)}
                        </span>
                        <Badge variant="secondary" className="uppercase">
                          {r.format}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(r.created_at, i18n.language)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => api.openReport(r.id)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={async () => {
                          await api.deleteReport(r.id);
                          void qc.invalidateQueries({ queryKey: ["reports"] });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export function ReportsPage() {
  return (
    <DeviceGuard>
      <ReportsInner />
    </DeviceGuard>
  );
}
