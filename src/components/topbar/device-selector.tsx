import { useTranslation } from "react-i18next";
import { Smartphone, Tablet, ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store/app-store";
import type { DeviceKind } from "@/lib/db-types";

function KindIcon({ kind, className }: { kind: DeviceKind; className?: string }) {
  return kind === "ipad" ? (
    <Tablet className={className} />
  ) : (
    <Smartphone className={className} />
  );
}

export function DeviceSelector() {
  const { t } = useTranslation();
  const devices = useAppStore((s) => s.devices);
  const selectedUdid = useAppStore((s) => s.selectedUdid);
  const selectDevice = useAppStore((s) => s.selectDevice);

  const selected = devices.find((d) => d.udid === selectedUdid);

  if (devices.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
        {t("topbar.noDevice")}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 no-drag">
          {selected && <KindIcon kind={selected.kind} className="h-4 w-4" />}
          <span className="max-w-[160px] truncate">
            {selected?.name ?? t("topbar.selectDevice")}
          </span>
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              selected?.connection_state === "connected"
                ? "bg-success"
                : "bg-muted-foreground/40"
            }`}
          />
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{t("topbar.selectDevice")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {devices.map((d) => (
          <DropdownMenuItem
            key={d.udid}
            onClick={() => selectDevice(d.udid)}
            className="gap-2"
          >
            <KindIcon kind={d.kind} className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm">{d.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {d.model} · {d.os_version}
              </p>
            </div>
            {d.udid === selectedUdid && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
