use crate::models::Backup;
use rusqlite::{Connection, Row};

fn map(row: &Row) -> rusqlite::Result<Backup> {
    Ok(Backup {
        id: row.get(0)?,
        device_udid: row.get(1)?,
        path: row.get(2)?,
        size_bytes: row.get(3)?,
        encrypted: row.get::<_, i64>(4)? != 0,
        status: row.get(5)?,
        started_at: row.get(6)?,
        completed_at: row.get(7)?,
        error_message: row.get(8)?,
        created_at: row.get(9)?,
    })
}

const COLS: &str = "id, device_udid, path, size_bytes, encrypted, status, started_at, completed_at, error_message, created_at";

pub fn insert(conn: &Connection, b: &Backup) -> rusqlite::Result<()> {
    conn.execute(
        &format!("INSERT INTO backups ({COLS}) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)"),
        rusqlite::params![
            b.id,
            b.device_udid,
            b.path,
            b.size_bytes,
            b.encrypted as i64,
            b.status,
            b.started_at,
            b.completed_at,
            b.error_message,
            b.created_at,
        ],
    )?;
    Ok(())
}

pub fn update_status(
    conn: &Connection,
    id: &str,
    status: &str,
    size_bytes: Option<i64>,
    completed_at: Option<&str>,
    error_message: Option<&str>,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE backups SET status = ?2, size_bytes = COALESCE(?3, size_bytes), completed_at = ?4, error_message = ?5 WHERE id = ?1",
        rusqlite::params![id, status, size_bytes, completed_at, error_message],
    )?;
    Ok(())
}

pub fn list(conn: &Connection, udid: Option<&str>) -> rusqlite::Result<Vec<Backup>> {
    match udid {
        Some(u) => {
            let mut stmt = conn.prepare(&format!(
                "SELECT {COLS} FROM backups WHERE device_udid = ?1 ORDER BY created_at DESC"
            ))?;
            let rows = stmt.query_map([u], map)?;
            rows.collect()
        }
        None => {
            let mut stmt =
                conn.prepare(&format!("SELECT {COLS} FROM backups ORDER BY created_at DESC"))?;
            let rows = stmt.query_map([], map)?;
            rows.collect()
        }
    }
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Backup> {
    conn.query_row(
        &format!("SELECT {COLS} FROM backups WHERE id = ?1"),
        [id],
        map,
    )
}
