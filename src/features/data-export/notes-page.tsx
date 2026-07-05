import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { NotebookPen, Download, Lock, FileText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/shared/empty-state";
import { BackupSourcePicker } from "@/features/backups/backup-source-picker";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/toast-store";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { BackupSourceInfo, NoteEntry } from "@/lib/db-types";

export function NotesPage() {
  const { t, i18n } = useTranslation();
  const [source, setSource] = useState<BackupSourceInfo | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: notes, isLoading } = useQuery({
    queryKey: ["notes", source?.path],
    enabled: !!source && !source.encrypted,
    queryFn: async () => {
      const res = await api.listNotes(source!.path);
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });

  const { data: activeNote } = useQuery({
    queryKey: ["note", source?.path, activeId],
    enabled: !!source && !!activeId,
    queryFn: async () => {
      const res = await api.getNote(source!.path, activeId!);
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });

  const listMeta = (n: NoteEntry) => notes?.find((x) => x.id === n.id);

  const exportNotes = async (format: "html" | "csv") => {
    if (!source) return;
    const dest = await api.selectFolder();
    if (!dest.success || !dest.data) return;
    const res = await api.exportNotes(source.path, dest.data, format);
    if (res.success && res.data) toast.success(t("dataExport.exported"), res.data);
    else toast.error(t("toast.error"), res.error?.message);
  };

  return (
    <>
      <PageHeader
        icon={<NotebookPen className="h-5 w-5" />}
        title={t("modules.notes.title")}
        description={t("modules.notes.description")}
        actions={
          notes && notes.length > 0 ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => exportNotes("html")}>
                <Download className="h-4 w-4" /> {t("dataExport.exportHtml")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportNotes("csv")}>
                <Download className="h-4 w-4" /> {t("dataExport.exportCsv")}
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="mb-4">
        <BackupSourcePicker selected={source} onSelect={(s) => { setSource(s); setActiveId(null); }} />
      </div>

      {!source ? null : source.encrypted ? (
        <EmptyState
          icon={<Lock className="h-6 w-6" />}
          title={t("backupBrowser.encryptedTitle")}
          description={t("backupBrowser.encryptedBody")}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card>
            <CardContent className="p-2">
              {isLoading ? (
                <div className="h-64 animate-pulse rounded-lg bg-muted/40" />
              ) : !notes || notes.length === 0 ? (
                <EmptyState className="border-0" icon={<NotebookPen className="h-6 w-6" />} title={t("dataExport.noNotes")} />
              ) : (
                <ScrollArea className="h-[60vh]">
                  <div className="space-y-1 pr-2">
                    {notes.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => setActiveId(n.id)}
                        className={cn(
                          "w-full rounded-lg p-2.5 text-left transition-colors hover:bg-accent",
                          activeId === n.id && "bg-accent",
                        )}
                      >
                        <p className="truncate text-sm font-medium">{n.title || "—"}</p>
                        <p className="truncate text-xs text-muted-foreground">{n.snippet || "—"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {n.modified_at ? formatDateTime(n.modified_at, i18n.language) : ""}
                        </p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex h-[60vh] flex-col p-0">
              {!activeId ? (
                <EmptyState className="h-full border-0" icon={<FileText className="h-6 w-6" />} title={t("dataExport.selectNote")} />
              ) : (
                <>
                  <div className="border-b border-border p-3">
                    <p className="text-sm font-medium">{activeNote?.title || listMeta({ id: activeId } as NoteEntry)?.title || "—"}</p>
                  </div>
                  <ScrollArea className="flex-1 p-4">
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
                      {activeNote?.body || activeNote?.snippet || "…"}
                    </pre>
                  </ScrollArea>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
