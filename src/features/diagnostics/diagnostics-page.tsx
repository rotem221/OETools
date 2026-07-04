import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Stethoscope,
  Play,
  Pause,
  Square,
  Trash2,
  Download,
  Search,
  Bug,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DeviceGuard } from "@/components/layout/device-guard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { useAppStore } from "@/lib/store/app-store";
import { onLogLine } from "@/lib/api/events";
import { api, isTauri } from "@/lib/api/client";
import { toast } from "@/lib/store/toast-store";
import type { LogLevel, OperationLog } from "@/lib/db-types";
import { cn } from "@/lib/utils";

const levelColor: Record<LogLevel, string> = {
  debug: "text-muted-foreground",
  info: "text-foreground",
  warn: "text-warning-foreground",
  error: "text-destructive",
};

const mockLines = [
  { level: "info" as LogLevel, message: "SpringBoard: application state changed" },
  { level: "debug" as LogLevel, message: "locationd: heartbeat ok" },
  { level: "info" as LogLevel, message: "mobile_backup: session opened" },
  { level: "warn" as LogLevel, message: "thermalmonitord: nominal-elevated" },
  { level: "error" as LogLevel, message: "wifid: association timeout (recovered)" },
  { level: "info" as LogLevel, message: "powerd: charging state updated" },
];

function DiagnosticsInner() {
  const { t } = useTranslation();
  const selectedUdid = useAppStore((s) => s.selectedUdid);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<LogLevel | "all">("all");
  const bottomRef = useRef<HTMLDivElement>(null);
  const jobRef = useRef<string | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  // Mock streaming when not on Tauri backend.
  useEffect(() => {
    if (!running || paused) return;
    if (isTauri()) return; // real events handled separately
    const id = setInterval(() => {
      const pick = mockLines[Math.floor(Math.random() * mockLines.length)];
      setLogs((prev) =>
        [
          ...prev,
          {
            id: crypto.randomUUID(),
            job_id: null,
            device_udid: selectedUdid,
            level: pick.level,
            message: pick.message,
            technical_details: null,
            created_at: new Date().toISOString(),
          },
        ].slice(-500),
      );
    }, 700);
    return () => clearInterval(id);
  }, [running, paused, selectedUdid]);

  useEffect(() => {
    if (!paused) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, paused]);

  // Stop the backend syslog stream and detach listeners on unmount so the
  // job thread and event listener don't leak when navigating away.
  useEffect(() => {
    return () => {
      const jobId = jobRef.current;
      if (jobId) void api.stopSyslog(jobId);
      unlistenRef.current?.();
      unlistenRef.current = null;
    };
  }, []);

  const start = async () => {
    if (!selectedUdid) return;
    setRunning(true);
    setPaused(false);
    if (isTauri()) {
      const res = await api.startSyslog(selectedUdid);
      if (res.success && res.data) jobRef.current = res.data.id;
      unlistenRef.current = await onLogLine((log) =>
        setLogs((prev) => [...prev, log].slice(-500)),
      );
    }
  };

  const stop = async () => {
    setRunning(false);
    setPaused(false);
    if (jobRef.current) await api.stopSyslog(jobRef.current);
    unlistenRef.current?.();
    unlistenRef.current = null;
  };

  const filtered = useMemo(
    () =>
      logs.filter(
        (l) =>
          (severity === "all" || l.level === severity) &&
          (query === "" || l.message.toLowerCase().includes(query.toLowerCase())),
      ),
    [logs, severity, query],
  );

  return (
    <>
      <PageHeader
        icon={<Stethoscope className="h-5 w-5" />}
        title={t("diagnostics.title")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => api.collectCrashReports(selectedUdid!)}>
              <Bug className="h-4 w-4" />
              {t("diagnostics.crashReports")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const f = await api.selectFolder();
                if (f.data) {
                  await api.exportLogs(f.data);
                  toast.success(t("diagnostics.exportLogs"));
                }
              }}
            >
              <Download className="h-4 w-4" />
              {t("diagnostics.exportLogs")}
            </Button>
          </div>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          {!running ? (
            <Button size="sm" onClick={start}>
              <Play className="h-4 w-4" />
              {t("diagnostics.start")}
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setPaused((p) => !p)}>
                {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {paused ? t("diagnostics.resume") : t("diagnostics.pause")}
              </Button>
              <Button size="sm" variant="destructive" onClick={stop}>
                <Square className="h-4 w-4" />
                {t("diagnostics.stop")}
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => setLogs([])}>
            <Trash2 className="h-4 w-4" />
            {t("diagnostics.clear")}
          </Button>

          <div className="relative ms-auto flex items-center">
            <Search className="absolute start-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("diagnostics.searchLogs")}
              className="h-8 w-48 ps-8"
            />
          </div>
          <Select value={severity} onValueChange={(v) => setSeverity(v as LogLevel | "all")}>
            <SelectTrigger className="h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("media.all")}</SelectItem>
              <SelectItem value="debug">debug</SelectItem>
              <SelectItem value="info">info</SelectItem>
              <SelectItem value="warn">warn</SelectItem>
              <SelectItem value="error">error</SelectItem>
            </SelectContent>
          </Select>
          {running && (
            <Badge variant={paused ? "muted" : "success"}>
              {paused ? t("diagnostics.pause") : t("diagnostics.liveLog")}
            </Badge>
          )}
        </div>

        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState
              className="border-0"
              icon={<Stethoscope className="h-6 w-6" />}
              title={t("diagnostics.noLogs")}
            />
          ) : (
            <ScrollArea className="h-[440px]">
              <div className="p-3 font-mono text-xs leading-relaxed" dir="ltr">
                {filtered.map((l) => (
                  <div key={l.id} className="flex gap-3 py-0.5">
                    <span className="shrink-0 text-muted-foreground/60">
                      {new Date(l.created_at).toLocaleTimeString()}
                    </span>
                    <span className={cn("shrink-0 uppercase w-12", levelColor[l.level])}>
                      {l.level}
                    </span>
                    <span className="break-all">{l.message}</span>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export function DiagnosticsPage() {
  return (
    <DeviceGuard>
      <DiagnosticsInner />
    </DeviceGuard>
  );
}
