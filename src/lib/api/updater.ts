import { isTauri } from "./client";

export interface UpdateInfo {
  available: boolean;
  version: string;
  currentVersion: string;
  notes?: string;
  date?: string;
}

export type UpdateProgress =
  | { event: "started"; contentLength?: number }
  | { event: "progress"; downloaded: number; contentLength?: number }
  | { event: "finished" };

/** Returns the running application version (falls back to package version). */
export async function getAppVersion(): Promise<string> {
  if (!isTauri()) return "0.1.0";
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    return await getVersion();
  } catch {
    return "0.1.0";
  }
}

// Cache the resolved Update handle between "check" and "install" so we don't
// download metadata twice.
let pendingUpdate: import("@tauri-apps/plugin-updater").Update | null = null;

/**
 * Checks the configured GitHub release endpoint for a newer, signed build.
 * Returns null in a plain browser (mock mode) where no native updater exists.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!isTauri()) return null;
  const { check } = await import("@tauri-apps/plugin-updater");
  const currentVersion = await getAppVersion();

  let update: import("@tauri-apps/plugin-updater").Update | null = null;
  try {
    update = await check();
  } catch (err) {
    // A missing/unreachable release endpoint (e.g. no release published yet,
    // 404, or offline) is not a real error for the user — report up to date.
    console.warn("Update check unavailable:", err);
    return { available: false, version: currentVersion, currentVersion };
  }

  pendingUpdate = update;
  if (!update) {
    return { available: false, version: currentVersion, currentVersion };
  }
  return {
    available: true,
    version: update.version,
    currentVersion: update.currentVersion,
    notes: update.body ?? undefined,
    date: update.date ?? undefined,
  };
}

/**
 * Downloads and installs the pending update, reporting byte progress.
 * On macOS the app relaunches automatically; on Windows the installer runs and
 * the app exits — callers should still offer a manual relaunch.
 */
export async function downloadAndInstallUpdate(
  onProgress?: (p: UpdateProgress) => void,
): Promise<void> {
  if (!isTauri() || !pendingUpdate) return;
  let downloaded = 0;
  let contentLength: number | undefined;
  await pendingUpdate.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        contentLength = event.data.contentLength;
        onProgress?.({ event: "started", contentLength });
        break;
      case "Progress":
        downloaded += event.data.chunkLength;
        onProgress?.({ event: "progress", downloaded, contentLength });
        break;
      case "Finished":
        onProgress?.({ event: "finished" });
        break;
    }
  });
}

/** Relaunches the application after an update has been installed. */
export async function relaunchApp(): Promise<void> {
  if (!isTauri()) return;
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}
