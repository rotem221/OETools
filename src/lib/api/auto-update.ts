import { isTauri } from "./client";
import {
  checkForUpdate,
  downloadAndInstallUpdate,
  relaunchApp,
} from "./updater";

const STORAGE_KEY = "oetools.autoUpdate";

/** Whether automatic updates are enabled (defaults to on). */
export function getAutoUpdate(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY) !== "false";
}

export function setAutoUpdate(enabled: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
}

/**
 * Runs once on startup: if auto-update is enabled and a signed update exists,
 * it is downloaded and installed silently, then the app relaunches.
 * Failures are swallowed so a flaky network never blocks app launch.
 */
export async function runAutoUpdateOnStartup(): Promise<void> {
  if (!isTauri() || !getAutoUpdate()) return;
  try {
    const info = await checkForUpdate();
    if (!info?.available) return;
    await downloadAndInstallUpdate();
    await relaunchApp();
  } catch {
    // Ignore — the user can still check manually from the About page.
  }
}
