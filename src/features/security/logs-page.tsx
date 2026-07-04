import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import { formatDateTime } from "@/lib/utils";
import type { LogLevel } from "@/lib/db-types";

const LEVEL_VARIANT: Record<LogLevel, "muted" | "default" | "warning" | "destructive"> = {
  debug: "muted",
  info: "default",
  warn: "warning",
  error: "destructive",
};

export function LogsPage() {
  const { t, i18n } = useTranslation();

  const logsQuery = useQuery({
    queryKey: ["operation-logs"],
    queryFn: async () => {
      const res = await api.recentLogs();
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });

  const logs = logsQuery.data ?? [];

  return (
    <>
      <PageHeader
        icon={<ScrollText className="h-5 w-5" />}
        title={t("nav.logs")}
        description={t("safety.localDefault")}
      />

      {logsQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-7 w-7" />}
          title={t("jobs.empty")}
          description={t("diagnostics.noLogs")}
        />
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3">
                <Badge variant={LEVEL_VARIANT[log.level]} className="mt-0.5 shrink-0">
                  {log.level}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{log.message}</p>
                  {log.technical_details && (
                    <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground" dir="ltr">
                      {log.technical_details}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDateTime(log.created_at, i18n.language)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
