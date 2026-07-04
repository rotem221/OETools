import { create } from "zustand";
import type { AppSettings, DeviceSummary, Job } from "@/lib/db-types";
import { api } from "@/lib/api/client";
import { applyLanguage } from "@/lib/i18n";

interface AppState {
  settings: AppSettings | null;
  settingsLoaded: boolean;
  devices: DeviceSummary[];
  selectedUdid: string | null;
  jobs: Job[];
  jobDrawerOpen: boolean;

  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  setDevices: (devices: DeviceSummary[]) => void;
  selectDevice: (udid: string | null) => void;
  setJobs: (jobs: Job[]) => void;
  upsertJob: (job: Job) => void;
  setJobDrawerOpen: (open: boolean) => void;
  applyTheme: () => void;
}

function resolveTheme(mode: AppSettings["theme"]): "light" | "dark" {
  if (mode === "system") {
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  }
  return mode;
}

export const useAppStore = create<AppState>((set, get) => ({
  settings: null,
  settingsLoaded: false,
  devices: [],
  selectedUdid: null,
  jobs: [],
  jobDrawerOpen: false,

  loadSettings: async () => {
    const res = await api.getSettings();
    if (res.success && res.data) {
      set({ settings: res.data, settingsLoaded: true });
      applyLanguage(res.data.language);
      get().applyTheme();
    } else {
      set({ settingsLoaded: true });
    }
  },

  updateSettings: async (patch) => {
    const res = await api.updateSettings(patch);
    if (res.success && res.data) {
      set({ settings: res.data });
      if (patch.language) applyLanguage(res.data.language);
      if (patch.theme) get().applyTheme();
    }
  },

  setDevices: (devices) => {
    const { devices: prev, selectedUdid } = get();
    // Skip state updates when nothing meaningful changed to avoid re-render
    // churn on every poll (device list is fetched on an interval).
    const sig = (list: DeviceSummary[]) =>
      list
        .map((d) => `${d.udid}:${d.connection_state}:${d.trust_state}`)
        .join("|");
    const stillConnected = devices.some((d) => d.udid === selectedUdid);
    const nextSelected = stillConnected
      ? selectedUdid
      : (devices[0]?.udid ?? null);
    if (sig(prev) === sig(devices) && nextSelected === selectedUdid) return;
    set({ devices, selectedUdid: nextSelected });
  },

  selectDevice: (udid) => set({ selectedUdid: udid }),

  setJobs: (jobs) => set({ jobs }),

  upsertJob: (job) =>
    set((s) => {
      const idx = s.jobs.findIndex((j) => j.id === job.id);
      if (idx === -1) return { jobs: [job, ...s.jobs] };
      const next = [...s.jobs];
      next[idx] = job;
      return { jobs: next };
    }),

  setJobDrawerOpen: (open) => set({ jobDrawerOpen: open }),

  applyTheme: () => {
    const settings = get().settings;
    if (!settings || typeof document === "undefined") return;
    const theme = resolveTheme(settings.theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  },
}));
