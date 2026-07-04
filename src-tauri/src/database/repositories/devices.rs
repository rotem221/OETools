use crate::models::{now_iso, DeviceSummary};
use rusqlite::Connection;
use uuid::Uuid;

/// Insert or update a device's known record (upsert on UDID).
pub fn upsert(conn: &Connection, d: &DeviceSummary) -> rusqlite::Result<()> {
    let now = now_iso();
    conn.execute(
        "INSERT INTO devices (id, udid, name, model, product_type, os_version, first_seen_at, last_seen_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
         ON CONFLICT(udid) DO UPDATE SET
            name = ?3, model = ?4, product_type = ?5, os_version = ?6, last_seen_at = ?7",
        rusqlite::params![
            Uuid::new_v4().to_string(),
            d.udid,
            d.name,
            d.model,
            d.product_type,
            d.os_version,
            now,
        ],
    )?;
    Ok(())
}

pub fn touch_backup(conn: &Connection, udid: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE devices SET last_backup_at = ?2 WHERE udid = ?1",
        rusqlite::params![udid, now_iso()],
    )?;
    Ok(())
}

pub fn touch_report(conn: &Connection, udid: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE devices SET last_report_at = ?2 WHERE udid = ?1",
        rusqlite::params![udid, now_iso()],
    )?;
    Ok(())
}

pub fn delete_all(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM devices", [])?;
    Ok(())
}
