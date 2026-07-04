import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Smartphone,
  Tablet,
  RefreshCw,
  FlaskConical,
  Usb,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { TrustBadge } from "@/components/shared/status-badge";
import { useAppStore } from "@/lib/store/app-store";
import { useDevices } from "./use-devices";
import { cn } from "@/lib/utils";

export function DevicesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refetch, isFetching } = useDevices();
  const devices = useAppStore((s) => s.devices);
  const selectedUdid = useAppStore((s) => s.selectedUdid);
  const selectDevice = useAppStore((s) => s.selectDevice);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const settings = useAppStore((s) => s.settings);

  return (
    <>
      <PageHeader
        icon={<Usb className="h-5 w-5" />}
        title={t("devices.title")}
        description={t("devices.multipleHint")}
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? "animate-spin" : ""} />
            {t("common.refresh")}
          </Button>
        }
      />

      {devices.length === 0 ? (
        <EmptyState
          icon={<Smartphone className="h-7 w-7" />}
          title={t("devices.noDeviceTitle")}
          description={t("devices.noDeviceBody")}
          action={
            !settings?.mock_mode && (
              <Button variant="outline" onClick={() => updateSettings({ mock_mode: true })}>
                <FlaskConical className="h-4 w-4" />
                {t("onboarding.enableMock")}
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {devices.map((d) => {
            const Icon = d.kind === "ipad" ? Tablet : Smartphone;
            const active = d.udid === selectedUdid;
            return (
              <Card
                key={d.udid}
                className={cn(
                  "cursor-pointer transition-all hover:border-primary/40",
                  active && "border-primary ring-1 ring-primary/30",
                )}
                onClick={() => {
                  selectDevice(d.udid);
                  navigate("/dashboard");
                }}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{d.name}</p>
                      <TrustBadge state={d.trust_state} />
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {d.model} · iOS {d.os_version}
                    </p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground" dir="ltr">
                      {d.udid}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
