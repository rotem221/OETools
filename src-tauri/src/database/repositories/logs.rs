use crate::models::{now_iso, OperationLog};
use rusqlite::{Connection, Row};
use uuid::Uuid;

const COLS: &str = "id, job_id, device_udid, level, message, technical_details, created_at";

fn map(row: &Row) -> rusqlite::Result<OperationLog> {
    Ok(OperationLog {
        id: row.get(0)?,
        job_id: row.get(1)?,
        device_udid: row.get(2)?,
        level: row.get(3)?,
        message: row.get(4)?,
        technical_details: row.get(5)?,
        created_at: row.get(6)?,
    })
}

pub fn insert(
    conn: &Connection,
    job_id: Option<&str>,
    device_udid: Option<&str>,
    level: &str,
    message: &str,
    technical_details: Option<&str>,
) -> rusqlite::Result<OperationLog> {
    let log = OperationLog {
        id: Uuid::new_v4().to_string(),
        job_id: job_id.map(|s| s.to_string()),
        device_udid: device_udid.map(|s| s.to_string()),
        level: level.to_string(),
        message: message.to_string(),
        technical_details: technical_details.map(|s| s.to_string()),
        created_at: now_iso(),
    };
    conn.execute(
        &format!("INSERT INTO operation_logs ({COLS}) VALUES (?1,?2,?3,?4,?5,?6,?7)"),
        rusqlite::params![
            log.id,
            log.job_id,
            log.device_udid,
            log.level,
            log.message,
            log.technical_details,
            log.created_at,
        ],
    )?;
    Ok(log)
}

pub fn recent(conn: &Connection, udid: Option<&str>, limit: i64) -> rusqlite::Result<Vec<OperationLog>> {
    match udid {
        Some(u) => {
            let mut stmt = conn.prepare(&format!(
                "SELECT {COLS} FROM operation_logs WHERE device_udid = ?1 ORDER BY created_at DESC LIMIT ?2"
            ))?;
            let rows = stmt.query_map(rusqlite::params![u, limit], map)?;
            rows.collect()
        }
        None => {
            let mut stmt = conn.prepare(&format!(
                "SELECT {COLS} FROM operation_logs ORDER BY created_at DESC LIMIT ?1"
            ))?;
            let rows = stmt.query_map([limit], map)?;
            rows.collect()
        }
    }
}

pub fn clear(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM operation_logs", [])?;
    Ok(())
}
