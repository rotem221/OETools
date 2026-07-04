import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Images,
  Image as ImageIcon,
  Video,
  Grid3x3,
  List,
  Download,
  CheckSquare,
  Square,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DeviceGuard } from "@/components/layout/device-guard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { useAppStore } from "@/lib/store/app-store";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/toast-store";
import { formatBytes, formatDateTime, cn } from "@/lib/utils";
import { useMediaThumb } from "./use-thumbnails";
import type { MediaItem } from "@/lib/db-types";

function MediaInner() {
  const { t, i18n } = useTranslation();
  const selectedUdid = useAppStore((s) => s.selectedUdid);
  const upsertJob = useAppStore((s) => s.upsertJob);
  const setJobDrawerOpen = useAppStore((s) => s.setJobDrawerOpen);

  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState<"all" | "images" | "videos">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["media", selectedUdid],
    enabled: !!selectedUdid,
    queryFn: async () => {
      const res = await api.listMedia(selectedUdid!);
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });

  const items = useMemo(() => {
    const list = data ?? [];
    if (filter === "images") return list.filter((m) => m.kind === "image");
    if (filter === "videos") return list.filter((m) => m.kind === "video");
    return list;
  }, [data, filter]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allSelected = items.length > 0 && items.every((m) => selected.has(m.id));

  const exportSelected = async () => {
    if (!selectedUdid || selected.size === 0) return;
    const folder = await api.selectFolder();
    const dest = folder.data;
    if (!dest) return;
    const res = await api.exportMedia(selectedUdid, [...selected], dest);
    if (res.success && res.data) {
      upsertJob(res.data);
      setJobDrawerOpen(true);
      toast.success(t("toast.exportStarted"));
      setSelected(new Set());
    } else {
      toast.error(t("toast.error"), res.error?.message);
    }
  };

  return (
    <>
      <PageHeader
        icon={<Images className="h-5 w-5" />}
        title={t("media.title")}
        actions={
          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as "grid" | "list")}>
              <TabsList className="h-8">
                <TabsTrigger value="grid" className="px-2 py-0.5">
                  <Grid3x3 className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="list" className="px-2 py-0.5">
                  <List className="h-4 w-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              size="sm"
              onClick={exportSelected}
              disabled={selected.size === 0}
            >
              <Download className="h-4 w-4" />
              {t("media.exportSelected")}
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">{t("media.all")}</TabsTrigger>
            <TabsTrigger value="images">{t("media.images")}</TabsTrigger>
            <TabsTrigger value="videos">{t("media.videos")}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-3">
          {selected.size > 0 && (
            <Badge variant="default">
              {t("media.selectedCount", { count: selected.size })}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setSelected(
                allSelected ? new Set() : new Set(items.map((m) => m.id)),
              )
            }
          >
            {allSelected ? (
              <>
                <Square className="h-4 w-4" />
                {t("common.deselectAll")}
              </>
            ) : (
              <>
                <CheckSquare className="h-4 w-4" />
                {t("common.selectAll")}
              </>
            )}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-lg bg-card" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Images className="h-7 w-7" />}
          title={t("media.empty")}
          description={t("media.emptyHint")}
        />
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((m) => (
            <MediaGridCard
              key={m.id}
              item={m}
              udid={selectedUdid}
              selected={selected.has(m.id)}
              onToggle={() => toggle(m.id)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-2">
            {items.map((m) => (
              <MediaListRow
                key={m.id}
                item={m}
                udid={selectedUdid}
                selected={selected.has(m.id)}
                onToggle={() => toggle(m.id)}
                locale={i18n.language}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

function MediaGridCard({
  item,
  udid,
  selected,
  onToggle,
}: {
  item: MediaItem;
  udid: string | null;
  selected: boolean;
  onToggle: () => void;
}) {
  const Icon = item.kind === "video" ? Video : ImageIcon;
  const { ref, state } = useMediaThumb(udid, item, true);
  const size = state?.size ?? item.size_bytes;
  const hasThumb = !!state?.dataUri;

  return (
    <button
      ref={ref}
      onClick={onToggle}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-lg border bg-muted/50 transition-all",
        selected ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/40",
      )}
    >
      {hasThumb ? (
        <img
          src={state!.dataUri!}
          alt={item.name}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <Icon
            className={cn("h-8 w-8", !state && "animate-pulse opacity-60")}
          />
        </div>
      )}

      {item.kind === "video" && (
        <div className="absolute start-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-md bg-black/50 text-white">
          <Video className="h-3 w-3" />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-start">
        <p className="truncate text-[10px] font-medium text-white" dir="ltr">
          {item.name}
        </p>
        {size > 0 && (
          <p className="text-[10px] text-white/70">{formatBytes(size)}</p>
        )}
      </div>
      <div
        className={cn(
          "absolute end-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-md border",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-white/70 bg-black/30",
        )}
      >
        {selected && <CheckSquare className="h-3.5 w-3.5" />}
      </div>
    </button>
  );
}

function MediaListRow({
  item,
  udid,
  selected,
  onToggle,
  locale,
}: {
  item: MediaItem;
  udid: string | null;
  selected: boolean;
  onToggle: () => void;
  locale: string;
}) {
  const Icon = item.kind === "video" ? Video : ImageIcon;
  const { ref, state } = useMediaThumb(udid, item, false);
  const size = state?.size ?? item.size_bytes;
  const date = state?.date || item.created_at;

  return (
    <button
      ref={ref}
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start transition-colors",
        selected ? "bg-accent" : "hover:bg-muted/60",
      )}
    >
      <div
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-md border",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-input",
        )}
      >
        {selected && <CheckSquare className="h-3.5 w-3.5" />}
      </div>
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1 truncate text-sm" dir="ltr">
        {item.name}
      </span>
      <span className="text-xs text-muted-foreground">
        {date ? formatDateTime(date, locale) : "—"}
      </span>
      <span className="w-20 text-end text-xs text-muted-foreground">
        {size > 0 ? formatBytes(size) : "—"}
      </span>
    </button>
  );
}

export function MediaPage() {
  return (
    <DeviceGuard>
      <MediaInner />
    </DeviceGuard>
  );
}
