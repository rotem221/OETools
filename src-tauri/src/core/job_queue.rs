use crate::database::repositories::jobs as jobs_repo;
use crate::database::repositories::logs as logs_repo;
use crate::database::Database;
use crate::models::{now_iso, Job};
use serde_json::json;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

/// Create a new job, persist it, and notify the frontend.
pub fn create(
    db: &Database,
    app: &AppHandle,
    job_type: &str,
    title: &str,
    description: Option<&str>,
    device_udid: Option<&str>,
    cancellable: bool,
) -> Job {
    let job = Job {
        id: Uuid::new_v4().to_string(),
        job_type: job_type.to_string(),
        status: "in_progress".to_string(),
        progress: 0,
        device_udid: device_udid.map(|s| s.to_string()),
        title: title.to_string(),
        description: description.map(|s| s.to_string()),
        error_message: None,
        started_at: Some(now_iso()),
        completed_at: None,
        created_at: now_iso(),
        cancellable,
    };
    {
        let conn = db.conn.lock().unwrap();
        let _ = jobs_repo::upsert(&conn, &job);
    }
    emit(app, &job);
    job
}

pub fn progress(db: &Database, app: &AppHandle, job: &mut Job, value: i64) {
    job.progress = value.clamp(0, 100);
    {
        let conn = db.conn.lock().unwrap();
        let _ = jobs_repo::upsert(&conn, job);
    }
    emit(app, job);
}

pub fn complete(db: &Database, app: &AppHandle, job: &mut Job) {
    job.status = "completed".into();
    job.progress = 100;
    job.completed_at = Some(now_iso());
    job.cancellable = false;
    persist_emit(db, app, job);
}

pub fn fail(db: &Database, app: &AppHandle, job: &mut Job, error: &str) {
    job.status = "failed".into();
    job.completed_at = Some(now_iso());
    job.error_message = Some(error.to_string());
    job.cancellable = false;
    persist_emit(db, app, job);
}

pub fn cancel(db: &Database, app: &AppHandle, job: &mut Job) {
    job.status = "cancelled".into();
    job.completed_at = Some(now_iso());
    job.cancellable = false;
    persist_emit(db, app, job);
}

fn persist_emit(db: &Database, app: &AppHandle, job: &Job) {
    {
        let conn = db.conn.lock().unwrap();
        let _ = jobs_repo::upsert(&conn, job);
    }
    emit(app, job);
}

fn emit(app: &AppHandle, job: &Job) {
    let _ = app.emit("job://update", json!({ "job": job }));
}

/// Log a line associated with a job and stream it to the UI.
pub fn log(
    db: &Arc<Database>,
    app: &AppHandle,
    job_id: Option<&str>,
    device_udid: Option<&str>,
    level: &str,
    message: &str,
    technical: Option<&str>,
) {
    let conn = db.conn.lock().unwrap();
    if let Ok(entry) = logs_repo::insert(&conn, job_id, device_udid, level, message, technical) {
        drop(conn);
        let _ = app.emit("log://line", json!({ "log": entry }));
    }
}
