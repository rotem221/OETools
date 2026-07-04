import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import type { MediaItem } from "@/lib/db-types";

export interface ThumbState {
  dataUri: string | null;
  size: number;
  date: string;
  loaded: boolean;
}

// Module-level caches so previews persist across view/filter changes and
// re-renders without refetching from the device.
const thumbCache = new Map<string, ThumbState>();
const metaCache = new Map<string, ThumbState>();

// Bounded concurrency: pulling files + running sips/ffmpeg is relatively heavy,
// so only a few previews are generated at a time.
const MAX_CONCURRENT = 3;
let active = 0;
const waiting: Array<() => void> = [];

function runQueued(task: () => Promise<void>) {
  const start = () => {
    active++;
    void task().finally(() => {
      active--;
      waiting.shift()?.();
    });
  };
  if (active < MAX_CONCURRENT) start();
  else waiting.push(start);
}

async function fetchThumb(udid: string, item: MediaItem): Promise<ThumbState> {
  const res = await api.mediaThumbnail(udid, item.relative_path, item.kind);
  return res.success && res.data
    ? {
        dataUri: res.data.data_uri,
        size: res.data.size_bytes,
        date: res.data.created_at,
        loaded: true,
      }
    : { dataUri: null, size: 0, date: "", loaded: true };
}

async function fetchMeta(udid: string, item: MediaItem): Promise<ThumbState> {
  const res = await api.mediaInfo(udid, item.relative_path);
  return res.success && res.data
    ? { dataUri: null, size: res.data.size_bytes, date: res.data.created_at, loaded: true }
    : { dataUri: null, size: 0, date: "", loaded: true };
}

/**
 * Lazily load a preview (or just size/date metadata) for a media item once it
 * scrolls into view. `withThumb` controls whether an image preview is
 * generated (grid) or only cheap metadata is fetched (list).
 */
export function useMediaThumb(
  udid: string | null,
  item: MediaItem,
  withThumb: boolean,
) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const cache = withThumb ? thumbCache : metaCache;
  const [state, setState] = useState<ThumbState | null>(
    cache.get(item.id) ?? null,
  );

  useEffect(() => {
    if (!udid || state?.loaded) return;
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        runQueued(async () => {
          const result = withThumb
            ? await fetchThumb(udid, item)
            : await fetchMeta(udid, item);
          cache.set(item.id, result);
          setState(result);
        });
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [udid, item, withThumb, state?.loaded, cache]);

  return { ref, state };
}
