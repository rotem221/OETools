import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Send, FilePlus, Smartphone, ShieldCheck, X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DeviceGuard } from "@/components/layout/device-guard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/toast-store";

function QuickTransferInner() {
  const { t } = useTranslation();
  const selectedUdid = useAppStore((s) => s.selectedUdid);
  const upsertJob = useAppStore((s) => s.upsertJob);
  const setJobDrawerOpen = useAppStore((s) => s.setJobDrawerOpen);

  const [files, setFiles] = useState<string[]>([]);
  const [remoteDir, setRemoteDir] = useState<string>("");

  const { data: rootDirs } = useQuery({
    queryKey: ["device-root-dirs", selectedUdid],
    enabled: !!selectedUdid,
    queryFn: async () => {
      const res = await api.listDeviceFiles(selectedUdid!, "/");
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data.filter((e) => e.is_dir);
    },
  });

  useEffect(() => {
    if (!remoteDir && rootDirs && rootDirs.length > 0) setRemoteDir(rootDirs[0].path);
  }, [rootDirs, remoteDir]);

  const pickFiles = async () => {
    const res = await api.selectFiles();
    if (res.success && res.data && res.data.length > 0) {
      setFiles((prev) => Array.from(new Set([...prev, ...res.data!])));
    }
  };

  const removeFile = (f: string) => setFiles((prev) => prev.filter((x) => x !== f));

  const send = async () => {
    if (!selectedUdid || files.length === 0) return;
    if (!remoteDir) {
      toast.error(t("transferUi.selectFolderFirst"));
      return;
    }
    const res = await api.uploadToDevice(selectedUdid, files, remoteDir);
    if (res.success && res.data) {
      upsertJob(res.data);
      setJobDrawerOpen(true);
      toast.success(t("transferUi.sendStarted"));
      setFiles([]);
    } else {
      toast.error(t("toast.error"), res.error?.message);
    }
  };

  return (
    <>
      <PageHeader
        icon={<Send className="h-5 w-5" />}
        title={t("modules.quickTransfer.title")}
        description={t("modules.quickTransfer.description")}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="space-y-4 p-4">
            <div>
              <h3 className="text-sm font-semibold">{t("transferUi.quickTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("transferUi.quickBody")}</p>
            </div>

            <Button variant="outline" onClick={pickFiles}>
              <FilePlus className="h-4 w-4" /> {t("transferUi.pickFiles")}
            </Button>

            {files.length === 0 ? (
              <EmptyState className="border-0" icon={<FilePlus className="h-6 w-6" />} title={t("transferUi.selectedFiles", { count: 0 })} />
            ) : (
              <ScrollArea className="max-h-64">
                <div className="space-y-1 pr-2">
                  {files.map((f) => (
                    <div key={f} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                      <span className="flex-1 truncate" dir="ltr">{f.split("/").pop()}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(f)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("transferUi.destination")}</label>
                <Select value={remoteDir} onValueChange={setRemoteDir}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("transferUi.root")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(rootDirs ?? []).map((d) => (
                      <SelectItem key={d.path} value={d.path}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={send} disabled={files.length === 0 || !remoteDir}>
                <Send className="h-4 w-4" /> {t("transferUi.send")} ({files.length})
              </Button>
            </CardContent>
          </Card>
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-xs leading-relaxed text-muted-foreground">{t("transferUi.note")}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Smartphone className="h-3.5 w-3.5" /> {selectedUdid}
          </div>
        </div>
      </div>
    </>
  );
}

export function QuickTransferPage() {
  return (
    <DeviceGuard>
      <QuickTransferInner />
    </DeviceGuard>
  );
}
