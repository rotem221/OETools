use crate::models::ScheduledBackup;
use rusqlite::{Connection, Row};

fn map(row: &Row) -> rusqlite::Result<ScheduledBackup> {
    Ok(ScheduledBackup {
        id: row.get(0)?,
        device_udid: row.get(1)?,
        enabled: row.get::<_, i64>(2)? != 0,
        schedule_type: row.get(3)?,
        preferred_time: row.get(4)?,
        weekdays_json: row.get(5)?,
        destination_path: row.get(6)?,
        encrypted_preferred: row.get::<_, i64>(7)? != 0,
        last_run_at: row.get(8)?,
        next_run_at: row.get(9)?,
        last_status: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

const COLS: &str = "id, device_udid, enabled, schedule_type, preferred_time, weekdays_json, destination_path, encrypted_preferred, last_run_at, next_run_at, last_status, created_at, updated_at";

pub fn list(conn: &Connection, udid: Option<&str>) -> rusqlite::Result<Vec<ScheduledBackup>> {
    match udid {
        Some(u) => {
            let mut stmt = conn.prepare(&format!(
                "SELECT {COLS} FROM scheduled_backups WHERE device_udid = ?1 ORDER BY created_at DESC"
            ))?;
            let rows = stmt.query_map([u], map)?;
            rows.collect()
        }
        None => {
            let mut stmt = conn.prepare(&format!(
                "SELECT {COLS} FROM scheduled_backups ORDER BY created_at DESC"
            ))?;
            let rows = stmt.query_map([], map)?;
            rows.collect()
        }
    }
}

pub fn upsert(conn: &Connection, s: &ScheduledBackup) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO scheduled_backups (id, device_udid, enabled, schedule_type, preferred_time, weekdays_json, destination_path, encrypted_preferred, last_run_at, next_run_at, last_status, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)
         ON CONFLICT(id) DO UPDATE SET
            enabled = ?3, schedule_type = ?4, preferred_time = ?5, weekdays_json = ?6,
            destination_path = ?7, encrypted_preferred = ?8, last_run_at = ?9,
            next_run_at = ?10, last_status = ?11, updated_at = ?13",
        rusqlite::params![
            s.id,
            s.device_udid,
            s.enabled as i64,
            s.schedule_type,
            s.preferred_time,
            s.weekdays_json,
            s.destination_path,
            s.encrypted_preferred as i64,
            s.last_run_at,
            s.next_run_at,
            s.last_status,
            s.created_at,
            s.updated_at,
        ],
    )?;
    Ok(())
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM scheduled_backups WHERE id = ?1", [id])?;
    Ok(())
}
