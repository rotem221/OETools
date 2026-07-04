use crate::models::Job;
use rusqlite::{Connection, Row};

const COLS: &str = "id, type, status, progress, device_udid, title, description, error_message, started_at, completed_at, created_at, cancellable";

fn map(row: &Row) -> rusqlite::Result<Job> {
    Ok(Job {
        id: row.get(0)?,
        job_type: row.get(1)?,
        status: row.get(2)?,
        progress: row.get(3)?,
        device_udid: row.get(4)?,
        title: row.get(5)?,
        description: row.get(6)?,
        error_message: row.get(7)?,
        started_at: row.get(8)?,
        completed_at: row.get(9)?,
        created_at: row.get(10)?,
        cancellable: row.get::<_, i64>(11)? != 0,
    })
}

pub fn upsert(conn: &Connection, j: &Job) -> rusqlite::Result<()> {
    conn.execute(
        &format!(
            "INSERT INTO jobs ({COLS}) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)
             ON CONFLICT(id) DO UPDATE SET
                status=?3, progress=?4, error_message=?8, started_at=?9, completed_at=?10, cancellable=?12"
        ),
        rusqlite::params![
            j.id,
            j.job_type,
            j.status,
            j.progress,
            j.device_udid,
            j.title,
            j.description,
            j.error_message,
            j.started_at,
            j.completed_at,
            j.created_at,
            j.cancellable as i64,
        ],
    )?;
    Ok(())
}

pub fn list(conn: &Connection) -> rusqlite::Result<Vec<Job>> {
    let mut stmt =
        conn.prepare(&format!("SELECT {COLS} FROM jobs ORDER BY created_at DESC LIMIT 200"))?;
    let rows = stmt.query_map([], map)?;
    rows.collect()
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Job> {
    conn.query_row(&format!("SELECT {COLS} FROM jobs WHERE id = ?1"), [id], map)
}

pub fn clear_completed(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM jobs WHERE status IN ('completed','failed','cancelled')",
        [],
    )?;
    Ok(())
}
