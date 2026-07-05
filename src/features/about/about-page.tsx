import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Info,
  Heart,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Download,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { isTauri } from "@/lib/api/client";
import {
  checkForUpdate,
  downloadAndInstallUpdate,
  getAppVersion,
  relaunchApp,
  type UpdateInfo,
} from "@/lib/api/updater";
import {
  getAutoUpdate,
  setAutoUpdate as persistAutoUpdate,
} from "@/lib/api/auto-update";
import dnpLogoLight from "@/assets/brand/dnp-logo-light.png";
import dnpLogoDark from "@/assets/brand/dnp-logo-dark.png";

const WEBSITE_URL = "https://dnpai.co.il";

async function openExternal(url: string) {
  if (isTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else {
    window.open(url, "_blank", "noopener");
  }
}

type UpdateStatus =
  | "idle"
  | "checking"
  | "upToDate"
  | "available"
  | "downloading"
  | "installed"
  | "error";

export function AboutPage() {
  const { t } = useTranslation();
  const [version, setVersion] = useState("0.1.0");
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState(0);
  const [autoUpdate, setAutoUpdateState] = useState(getAutoUpdate());

  useEffect(() => {
    void getAppVersion().then(setVersion);
  }, []);

  const runCheck = async () => {
    if (!isTauri()) return;
    setStatus("checking");
    try {
      const info = await checkForUpdate();
      if (info?.available) {
        setUpdate(info);
        setStatus("available");
      } else {
        setStatus("upToDate");
      }
    } catch {
      setStatus("error");
    }
  };

  const runInstall = async () => {
    setStatus("downloading");
    setProgress(0);
    try {
      await downloadAndInstallUpdate((p) => {
        if (p.event === "progress" && p.contentLength) {
          setProgress(Math.round((p.downloaded / p.contentLength) * 100));
        }
      });
      setStatus("installed");
    } catch {
      setStatus("error");
    }
  };

  const toggleAuto = (v: boolean) => {
    setAutoUpdateState(v);
    persistAutoUpdate(v);
  };

  return (
    <>
      <PageHeader
        icon={<Info className="h-5 w-5" />}
        title={t("about.title")}
      />

      {/* Brand / credit card */}
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col items-center gap-5 py-10 text-center">
          <picture>
            <img
              src={dnpLogoLight}
              alt="DNP AI Solutions"
              className="h-16 w-auto object-contain dark:hidden"
            />
            <img
              src={dnpLogoDark}
              alt="DNP AI Solutions"
              className="hidden h-16 w-auto object-contain dark:block"
            />
          </picture>

          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              {t("app.name")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("about.appTagline")}
            </p>
            <p className="text-xs font-mono text-muted-foreground">
              {t("about.version")} {version}
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">{t("about.madeBy")}</span>
            <Heart className="h-4 w-4 fill-[#7C3AED] text-[#7C3AED]" />
            <span className="font-semibold">{t("about.madeByCompany")}</span>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">
            {t("about.credit")}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" onClick={() => void openExternal(WEBSITE_URL)}>
              <ExternalLink className="h-4 w-4" />
              {t("about.visitWebsite")}
            </Button>
          </div>

          <div className="mt-2 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
            <p className="text-xs text-success">{t("about.privacyNote")}</p>
          </div>

          <p className="text-[11px] text-muted-foreground">
            {t("about.copyright", { year: new Date().getFullYear() })}
          </p>
        </CardContent>
      </Card>

      {/* Updates card */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">{t("about.updates")}</CardTitle>
          <CardDescription>
            {t("about.currentVersion")}: v{version}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">{t("about.autoUpdate")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("about.autoUpdateHint")}
              </p>
            </div>
            <Switch checked={autoUpdate} onCheckedChange={toggleAuto} />
          </div>

          {!isTauri() ? (
            <p className="text-sm text-muted-foreground">
              {t("about.notAvailableInBrowser")}
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={runCheck}
                  disabled={status === "checking" || status === "downloading"}
                >
                  <RefreshCw
                    className={status === "checking" ? "animate-spin" : ""}
                  />
                  {status === "checking"
                    ? t("about.checking")
                    : t("about.checkForUpdates")}
                </Button>

                {status === "available" && (
                  <Button variant="default" onClick={runInstall}>
                    <Download className="h-4 w-4" />
                    {t("about.downloadAndInstall")}
                  </Button>
                )}

                {status === "installed" && (
                  <Button variant="default" onClick={() => void relaunchApp()}>
                    <RotateCw className="h-4 w-4" />
                    {t("about.restartNow")}
                  </Button>
                )}
              </div>

              {status === "upToDate" && (
                <p className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  {t("about.upToDate")}
                </p>
              )}

              {status === "available" && update && (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <p className="text-sm font-medium">
                    {t("about.updateAvailable", { version: update.version })}
                  </p>
                  {update.notes && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("about.releaseNotes")}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">
                        {update.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {status === "downloading" && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {t("about.downloading")}
                  </p>
                  <Progress value={progress} />
                </div>
              )}

              {status === "installed" && (
                <p className="text-sm text-muted-foreground">
                  {t("about.restartHint")}
                </p>
              )}

              {status === "error" && (
                <p className="flex items-center gap-2 text-sm text-warning-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  {t("about.checkFailed")}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
