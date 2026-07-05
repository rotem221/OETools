import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PackageOpen, Lock, FolderDown, Contact, NotebookPen, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { BackupSourcePicker } from "@/features/backups/backup-source-picker";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/toast-store";
import type { BackupSourceInfo } from "@/lib/db-types";

export function ExportAllPage() {
  const { t } = useTranslation();
  const [source, setSource] = useState<BackupSourceInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const runExport = async () => {
    if (!source) return;
    const dest = await api.selectFolder();
    if (!dest.success || !dest.data) return;
    setBusy(true);
    const res = await api.exportAllData(source.path, dest.data);
    setBusy(false);
    if (res.success && res.data) toast.success(t("dataExport.exportAllStarted"), res.data.title);
    else toast.error(t("toast.error"), res.error?.message);
  };

  return (
    <>
      <PageHeader
        icon={<PackageOpen className="h-5 w-5" />}
        title={t("modules.exportAll.title")}
        description={t("modules.exportAll.description")}
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
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardContent className="space-y-4 p-6">
              <div>
                <h3 className="text-sm font-semibold">{t("dataExport.exportAllTitle")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t("dataExport.exportAllBody")}</p>
              </div>
              <Button onClick={runExport} disabled={busy}>
                <FolderDown className="h-4 w-4" /> {t("dataExport.chooseDestination")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-6">
              <p className="text-xs font-medium text-muted-foreground">{t("dataExport.includes")}</p>
              <Row icon={<Contact className="h-4 w-4" />} text={t("dataExport.includesContacts")} />
              <Row icon={<NotebookPen className="h-4 w-4" />} text={t("dataExport.includesNotes")} />
              <Row icon={<MessageCircle className="h-4 w-4" />} text={t("dataExport.includesWhatsapp")} />
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function Row({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        {icon}
      </div>
      <span className="text-sm">{text}</span>
    </div>
  );
}
