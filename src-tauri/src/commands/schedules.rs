use crate::core::app_state::AppState;
use crate::core::errors::{envelope, CommandError, CommandResult};
use crate::database::repositories::schedules as repo;
use crate::device_bridge::mock;
use crate::models::{now_iso, ScheduledBackup};
use crate::security::path_validation::sanitize_identifier;
use tauri::State;

fn seed_mock_if_needed(state: &AppState, udid: &str) {
    if !state.bridge().mock {
        return;
    }
    let conn = state.db.conn.lock().unwrap();
    let existing = repo::list(&conn, Some(udid)).unwrap_or_default();
    if existing.is_empty() {
        let _ = repo::upsert(&conn, &mock::mock_schedule(udid));
    }
}

#[tauri::command]
pub fn list_schedules(
    state: State<AppState>,
    udid: Option<String>,
) -> CommandResult<Vec<ScheduledBackup>> {
    envelope((|| {
        let udid = match udid {
            Some(u) => Some(sanitize_identifier(&u)?),
            None => None,
        };
        if let Some(u) = &udid {
            seed_mock_if_needed(&state, u);
        }
        let conn = state.db.conn.lock().unwrap();
        repo::list(&conn, udid.as_deref()).map_err(CommandError::from)
    })())
}

#[tauri::command]
pub fn save_schedule(
    state: State<AppState>,
    schedule: ScheduledBackup,
) -> CommandResult<ScheduledBackup> {
    envelope((|| {
        let mut schedule = schedule;
        sanitize_identifier(&schedule.device_udid)?;
        if schedule.id.is_empty() {
            schedule.id = uuid::Uuid::new_v4().to_string();
            schedule.created_at = now_iso();
        }
        schedule.updated_at = now_iso();
        schedule.next_run_at = compute_next_run(&schedule);
        let conn = state.db.conn.lock().unwrap();
        repo::upsert(&conn, &schedule)?;
        Ok(schedule)
    })())
}

#[tauri::command]
pub fn delete_schedule(state: State<AppState>, id: String) -> CommandResult<()> {
    let conn = state.db.conn.lock().unwrap();
    envelope(repo::delete(&conn, &id).map_err(CommandError::from))
}

/// Schedules that are currently due (enabled and whose next run time has
/// passed, or event-based types). In v1 the app surfaces these as suggestions
/// rather than running them automatically in the background.
#[tauri::command]
pub fn due_schedules(state: State<AppState>) -> CommandResult<Vec<ScheduledBackup>> {
    envelope((|| {
        let conn = state.db.conn.lock().unwrap();
        let all = repo::list(&conn, None)?;
        let now = now_iso();
        let due = all
            .into_iter()
            .filter(|s| {
                if !s.enabled {
                    return false;
                }
                match s.schedule_type.as_str() {
                    "on_connect" | "on_start" => true,
                    _ => s
                        .next_run_at
                        .as_ref()
                        .map(|n| n.as_str() <= now.as_str())
                        .unwrap_or(false),
                }
            })
            .collect();
        Ok(due)
    })())
}

/// Compute a coarse next-run timestamp for time-based schedules. Event-based
/// schedules (on_connect/on_start) have no fixed next time.
fn compute_next_run(s: &ScheduledBackup) -> Option<String> {
    use chrono::{Duration, Utc};
    match s.schedule_type.as_str() {
        "daily" => Some((Utc::now() + Duration::days(1)).to_rfc3339()),
        "weekly" => Some((Utc::now() + Duration::days(7)).to_rfc3339()),
        _ => None,
    }
}
