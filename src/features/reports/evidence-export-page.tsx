import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { FileArchive, Lock, ShieldCheck, Check } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import { BackupSourcePicker } from "@/features/backups/backup-source-picker";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/toast-store";
import { cn } from "@/lib/utils";
import type { BackupSourceInfo } from "@/lib/db-types";

export function EvidenceExportPage() {
  const { t } = useTranslation();
  const [source, setSource] = useState<BackupSourceInfo | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [caseId, setCaseId] = useState("");
  const [operator, setOperator] = useState("");
  const [organization, setOrganization] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ["evidence-categories", source?.path],
    enabled: !!source && !source.encrypted,
    queryFn: async () => {
      const res = await api.listBackupCategories(source!.path);
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data.filter((c) => c.exportable && c.item_count > 0);
    },
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const create = async () => {
    if (!source || selected.size === 0) return;
    const dest = await api.selectFolder();
    if (!dest.success || !dest.data) return;
    setBusy(true);
    const res = await api.createEvidencePackage(
      source.path,
      Array.from(selected),
      dest.data,
      operator || undefined,
      organization || undefined,
      caseId || undefined,
      notes || undefined,
    );
    setBusy(false);
    if (res.success && res.data) toast.success(t("exportsUi.created"), res.data.title);
    else toast.error(t("toast.error"), res.error?.message);
  };

  return (
    <>
      <PageHeader
        icon={<FileArchive className="h-5 w-5" />}
        title={t("modules.evidenceExport.title")}
        description={t("modules.evidenceExport.description")}
      />

      <div className="mb-4">
        <BackupSourcePicker selected={source} onSelect={(s) => { setSource(s); setSelected(new Set()); }} />
      </div>

      {!source ? (
        <EmptyState icon={<FileArchive className="h-6 w-6" />} title={t("exportsUi.pickSource")} />
      ) : source.encrypted ? (
        <EmptyState
          icon={<Lock className="h-6 w-6" />}
          title={t("backupBrowser.encryptedTitle")}
          description={t("backupBrowser.encryptedBody")}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="text-sm font-medium">{t("exportsUi.selectCategories")}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(categories ?? []).map((c) => {
                  const on = selected.has(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggle(c.id)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg border p-3 text-left transition-colors",
                        on ? "border-primary bg-primary/5" : "border-border hover:bg-accent",
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium">{c.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.item_count.toLocaleString()} {t("backupBrowser.items")}
                        </p>
                      </div>
                      <div className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-md border",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-border",
                      )}>
                        {on && <Check className="h-3.5 w-3.5" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="caseId">{t("exportsUi.caseId")}</Label>
                  <Input id="caseId" value={caseId} onChange={(e) => setCaseId(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="operator">{t("exportsUi.operator")}</Label>
                  <Input id="operator" value={operator} onChange={(e) => setOperator(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="org">{t("exportsUi.organization")}</Label>
                  <Input id="org" value={organization} onChange={(e) => setOrganization(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes">{t("exportsUi.notes")}</Label>
                  <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <Button className="w-full" onClick={create} disabled={busy || selected.size === 0}>
                  <FileArchive className="h-4 w-4" /> {t("exportsUi.create")}
                </Button>
              </CardContent>
            </Card>
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-xs leading-relaxed text-muted-foreground">{t("exportsUi.integrity")}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
