import type { Job, OperationLog } from "@/lib/db-types";
import { isTauri } from "./client";

export type JobEvent = { job: Job };
export type LogEvent = { log: OperationLog };

/** Subscribe to backend job progress events. Returns an unsubscribe fn. */
export async function onJobUpdate(
  handler: (job: Job) => void,
): Promise<() => void> {
  if (!isTauri()) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<JobEvent>("job://update", (e) =>
    handler(e.payload.job),
  );
  return unlisten;
}

/** Subscribe to live log stream events (e.g. syslog). Returns unsubscribe fn. */
export async function onLogLine(
  handler: (log: OperationLog) => void,
): Promise<() => void> {
  if (!isTauri()) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<LogEvent>("log://line", (e) =>
    handler(e.payload.log),
  );
  return unlisten;
}
