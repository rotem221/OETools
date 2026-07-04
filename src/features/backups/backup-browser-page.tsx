import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  FolderSearch,
  Download,
  Images,
  MessageSquare,
  Users,
  StickyNote,
  Calendar,
  Compass,
  Phone,
  Voicemail,
  Mic,
  MessageCircle,
  Lock,
  FileArchive,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { BackupSourcePicker } from "./backup-source-picker";
import { useAppStore } from "@/lib/store/app-store";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/toast-store";
import type { BackupCategory, BackupSourceInfo } from "@/lib/db-types";

const CATEGORY_ICONS: Record<string, typeof Images> = {
  photos: Images,
  messages: MessageSquare,
  contacts: Users,
  notes: StickyNote,
  calendars: Calendar,
  safari: Compass,
  call_history: Phone,
  voicemail: Voicemail,
  voice_memos: Mic,
  whatsapp: MessageCircle,
};

export function BackupBrowserPage() {
  const { t } = useTranslation();
  const [source, setSource] = useState<BackupSourceInfo | null>(null);
  const upsertJob = useAppStore((s) => s.upsertJob);
  const setJobDrawerOpen = useAppStore((s) => s.setJobDrawerOpen);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["backup-categories", source?.path],
    enabled: !!source && !source.encrypted,
    queryFn: async () => {
      const res = await api.listBackupCategories(source!.path);
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });

  const exportCategory = async (cat: BackupCategory) => {
    if (!source) return;
    const dest = await api.selectFolder();
    if (!dest.success || !dest.data) return;
    const res = await api.exportBackupCategory(source.path, cat.id, dest.data);
    if (res.success && res.data) {
      upsertJob(res.data);
      setJobDrawerOpen(true);
      toast.success(t("backupBrowser.exportStarted"));
    } else {
      toast.error(t("toast.error"), res.error?.message);
    }
  };

  return (
    <>
      <PageHeader
        icon={<FolderSearch className="h-5 w-5" />}
        title={t("modules.backupBrowser.title")}
        description={t("modules.backupBrowser.description")}
      />

      <div className="mb-4">
        <BackupSourcePicker selected={source} onSelect={setSource} />
      </div>

      {!source ? null : source.encrypted ? (
        <EmptyState
          icon={<Lock className="h-6 w-6" />}
          title={t("backupBrowser.encryptedTitle")}
          description={t("backupBrowser.encryptedBody")}
        />
      ) : isLoading ? (
        <div className="h-40 animate-pulse rounded-xl border border-border bg-card" />
      ) : !categories || categories.every((c) => c.item_count === 0) ? (
        <EmptyState
          icon={<FileArchive className="h-6 w-6" />}
          title={t("backupBrowser.emptyTitle")}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories
            .filter((c) => c.item_count > 0)
            .map((cat) => {
              const Icon = CATEGORY_ICONS[cat.id] ?? FileArchive;
              return (
                <Card key={cat.id}>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{cat.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {cat.item_count.toLocaleString()} {t("backupBrowser.items")}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => exportCategory(cat)}
                      title={t("backupBrowser.export")}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}
    </>
  );
}
