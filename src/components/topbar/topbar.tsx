import { useTranslation } from "react-i18next";
import { Activity, FlaskConical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DeviceSelector } from "./device-selector";
import { useAppStore } from "@/lib/store/app-store";

export function Topbar() {
  const { t } = useTranslation();
  const setJobDrawerOpen = useAppStore((s) => s.setJobDrawerOpen);
  const jobs = useAppStore((s) => s.jobs);
  const settings = useAppStore((s) => s.settings);

  const activeJobs = jobs.filter(
    (j) => j.status === "in_progress" || j.status === "queued",
  ).length;

  return (
    <header className="drag-region flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background/80 px-5 backdrop-blur">
      <div className="flex items-center gap-3 no-drag">
        <DeviceSelector />
      </div>

      <div className="flex items-center gap-2 no-drag">
        {settings?.mock_mode && (
          <Badge variant="warning" className="gap-1.5">
            <FlaskConical className="h-3 w-3" />
            {t("topbar.mockMode")}
          </Badge>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 relative"
              onClick={() => setJobDrawerOpen(true)}
            >
              {activeJobs > 0 ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Activity className="h-4 w-4" />
              )}
              {t("topbar.jobs")}
              {activeJobs > 0 && (
                <span className="ms-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {activeJobs}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("jobs.title")}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
