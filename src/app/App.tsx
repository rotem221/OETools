import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AppRoutes } from "./routes";
import { useAppStore } from "@/lib/store/app-store";
import { useDevices } from "@/features/devices/use-devices";
import { onJobUpdate } from "@/lib/api/events";
import { api } from "@/lib/api/client";
import { runAutoUpdateOnStartup } from "@/lib/api/auto-update";

/** Bootstraps global state (settings, devices, job stream) and gates onboarding. */
export function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const loadSettings = useAppStore((s) => s.loadSettings);
  const upsertJob = useAppStore((s) => s.upsertJob);
  const setJobs = useAppStore((s) => s.setJobs);
  const settings = useAppStore((s) => s.settings);
  const settingsLoaded = useAppStore((s) => s.settingsLoaded);
  const [routedOnboarding, setRoutedOnboarding] = useState(false);

  // Load persisted settings on startup.
  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  // Silently check for (and install) updates on startup when enabled.
  useEffect(() => {
    void runAutoUpdateOnStartup();
  }, []);

  // Hydrate the Activity panel with existing jobs so history/in-progress work
  // is visible immediately (progress then keeps flowing via job events).
  useEffect(() => {
    void api.listJobs().then((res) => {
      if (res.success && res.data) setJobs(res.data);
    });
  }, [setJobs]);

  // Keep device list synced globally.
  useDevices();

  // Subscribe to backend job progress events.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onJobUpdate((job) => upsertJob(job)).then((u) => (unlisten = u));
    return () => unlisten?.();
  }, [upsertJob]);

  // React to system theme changes when in "system" mode.
  useEffect(() => {
    if (settings?.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => useAppStore.getState().applyTheme();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [settings?.theme]);

  // Redirect to onboarding once, if it hasn't been completed.
  useEffect(() => {
    if (!settingsLoaded || routedOnboarding) return;
    if (settings && !settings.onboarding_completed && location.pathname !== "/onboarding") {
      navigate("/onboarding", { replace: true });
    }
    setRoutedOnboarding(true);
  }, [settingsLoaded, settings, routedOnboarding, navigate, location.pathname]);

  return <AppRoutes />;
}
