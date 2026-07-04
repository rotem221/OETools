import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Info,
  Download,
  ShieldCheck,
  Cpu,
  HardDrive,
  BatteryMedium,
  Fingerprint,
  Wifi,
  Terminal,
  LineChart as LineChartIcon,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/shared/page-header";
import { DeviceGuard } from "@/components/layout/device-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InfoRow } from "@/components/shared/info-row";
import { EmptyState } from "@/components/shared/empty-state";
import { useAppStore } from "@/lib/store/app-store";
import { useDeviceInfo } from "./use-devices";
import { api } from "@/lib/api/client";
import { formatBytes } from "@/lib/utils";
import { toast } from "@/lib/store/toast-store";

function BatteryHistoryCard({ udid }: { udid: string }) {
  const { t, i18n } = useTranslation();
  const { data } = useQuery({
    queryKey: ["battery-history", udid],
    queryFn: async () => {
      const res = await api.listBatteryHistory(udid);
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });

  const points = (data ?? []).map((s) => ({
    date: new Date(s.captured_at).toLocaleDateString(i18n.language, {
      month: "short",
      day: "numeric",
    }),
    health: s.health_percent,
    level: s.level_percent,
  }));

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <LineChartIcon className="h-4 w-4" /> {t("deviceInfo.batteryHistory")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {points.length < 2 ? (
          <EmptyState
            className="border-0 py-10"
            icon={<BatteryMedium className="h-6 w-6" />}
            title={t("deviceInfo.batteryHistoryEmpty")}
            description={t("deviceInfo.batteryHistoryHint")}
          />
        ) : (
          <div className="h-56 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" fontSize={11} tickLine={false} />
                <YAxis domain={[0, 100]} fontSize={11} tickLine={false} width={32} />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="health"
                  name={t("dashboard.batteryHealth")}
                  stroke="hsl(var(--success))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="level"
                  name={t("dashboard.battery")}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InfoInner() {
  const { t } = useTranslation();
  const selectedUdid = useAppStore((s) => s.selectedUdid);
  const { data: info, isLoading } = useDeviceInfo(selectedUdid);

  if (isLoading || !info) {
    return <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />;
  }

  const f = (k: string) => t(`deviceInfo.fields.${k}`);

  const exportJson = async () => {
    const blob = new Blob([JSON.stringify(info, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${info.name.replace(/\s+/g, "-")}-info.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("deviceInfo.exportJson"));
  };

  return (
    <>
      <PageHeader
        icon={<Info className="h-5 w-5" />}
        title={t("deviceInfo.title")}
        description={info.name}
        actions={
          <Button variant="outline" size="sm" onClick={exportJson}>
            <Download className="h-4 w-4" />
            {t("deviceInfo.exportJson")}
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3">
        <ShieldCheck className="h-4 w-4 text-success shrink-0" />
        <p className="text-xs text-success">{t("deviceInfo.safeNote")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Info className="h-4 w-4" /> {t("deviceInfo.general")}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-0">
            <InfoRow label={f("name")} value={info.name} copyable />
            <InfoRow label={f("kind")} value={info.device_class} />
            <InfoRow label={f("model")} value={info.model} />
            <InfoRow label={f("productType")} value={info.product_type} />
            <InfoRow label={f("regionInfo")} value={info.region_info} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Cpu className="h-4 w-4" /> {t("deviceInfo.software")}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-0">
            <InfoRow label={f("osVersion")} value={info.os_version} />
            <InfoRow label={f("buildVersion")} value={info.build_version} />
            <InfoRow label={f("cpuArchitecture")} value={info.cpu_architecture} />
            <InfoRow label={f("activationState")} value={info.activation_state} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <HardDrive className="h-4 w-4" /> {t("deviceInfo.storage")}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-0">
            <InfoRow label={t("dashboard.total")} value={formatBytes(info.storage.total_bytes)} />
            <InfoRow label={t("dashboard.used")} value={formatBytes(info.storage.used_bytes)} />
            <InfoRow label={t("dashboard.free")} value={formatBytes(info.storage.free_bytes)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BatteryMedium className="h-4 w-4" /> {t("deviceInfo.batterySection")}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-0">
            <InfoRow label={t("dashboard.battery")} value={info.battery.level_percent != null ? `${info.battery.level_percent}%` : null} />
            <InfoRow label={t("dashboard.batteryHealth")} value={info.battery.health_percent != null ? `${info.battery.health_percent}%` : null} />
            <InfoRow label={t("dashboard.cycles")} value={info.battery.cycle_count} />
            <InfoRow label="State" value={info.battery.state} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Fingerprint className="h-4 w-4" /> {t("deviceInfo.identifiers")}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-0">
            <InfoRow label={f("udid")} value={info.udid} copyable mono />
            <InfoRow label={f("serialNumber")} value={info.serial_number} copyable mono />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wifi className="h-4 w-4" /> {t("deviceInfo.network")}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-0">
            <InfoRow label={f("wifiAddress")} value={info.wifi_address} mono />
            <InfoRow label={f("bluetoothAddress")} value={info.bluetooth_address} mono />
            <InfoRow label={f("phoneNumber")} value={info.phone_number} />
          </CardContent>
        </Card>
      </div>

      <BatteryHistoryCard udid={info.udid} />

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Terminal className="h-4 w-4" /> {t("deviceInfo.raw")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64 rounded-lg border border-border bg-muted/40">
            <pre className="p-4 text-xs font-mono leading-relaxed" dir="ltr">
              {Object.entries(info.raw)
                .map(([k, v]) => `${k}: ${v}`)
                .join("\n")}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </>
  );
}

export function DeviceInfoPage() {
  return (
    <DeviceGuard>
      <InfoInner />
    </DeviceGuard>
  );
}
