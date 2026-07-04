use crate::core::app_state::AppState;
use crate::core::errors::{envelope, CommandError, CommandResult};
use crate::database::repositories::jobs as jobs_repo;
use crate::models::Job;
use tauri::State;

#[tauri::command]
pub fn list_jobs(state: State<AppState>) -> CommandResult<Vec<Job>> {
    let conn = state.db.conn.lock().unwrap();
    envelope(jobs_repo::list(&conn).map_err(CommandError::from))
}

#[tauri::command]
pub fn get_job(state: State<AppState>, id: String) -> CommandResult<Job> {
    let conn = state.db.conn.lock().unwrap();
    envelope(jobs_repo::get(&conn, &id).map_err(|_| CommandError::new("Job not found.")))
}

#[tauri::command]
pub fn cancel_job(state: State<AppState>, id: String) -> CommandResult<()> {
    state.request_cancel(&id);
    envelope(Ok(()))
}

#[tauri::command]
pub fn clear_completed_jobs(state: State<AppState>) -> CommandResult<()> {
    let conn = state.db.conn.lock().unwrap();
    envelope(jobs_repo::clear_completed(&conn).map_err(CommandError::from))
}
