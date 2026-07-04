import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Lock,
  FolderOpen,
  Languages,
  Palette,
  PackageSearch,
  Smartphone,
  FlaskConical,
  Check,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store/app-store";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { Language, ThemeMode } from "@/lib/db-types";
import { useQuery } from "@tanstack/react-query";

type StepId =
  | "welcome"
  | "privacy"
  | "language"
  | "theme"
  | "folder"
  | "dependencies"
  | "trust"
  | "connect";

const steps: StepId[] = [
  "welcome",
  "privacy",
  "language",
  "theme",
  "folder",
  "dependencies",
  "trust",
  "connect",
];

export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [stepIdx, setStepIdx] = useState(0);
  const step = steps[stepIdx];

  const { data: deps } = useQuery({
    queryKey: ["dependencies"],
    queryFn: async () => (await api.runDependencyCheck()).data ?? [],
    enabled: step === "dependencies",
  });

  const finish = async () => {
    await updateSettings({ onboarding_completed: true });
    navigate("/dashboard");
  };

  const next = () => setStepIdx((i) => Math.min(i + 1, steps.length - 1));
  const prev = () => setStepIdx((i) => Math.max(i - 1, 0));

  if (!settings) return null;

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-b from-background to-muted/40 p-6">
      <Card className="w-full max-w-2xl overflow-hidden shadow-xl">
        {/* progress dots */}
        <div className="flex items-center gap-1.5 border-b border-border px-6 py-3">
          {steps.map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= stepIdx ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        <CardContent className="min-h-[380px] p-8">
          {step === "welcome" && (
            <StepShell
              icon={<ShieldCheck className="h-8 w-8" />}
              title={t("onboarding.welcomeTitle")}
              body={t("onboarding.welcomeBody")}
            />
          )}

          {step === "privacy" && (
            <StepShell
              icon={<Lock className="h-8 w-8" />}
              title={t("onboarding.privacyTitle")}
              body={t("onboarding.privacyBody")}
            >
              <ul className="mt-4 space-y-2">
                {["privacyBullet1", "privacyBullet2", "privacyBullet3"].map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 text-success shrink-0" />
                    {t(`onboarding.${b}`)}
                  </li>
                ))}
              </ul>
            </StepShell>
          )}

          {step === "language" && (
            <StepShell
              icon={<Languages className="h-8 w-8" />}
              title={t("onboarding.languageTitle")}
            >
              <div className="mt-4 grid grid-cols-2 gap-3">
                {(["en", "he"] as Language[]).map((lang) => (
                  <ChoiceCard
                    key={lang}
                    active={settings.language === lang}
                    onClick={() => updateSettings({ language: lang })}
                    label={lang === "en" ? "English" : "עברית"}
                    sub={lang === "en" ? "LTR" : "RTL"}
                  />
                ))}
              </div>
            </StepShell>
          )}

          {step === "theme" && (
            <StepShell
              icon={<Palette className="h-8 w-8" />}
              title={t("onboarding.themeTitle")}
            >
              <div className="mt-4 grid grid-cols-3 gap-3">
                {(["light", "dark", "system"] as ThemeMode[]).map((th) => (
                  <ChoiceCard
                    key={th}
                    active={settings.theme === th}
                    onClick={() => updateSettings({ theme: th })}
                    label={t(`settings.theme${th.charAt(0).toUpperCase() + th.slice(1)}`)}
                  />
                ))}
              </div>
            </StepShell>
          )}

          {step === "folder" && (
            <StepShell
              icon={<FolderOpen className="h-8 w-8" />}
              title={t("onboarding.folderTitle")}
              body={t("onboarding.folderBody")}
            >
              <div className="mt-4 flex gap-2">
                <Input value={settings.backup_folder} readOnly className="font-mono text-xs" dir="ltr" />
                <Button
                  variant="outline"
                  onClick={async () => {
                    const res = await api.selectFolder();
                    if (res.data) updateSettings({ backup_folder: res.data });
                  }}
                >
                  {t("common.browse")}
                </Button>
              </div>
            </StepShell>
          )}

          {step === "dependencies" && (
            <StepShell
              icon={<PackageSearch className="h-8 w-8" />}
              title={t("onboarding.dependenciesTitle")}
              body={t("onboarding.dependenciesBody")}
            >
              <div className="mt-4 space-y-1.5">
                {(deps ?? []).map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <span className="font-mono text-sm">{d.name}</span>
                    {d.detected ? (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />{" "}
                        {d.version ?? t("common.enabled")}
                      </Badge>
                    ) : d.optional ? (
                      <Badge variant="muted" className="gap-1">
                        <XCircle className="h-3 w-3" /> {t("settings.optionalTool")}
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="gap-1">
                        <XCircle className="h-3 w-3" /> {t("settings.missingTools")}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </StepShell>
          )}

          {step === "trust" && (
            <StepShell
              icon={<ShieldCheck className="h-8 w-8" />}
              title={t("onboarding.trustTitle")}
              body={t("onboarding.trustBody")}
            />
          )}

          {step === "connect" && (
            <StepShell
              icon={<Smartphone className="h-8 w-8" />}
              title={t("onboarding.connectTitle")}
              body={t("onboarding.connectBody")}
            >
              <div className="mt-4 flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-warning-foreground" />
                  <Label className="cursor-pointer">{t("onboarding.enableMock")}</Label>
                </div>
                <Switch
                  checked={settings.mock_mode}
                  onCheckedChange={(v) => updateSettings({ mock_mode: v })}
                />
              </div>
            </StepShell>
          )}
        </CardContent>

        <div className="flex items-center justify-between border-t border-border px-8 py-4">
          <Button variant="ghost" onClick={prev} disabled={stepIdx === 0}>
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            {t("common.back")}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={finish}>
              {t("common.skip")}
            </Button>
            {stepIdx < steps.length - 1 ? (
              <Button onClick={next}>
                {t("common.next")}
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            ) : (
              <Button onClick={finish}>
                {t("onboarding.getStarted")}
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function StepShell({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        {icon}
      </div>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {body && <p className="mt-2 text-muted-foreground">{body}</p>}
      {children}
    </div>
  );
}

function ChoiceCard({
  active,
  onClick,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-xl border p-4 transition-all",
        active
          ? "border-primary bg-accent ring-1 ring-primary/30"
          : "border-border hover:border-primary/40",
      )}
    >
      <span className="text-sm font-medium">{label}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </button>
  );
}
