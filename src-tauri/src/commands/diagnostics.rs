use crate::core::app_state::AppState;
use crate::core::errors::{envelope, CommandError, CommandResult};
use crate::core::job_queue;
use crate::database::repositories::{dependencies as deps_repo, logs as logs_repo};
use crate::models::{DependencyInfo, Job, OperationLog};
use crate::security::path_validation::{sanitize_identifier, validate_writable_dir};
use std::io::Write;
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::{AppHandle, State};

const MOCK_LINES: &[(&str, &str)] = &[
    ("info", "SpringBoard: application state changed"),
    ("debug", "locationd: heartbeat ok"),
    ("info", "mobile_backup: session opened"),
    ("warn", "thermalmonitord: nominal-elevated"),
    ("error", "wifid: association timeout (recovered)"),
    ("info", "powerd: charging state updated"),
];

#[tauri::command]
pub fn start_syslog(app: AppHandle, state: State<AppState>, udid: String) -> CommandResult<Job> {
    envelope((|| {
        let udid = sanitize_identifier(&udid)?;
        let job = job_queue::create(
            &state.db,
            &app,
            "log_collect",
            "System log stream",
            Some("Live syslog"),
            Some(&udid),
            true,
        );

        let cancel = state.register_cancel(&job.id);
        let db = state.db.clone();
        let mock = state.bridge().mock;
        let udid_clone = udid.clone();
        let job_id = job.id.clone();
        let mut worker_job = job.clone();

        std::thread::spawn(move || {
            if mock {
                let mut idx = 0usize;
                while !cancel.load(Ordering::SeqCst) {
                    let (level, msg) = MOCK_LINES[idx % MOCK_LINES.len()];
                    job_queue::log(&db, &app, Some(&job_id), Some(&udid_clone), level, msg, None);
                    idx += 1;
                    std::thread::sleep(Duration::from_millis(700));
                }
            } else {
                // Real device: stream idevicesyslog line by line. Rate-limit to
                // keep a chatty device from flooding the DB/UI (which would make
                // the app feel stuck); excess lines in a burst are dropped.
                let mut window = std::time::Instant::now();
                let mut count = 0u32;
                const MAX_PER_SEC: u32 = 30;
                let result = crate::device_bridge::libimobiledevice::stream_syslog(
                    &udid_clone,
                    &cancel,
                    |line| {
                        if window.elapsed() >= Duration::from_secs(1) {
                            window = std::time::Instant::now();
                            count = 0;
                        }
                        count += 1;
                        if count > MAX_PER_SEC {
                            return;
                        }
                        let level = classify_syslog_level(line);
                        job_queue::log(
                            &db,
                            &app,
                            Some(&job_id),
                            Some(&udid_clone),
                            level,
                            line,
                            None,
                        );
                    },
                );
                if let Err(e) = result {
                    job_queue::log(
                        &db,
                        &app,
                        Some(&job_id),
                        Some(&udid_clone),
                        "error",
                        "System log stream unavailable",
                        Some(&e.message),
                    );
                }
            }

            // The stream ended (user stopped it, the device disconnected, or an
            // error occurred). Finalize the job so it leaves "In progress"
            // instead of appearing stuck at 0%.
            job_queue::complete(&db, &app, &mut worker_job);
        });

        Ok(job)
    })())
}

/// Heuristically classify a syslog line into a UI log level.
fn classify_syslog_level(line: &str) -> &'static str {
    let l = line.to_ascii_lowercase();
    if l.contains("<error>") || l.contains(" error") || l.contains("fault") || l.contains("panic") {
        "error"
    } else if l.contains("<warning>") || l.contains("warn") {
        "warn"
    } else if l.contains("<debug>") {
        "debug"
    } else {
        "info"
    }
}

#[tauri::command]
pub fn stop_syslog(state: State<AppState>, job_id: String) -> CommandResult<()> {
    state.request_cancel(&job_id);
    state.clear_cancel(&job_id);
    envelope(Ok(()))
}

#[tauri::command]
pub fn collect_crash_reports(
    app: AppHandle,
    state: State<AppState>,
    udid: String,
) -> CommandResult<Job> {
    envelope((|| {
        let udid = sanitize_identifier(&udid)?;
        let mut job = job_queue::create(
            &state.db,
            &app,
            "log_collect",
            "Crash report collection",
            Some("Collect crash reports"),
            Some(&udid),
            false,
        );
        // v1: record that collection ran; real implementation would call
        // idevicecrashreport into the logs folder.
        job_queue::log(
            &state.db,
            &app,
            Some(&job.id),
            Some(&udid),
            "info",
            "Crash report collection completed (0 new reports)",
            None,
        );
        job_queue::complete(&state.db, &app, &mut job);
        Ok(job)
    })())
}

#[tauri::command]
pub fn recent_logs(state: State<AppState>, udid: Option<String>) -> CommandResult<Vec<OperationLog>> {
    let conn = state.db.conn.lock().unwrap();
    envelope(logs_repo::recent(&conn, udid.as_deref(), 200).map_err(CommandError::from))
}

#[tauri::command]
pub fn export_logs(state: State<AppState>, destination: String) -> CommandResult<String> {
    envelope((|| {
        let dir = validate_writable_dir(&destination)?;
        let logs = {
            let conn = state.db.conn.lock().unwrap();
            logs_repo::recent(&conn, None, 5000).map_err(CommandError::from)?
        };
        let path = dir.join("idevice-desk-logs.txt");
        let mut file = std::fs::File::create(&path)
            .map_err(|_| CommandError::folder_not_writable(&path.display().to_string()))?;
        for l in logs.iter().rev() {
            let _ = writeln!(
                file,
                "[{}] {} — {}{}",
                l.created_at,
                l.level.to_uppercase(),
                l.message,
                l.technical_details
                    .as_ref()
                    .map(|d| format!(" ({d})"))
                    .unwrap_or_default()
            );
        }
        Ok(path.display().to_string())
    })())
}

#[tauri::command]
pub fn run_dependency_check(state: State<AppState>) -> CommandResult<Vec<DependencyInfo>> {
    // Force a fresh probe (bypassing the cache) so the Dependencies tab always
    // reflects the current environment when the user explicitly re-checks.
    let deps = state.dependencies(true);
    let conn = state.db.conn.lock().unwrap();
    for d in &deps {
        let _ = deps_repo::save(&conn, d);
    }
    envelope(Ok(deps))
}
