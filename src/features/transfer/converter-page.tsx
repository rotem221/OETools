import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileAudio, FileImage, FolderOpen, Music, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store/app-store";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/toast-store";

const IMAGE_TARGETS = ["jpg", "png", "tiff"];
const AV_TARGETS = ["mp4", "mov", "m4a", "mp3", "wav"];

function basename(p: string): string {
  return p.split(/[/\\]/).pop() ?? p;
}

export function ConverterPage() {
  const { t } = useTranslation();
  const upsertJob = useAppStore((s) => s.upsertJob);
  const setJobDrawerOpen = useAppStore((s) => s.setJobDrawerOpen);

  const [inputs, setInputs] = useState<string[]>([]);
  const [target, setTarget] = useState("jpg");

  // Ringtone state
  const [ringInput, setRingInput] = useState<string | null>(null);
  const [start, setStart] = useState("0");
  const [duration, setDuration] = useState("30");
  const [ringBusy, setRingBusy] = useState(false);

  const pickInputs = async () => {
    const res = await api.selectFiles();
    if (res.success && res.data && res.data.length) {
      setInputs((prev) => Array.from(new Set([...prev, ...res.data!])));
    }
  };

  const convert = async () => {
    if (!inputs.length) return;
    const dest = await api.selectFolder();
    if (!dest.success || !dest.data) return;
    const res = await api.convertMedia(inputs, dest.data, target);
    if (res.success && res.data) {
      upsertJob(res.data);
      setJobDrawerOpen(true);
      toast.success(t("converter.started"));
    } else {
      toast.error(t("toast.error"), res.error?.message);
    }
  };

  const pickRingInput = async () => {
    const res = await api.selectFiles();
    if (res.success && res.data && res.data.length) setRingInput(res.data[0]);
  };

  const makeRingtone = async () => {
    if (!ringInput) return;
    const dest = await api.selectFolder();
    if (!dest.success || !dest.data) return;
    setRingBusy(true);
    const res = await api.makeRingtone(
      ringInput,
      dest.data,
      parseFloat(start) || 0,
      parseFloat(duration) || 30,
    );
    setRingBusy(false);
    if (res.success && res.data) {
      toast.success(t("converter.ringtoneDone"), res.data.output_paths[0]);
    } else {
      toast.error(t("toast.error"), res.error?.message);
    }
  };

  return (
    <>
      <PageHeader
        icon={<FileImage className="h-5 w-5" />}
        title={t("converter.title")}
        description={t("converter.description")}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Batch converter */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileImage className="h-4 w-4" /> {t("converter.convertTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("converter.convertBody")}</p>

            <Button variant="outline" size="sm" onClick={pickInputs}>
              <Plus className="h-4 w-4" /> {t("converter.addFiles")}
            </Button>

            {inputs.length > 0 && (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {inputs.map((f) => (
                  <div key={f} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-mono" dir="ltr">{basename(f)}</span>
                    <button onClick={() => setInputs((p) => p.filter((x) => x !== f))}>
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label>{t("converter.targetFormat")}</Label>
              <div className="flex flex-wrap gap-1.5">
                <span className="mr-1 flex items-center text-xs text-muted-foreground">
                  <FileImage className="mr-1 h-3.5 w-3.5" />
                </span>
                {IMAGE_TARGETS.map((f) => (
                  <FormatChip key={f} value={f} active={target === f} onClick={() => setTarget(f)} />
                ))}
                <span className="mx-1 flex items-center text-xs text-muted-foreground">
                  <FileAudio className="mr-1 h-3.5 w-3.5" />
                </span>
                {AV_TARGETS.map((f) => (
                  <FormatChip key={f} value={f} active={target === f} onClick={() => setTarget(f)} />
                ))}
              </div>
            </div>

            <Button className="w-full" onClick={convert} disabled={!inputs.length}>
              <FolderOpen className="h-4 w-4" /> {t("converter.convertButton")}
            </Button>
            <p className="text-xs text-muted-foreground">{t("converter.toolsNote")}</p>
          </CardContent>
        </Card>

        {/* Ringtone maker */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Music className="h-4 w-4" /> {t("converter.ringtoneTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("converter.ringtoneBody")}</p>

            <Button variant="outline" size="sm" onClick={pickRingInput}>
              <Plus className="h-4 w-4" /> {t("converter.pickAudio")}
            </Button>
            {ringInput && (
              <div className="flex items-center gap-2 rounded-lg border border-border p-2 text-xs">
                <FileAudio className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-mono" dir="ltr">{basename(ringInput)}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start">{t("converter.startSec")}</Label>
                <input
                  id="start"
                  type="number"
                  min={0}
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dur">{t("converter.durationSec")}</Label>
                <input
                  id="dur"
                  type="number"
                  min={1}
                  max={40}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                />
              </div>
            </div>
            <Badge variant="muted">{t("converter.ringtoneLimit")}</Badge>

            <Button className="w-full" onClick={makeRingtone} disabled={!ringInput || ringBusy}>
              <Music className="h-4 w-4" /> {t("converter.makeRingtone")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function FormatChip({ value, active, onClick }: { value: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-md border px-2.5 py-1 text-xs font-medium uppercase transition-colors " +
        (active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:bg-accent")
      }
    >
      {value}
    </button>
  );
}
