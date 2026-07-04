use crate::models::DependencyInfo;
use rusqlite::Connection;

pub fn save(conn: &Connection, d: &DependencyInfo) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO known_dependencies (id, name, detected, version, path, last_checked_at)
         VALUES (?1,?2,?3,?4,?5,?6)
         ON CONFLICT(id) DO UPDATE SET detected=?3, version=?4, path=?5, last_checked_at=?6",
        rusqlite::params![
            d.id,
            d.name,
            d.detected as i64,
            d.version,
            d.path,
            d.last_checked_at,
        ],
    )?;
    Ok(())
}
