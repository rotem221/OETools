import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Contact, Download, Lock, Mail, Phone, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/shared/empty-state";
import { BackupSourcePicker } from "@/features/backups/backup-source-picker";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/toast-store";
import type { BackupSourceInfo } from "@/lib/db-types";

export function ContactsPage() {
  const { t } = useTranslation();
  const [source, setSource] = useState<BackupSourceInfo | null>(null);
  const [query, setQuery] = useState("");

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts", source?.path],
    enabled: !!source && !source.encrypted,
    queryFn: async () => {
      const res = await api.listContacts(source!.path);
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });

  const filtered = useMemo(() => {
    if (!contacts) return [];
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phones.some((p) => p.includes(q)) ||
        c.emails.some((e) => e.toLowerCase().includes(q)),
    );
  }, [contacts, query]);

  const exportContacts = async (format: "vcard" | "csv") => {
    if (!source) return;
    const dest = await api.selectFolder();
    if (!dest.success || !dest.data) return;
    const res = await api.exportContacts(source.path, dest.data, format);
    if (res.success && res.data) toast.success(t("dataExport.exported"), res.data);
    else toast.error(t("toast.error"), res.error?.message);
  };

  return (
    <>
      <PageHeader
        icon={<Contact className="h-5 w-5" />}
        title={t("modules.contacts.title")}
        description={t("modules.contacts.description")}
        actions={
          contacts && contacts.length > 0 ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => exportContacts("vcard")}>
                <Download className="h-4 w-4" /> {t("dataExport.exportVcard")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportContacts("csv")}>
                <Download className="h-4 w-4" /> {t("dataExport.exportCsv")}
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="mb-4">
        <BackupSourcePicker selected={source} onSelect={(s) => setSource(s)} />
      </div>

      {!source ? null : source.encrypted ? (
        <EmptyState
          icon={<Lock className="h-6 w-6" />}
          title={t("backupBrowser.encryptedTitle")}
          description={t("backupBrowser.encryptedBody")}
        />
      ) : (
        <Card>
          <CardContent className="p-4">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("dataExport.search")}
                className="pl-9"
              />
            </div>
            {isLoading ? (
              <div className="h-64 animate-pulse rounded-lg bg-muted/40" />
            ) : filtered.length === 0 ? (
              <EmptyState className="border-0" icon={<Contact className="h-6 w-6" />} title={t("dataExport.noContacts")} />
            ) : (
              <>
                <p className="mb-2 text-xs text-muted-foreground">
                  {t("dataExport.contactsCount", { count: filtered.length })}
                </p>
                <ScrollArea className="h-[58vh]">
                  <div className="grid gap-2 pr-2 sm:grid-cols-2">
                    {filtered.map((c) => (
                      <div key={c.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{c.name}</span>
                          {c.organization && (
                            <Badge variant="muted" className="shrink-0 text-[10px]">{c.organization}</Badge>
                          )}
                        </div>
                        <div className="mt-1 space-y-0.5">
                          {c.phones.map((p) => (
                            <p key={p} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" /> {p}
                            </p>
                          ))}
                          {c.emails.map((e) => (
                            <p key={e} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" /> {e}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
