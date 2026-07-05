import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { FolderTree, Folder, FileIcon, ChevronRight, ArrowUp, Download, CheckSquare, Square } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DeviceGuard } from "@/components/layout/device-guard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/shared/empty-state";
import { useAppStore } from "@/lib/store/app-store";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/toast-store";
import { formatBytes, cn } from "@/lib/utils";

function FileBrowserInner() {
  const { t } = useTranslation();
  const selectedUdid = useAppStore((s) => s.selectedUdid);
  const upsertJob = useAppStore((s) => s.upsertJob);
  const setJobDrawerOpen = useAppStore((s) => s.setJobDrawerOpen);

  const [path, setPath] = useState("/");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: entries, isLoading } = useQuery({
    queryKey: ["device-files", selectedUdid, path],
    enabled: !!selectedUdid,
    queryFn: async () => {
      const res = await api.listDeviceFiles(selectedUdid!, path);
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });

  const navigate = (to: string) => {
    setPath(to);
    setSelected(new Set());
  };

  const goUp = () => {
    if (path === "/") return;
    const parent = path.replace(/\/[^/]+$/, "") || "/";
    navigate(parent);
  };

  const toggle = (p: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });

  const download = async () => {
    if (!selectedUdid || selected.size === 0) return;
    const dest = await api.selectFolder();
    if (!dest.success || !dest.data) return;
    const res = await api.downloadDeviceFiles(selectedUdid, [...selected], dest.data);
    if (res.success && res.data) {
      upsertJob(res.data);
      setJobDrawerOpen(true);
      toast.success(t("transferUi.downloadStarted"));
      setSelected(new Set());
    } else {
      toast.error(t("toast.error"), res.error?.message);
    }
  };

  const crumbs = path === "/" ? [] : path.split("/").filter(Boolean);

  return (
    <>
      <PageHeader
        icon={<FolderTree className="h-5 w-5" />}
        title={t("modules.fileBrowser.title")}
        description={t("modules.fileBrowser.description")}
        actions={
          selected.size > 0 ? (
            <Button size="sm" onClick={download}>
              <Download className="h-4 w-4" /> {t("transferUi.download")} ({selected.size})
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-border p-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goUp} disabled={path === "/"}>
              <ArrowUp className="h-4 w-4" />
            </Button>
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm">
              <button className="shrink-0 text-muted-foreground hover:text-foreground" onClick={() => navigate("/")}>
                {t("transferUi.root")}
              </button>
              {crumbs.map((c, i) => {
                const to = "/" + crumbs.slice(0, i + 1).join("/");
                return (
                  <span key={to} className="flex shrink-0 items-center gap-1">
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <button className="hover:text-foreground" onClick={() => navigate(to)}>{c}</button>
                  </span>
                );
              })}
            </div>
          </div>

          {isLoading ? (
            <div className="h-64 animate-pulse bg-muted/40" />
          ) : !entries || entries.length === 0 ? (
            <EmptyState className="border-0" icon={<Folder className="h-6 w-6" />} title={t("transferUi.empty")} />
          ) : (
            <ScrollArea className="h-[60vh]">
              <div className="divide-y divide-border">
                {entries.map((e) => (
                  <div
                    key={e.path}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-sm",
                      selected.has(e.path) && "bg-accent",
                    )}
                  >
                    {e.is_dir ? (
                      <span className="h-5 w-5" />
                    ) : (
                      <button
                        onClick={() => toggle(e.path)}
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-md border",
                          selected.has(e.path) ? "border-primary bg-primary text-primary-foreground" : "border-input",
                        )}
                      >
                        {selected.has(e.path) ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5 opacity-0" />}
                      </button>
                    )}
                    {e.is_dir ? (
                      <button className="flex flex-1 items-center gap-2 text-start" onClick={() => navigate(e.path)}>
                        <Folder className="h-4 w-4 text-primary" />
                        <span className="flex-1 truncate" dir="ltr">{e.name}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ) : (
                      <button className="flex flex-1 items-center gap-2 text-start" onClick={() => toggle(e.path)}>
                        <FileIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 truncate" dir="ltr">{e.name}</span>
                        <span className="w-20 text-end text-xs text-muted-foreground">
                          {e.size_bytes > 0 ? formatBytes(e.size_bytes) : "—"}
                        </span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export function FileBrowserPage() {
  return (
    <DeviceGuard>
      <FileBrowserInner />
    </DeviceGuard>
  );
}
