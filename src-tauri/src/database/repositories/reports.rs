use crate::models::Report;
use rusqlite::{Connection, Row};

const COLS: &str = "id, device_udid, report_type, path, format, created_at, summary_json";

fn map(row: &Row) -> rusqlite::Result<Report> {
    Ok(Report {
        id: row.get(0)?,
        device_udid: row.get(1)?,
        report_type: row.get(2)?,
        path: row.get(3)?,
        format: row.get(4)?,
        created_at: row.get(5)?,
        summary_json: row.get(6)?,
    })
}

pub fn insert(conn: &Connection, r: &Report) -> rusqlite::Result<()> {
    conn.execute(
        &format!("INSERT INTO reports ({COLS}) VALUES (?1,?2,?3,?4,?5,?6,?7)"),
        rusqlite::params![
            r.id,
            r.device_udid,
            r.report_type,
            r.path,
            r.format,
            r.created_at,
            r.summary_json,
        ],
    )?;
    Ok(())
}

pub fn list(conn: &Connection, udid: Option<&str>) -> rusqlite::Result<Vec<Report>> {
    match udid {
        Some(u) => {
            let mut stmt = conn.prepare(&format!(
                "SELECT {COLS} FROM reports WHERE device_udid = ?1 ORDER BY created_at DESC"
            ))?;
            let rows = stmt.query_map([u], map)?;
            rows.collect()
        }
        None => {
            let mut stmt =
                conn.prepare(&format!("SELECT {COLS} FROM reports ORDER BY created_at DESC"))?;
            let rows = stmt.query_map([], map)?;
            rows.collect()
        }
    }
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Report> {
    conn.query_row(
        &format!("SELECT {COLS} FROM reports WHERE id = ?1"),
        [id],
        map,
    )
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM reports WHERE id = ?1", [id])?;
    Ok(())
}
