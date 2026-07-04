import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, ShieldCheck, Lock, Server } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Polished placeholder for modules whose backend data model and integration
 * points exist but whose full experience is landing in an upcoming round.
 * Keeps the app feeling complete and communicates the roadmap + safety model.
 */
export function ModulePlaceholder({
  moduleKey,
  icon,
  experimental = false,
  safetyKey,
  children,
}: {
  moduleKey: string;
  icon: ReactNode;
  experimental?: boolean;
  safetyKey?: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader
        icon={icon}
        title={t(`modules.${moduleKey}.title`)}
        description={t(`modules.${moduleKey}.description`)}
        actions={
          <div className="flex items-center gap-2">
            {experimental && (
              <Badge variant="warning">{t("comingSoon.experimental")}</Badge>
            )}
            <Badge variant="muted">
              <Sparkles className="h-3.5 w-3.5" />
              {t("comingSoon.badge")}
            </Badge>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              {t("comingSoon.roadmap")}
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("comingSoon.backendNote")}
            </p>
            {children}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <InfoTile
            icon={<Lock className="h-4 w-4" />}
            text={t("comingSoon.localNote")}
          />
          <InfoTile
            icon={<Server className="h-4 w-4" />}
            text={t("safety.localDefault")}
          />
          {safetyKey && (
            <InfoTile
              icon={<ShieldCheck className="h-4 w-4" />}
              text={t(safetyKey)}
            />
          )}
        </div>
      </div>
    </>
  );
}

function InfoTile({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        {icon}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}
