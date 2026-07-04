import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Download, Lock, Paperclip, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/shared/empty-state";
import { BackupSourcePicker } from "@/features/backups/backup-source-picker";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/toast-store";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { BackupSourceInfo, MessageThread } from "@/lib/db-types";

export function MessagesPage() {
  const { t, i18n } = useTranslation();
  const [source, setSource] = useState<BackupSourceInfo | null>(null);
  const [active, setActive] = useState<MessageThread | null>(null);

  const { data: threads, isLoading } = useQuery({
    queryKey: ["conversations", source?.path],
    enabled: !!source && !source.encrypted,
    queryFn: async () => {
      const res = await api.listConversations(source!.path);
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["conversation", source?.path, active?.chat_id],
    enabled: !!source && !!active,
    queryFn: async () => {
      const res = await api.getConversation(source!.path, active!.chat_id);
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });

  const exportThread = async (format: "html" | "csv") => {
    if (!source || !active) return;
    const dest = await api.selectFolder();
    if (!dest.success || !dest.data) return;
    const res = await api.exportMessages(source.path, active.chat_id, dest.data, format);
    if (res.success && res.data) {
      toast.success(t("messages.exported"), res.data);
    } else {
      toast.error(t("toast.error"), res.error?.message);
    }
  };

  return (
    <>
      <PageHeader
        icon={<MessageSquare className="h-5 w-5" />}
        title={t("modules.messages.title")}
        description={t("modules.messages.description")}
      />

      <div className="mb-4">
        <BackupSourcePicker selected={source} onSelect={(s) => { setSource(s); setActive(null); }} />
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
              ) : !threads || threads.length === 0 ? (
                <EmptyState className="border-0" icon={<MessageSquare className="h-6 w-6" />} title={t("messages.noConversations")} />
              ) : (
                <ScrollArea className="h-[60vh]">
                  <div className="space-y-1 pr-2">
                    {threads.map((th) => (
                      <button
                        key={th.chat_id}
                        onClick={() => setActive(th)}
                        className={cn(
                          "w-full rounded-lg p-2.5 text-left transition-colors hover:bg-accent",
                          active?.chat_id === th.chat_id && "bg-accent",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{th.display_name}</span>
                          <Badge variant="muted" className="shrink-0 text-[10px]">{th.service}</Badge>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{th.last_snippet || "—"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {th.message_count.toLocaleString()} · {th.last_message_at ? formatDateTime(th.last_message_at, i18n.language) : "—"}
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
              {!active ? (
                <EmptyState className="h-full border-0" icon={<MessageSquare className="h-6 w-6" />} title={t("messages.selectConversation")} />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 border-b border-border p-3">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={() => setActive(null)}>
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-medium">{active.display_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => exportThread("html")}>
                        <Download className="h-4 w-4" /> HTML
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => exportThread("csv")}>
                        <Download className="h-4 w-4" /> CSV
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-2">
                      {(messages ?? []).map((m) => (
                        <div
                          key={m.id}
                          className={cn(
                            "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                            m.from_me
                              ? "ml-auto bg-primary text-primary-foreground"
                              : "bg-muted",
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">
                            {m.text || (m.has_attachment ? "" : t("messages.noText"))}
                            {m.has_attachment && (
                              <span className="ml-1 inline-flex items-center gap-1 opacity-80">
                                <Paperclip className="inline h-3 w-3" />
                                {t("messages.attachment")}
                              </span>
                            )}
                          </p>
                          <p className="mt-1 text-[10px] opacity-70">
                            {m.sent_at ? formatDateTime(m.sent_at, i18n.language) : ""}
                          </p>
                        </div>
                      ))}
                    </div>
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
