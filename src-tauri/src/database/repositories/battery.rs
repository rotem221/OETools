use crate::models::{now_iso, BatterySnapshot};
use rusqlite::{Connection, Row};
use uuid::Uuid;

fn map(row: &Row) -> rusqlite::Result<BatterySnapshot> {
    Ok(BatterySnapshot {
        id: row.get(0)?,
        device_udid: row.get(1)?,
        level_percent: row.get(2)?,
        health_percent: row.get(3)?,
        cycle_count: row.get(4)?,
        is_charging: row.get::<_, Option<i64>>(5)?.map(|v| v != 0),
        captured_at: row.get(6)?,
    })
}

const COLS: &str = "id, device_udid, level_percent, health_percent, cycle_count, is_charging, captured_at";

pub fn insert(
    conn: &Connection,
    udid: &str,
    level: Option<i64>,
    health: Option<i64>,
    cycle: Option<i64>,
    charging: Option<bool>,
) -> rusqlite::Result<()> {
    conn.execute(
        &format!("INSERT INTO battery_snapshots ({COLS}) VALUES (?1,?2,?3,?4,?5,?6,?7)"),
        rusqlite::params![
            Uuid::new_v4().to_string(),
            udid,
            level,
            health,
            cycle,
            charging.map(|c| c as i64),
            now_iso(),
        ],
    )?;
    Ok(())
}

pub fn list(conn: &Connection, udid: &str, limit: i64) -> rusqlite::Result<Vec<BatterySnapshot>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLS} FROM battery_snapshots WHERE device_udid = ?1 ORDER BY captured_at ASC LIMIT ?2"
    ))?;
    let rows = stmt.query_map(rusqlite::params![udid, limit], map)?;
    rows.collect()
}

/// Timestamp of the most recent snapshot, used to throttle auto-capture.
pub fn last_captured_at(conn: &Connection, udid: &str) -> Option<String> {
    conn.query_row(
        "SELECT captured_at FROM battery_snapshots WHERE device_udid = ?1 ORDER BY captured_at DESC LIMIT 1",
        [udid],
        |r| r.get(0),
    )
    .ok()
}
