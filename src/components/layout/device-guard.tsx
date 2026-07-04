import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Smartphone, ShieldAlert, FlaskConical } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store/app-store";
import { api } from "@/lib/api/client";

/**
 * Renders children only when a usable (trusted/paired) device is selected.
 * Otherwise shows the appropriate no-device / not-trusted state.
 */
export function DeviceGuard({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const devices = useAppStore((s) => s.devices);
  const selectedUdid = useAppStore((s) => s.selectedUdid);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const settings = useAppStore((s) => s.settings);
  const selected = devices.find((d) => d.udid === selectedUdid);

  if (!selected) {
    return (
      <EmptyState
        icon={<Smartphone className="h-7 w-7" />}
        title={t("devices.noDeviceTitle")}
        description={t("devices.noDeviceBody")}
        action={
          !settings?.mock_mode ? (
            <Button
              variant="outline"
              onClick={() => updateSettings({ mock_mode: true })}
            >
              <FlaskConical className="h-4 w-4" />
              {t("onboarding.enableMock")}
            </Button>
          ) : (
            <Link to="/devices">
              <Button variant="outline">{t("devices.refreshDevices")}</Button>
            </Link>
          )
        }
      />
    );
  }

  if (selected.trust_state === "untrusted" || selected.trust_state === "not_paired") {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-7 w-7 text-warning-foreground" />}
        title={t("devices.notTrustedTitle")}
        description={t("devices.notTrustedBody")}
        action={
          <Button onClick={() => api.pairDevice(selected.udid)}>
            {t("devices.pair")}
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}
