use crate::models::{now_iso, BackupSnapshot, RetentionPolicy};
use rusqlite::{Connection, Row};
use uuid::Uuid;

fn map(row: &Row) -> rusqlite::Result<BackupSnapshot> {
    Ok(BackupSnapshot {
        id: row.get(0)?,
        device_udid: row.get(1)?,
        backup_id: row.get(2)?,
        snapshot_label: row.get(3)?,
        notes: row.get(4)?,
        path: row.get(5)?,
        size_bytes: row.get(6)?,
        encrypted: row.get::<_, i64>(7)? != 0,
        is_protected: row.get::<_, i64>(8)? != 0,
        created_at: row.get(9)?,
        completed_at: row.get(10)?,
        status: row.get(11)?,
        source_type: row.get(12)?,
        os_version: row.get(13)?,
        app_version: row.get(14)?,
        error_message: row.get(15)?,
    })
}

const COLS: &str = "id, device_udid, backup_id, snapshot_label, notes, path, size_bytes, encrypted, is_protected, created_at, completed_at, status, source_type, os_version, app_version, error_message";

pub fn insert(conn: &Connection, s: &BackupSnapshot) -> rusqlite::Result<()> {
    conn.execute(
        &format!(
            "INSERT INTO backup_snapshots ({COLS}) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)"
        ),
        rusqlite::params![
            s.id,
            s.device_udid,
            s.backup_id,
            s.snapshot_label,
            s.notes,
            s.path,
            s.size_bytes,
            s.encrypted as i64,
            s.is_protected as i64,
            s.created_at,
            s.completed_at,
            s.status,
            s.source_type,
            s.os_version,
            s.app_version,
            s.error_message,
        ],
    )?;
    Ok(())
}

pub fn list(conn: &Connection, udid: Option<&str>) -> rusqlite::Result<Vec<BackupSnapshot>> {
    match udid {
        Some(u) => {
            let mut stmt = conn.prepare(&format!(
                "SELECT {COLS} FROM backup_snapshots WHERE device_udid = ?1 ORDER BY created_at DESC"
            ))?;
            let rows = stmt.query_map([u], map)?;
            rows.collect()
        }
        None => {
            let mut stmt = conn.prepare(&format!(
                "SELECT {COLS} FROM backup_snapshots ORDER BY created_at DESC"
            ))?;
            let rows = stmt.query_map([], map)?;
            rows.collect()
        }
    }
}

pub fn count(conn: &Connection, udid: &str) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COUNT(*) FROM backup_snapshots WHERE device_udid = ?1",
        [udid],
        |r| r.get(0),
    )
}

pub fn set_protected(conn: &Connection, id: &str, protected: bool) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE backup_snapshots SET is_protected = ?2 WHERE id = ?1",
        rusqlite::params![id, protected as i64],
    )?;
    Ok(())
}

pub fn update_meta(
    conn: &Connection,
    id: &str,
    label: Option<&str>,
    notes: Option<&str>,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE backup_snapshots SET snapshot_label = ?2, notes = ?3 WHERE id = ?1",
        rusqlite::params![id, label, notes],
    )?;
    Ok(())
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM backup_snapshots WHERE id = ?1 AND is_protected = 0",
        [id],
    )?;
    Ok(())
}

// ---- Retention policies ----

fn map_policy(row: &Row) -> rusqlite::Result<RetentionPolicy> {
    Ok(RetentionPolicy {
        id: row.get(0)?,
        device_udid: row.get(1)?,
        keep_daily_count: row.get(2)?,
        keep_weekly_count: row.get(3)?,
        keep_monthly_count: row.get(4)?,
        max_storage_bytes: row.get(5)?,
        auto_cleanup_enabled: row.get::<_, i64>(6)? != 0,
        protect_first_backup: row.get::<_, i64>(7)? != 0,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

const POLICY_COLS: &str = "id, device_udid, keep_daily_count, keep_weekly_count, keep_monthly_count, max_storage_bytes, auto_cleanup_enabled, protect_first_backup, created_at, updated_at";

/// Fetch the global retention policy (device_udid IS NULL), creating a sensible
/// default the first time it is requested.
pub fn get_global_policy(conn: &Connection) -> rusqlite::Result<RetentionPolicy> {
    let existing = conn
        .query_row(
            &format!("SELECT {POLICY_COLS} FROM backup_retention_policies WHERE device_udid IS NULL"),
            [],
            map_policy,
        )
        .ok();

    if let Some(p) = existing {
        return Ok(p);
    }

    let now = now_iso();
    let policy = RetentionPolicy {
        id: Uuid::new_v4().to_string(),
        device_udid: None,
        keep_daily_count: 7,
        keep_weekly_count: 4,
        keep_monthly_count: 6,
        max_storage_bytes: None,
        auto_cleanup_enabled: false,
        protect_first_backup: true,
        created_at: now.clone(),
        updated_at: now,
    };
    save_policy(conn, &policy)?;
    Ok(policy)
}



pub fn save_policy(conn: &Connection, p: &RetentionPolicy) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO backup_retention_policies (id, device_udid, keep_daily_count, keep_weekly_count, keep_monthly_count, max_storage_bytes, auto_cleanup_enabled, protect_first_backup, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
         ON CONFLICT(id) DO UPDATE SET
            keep_daily_count = ?3, keep_weekly_count = ?4, keep_monthly_count = ?5,
            max_storage_bytes = ?6, auto_cleanup_enabled = ?7, protect_first_backup = ?8,
            updated_at = ?10",
        rusqlite::params![
            p.id,
            p.device_udid,
            p.keep_daily_count,
            p.keep_weekly_count,
            p.keep_monthly_count,
            p.max_storage_bytes,
            p.auto_cleanup_enabled as i64,
            p.protect_first_backup as i64,
            p.created_at,
            p.updated_at,
        ],
    )?;
    Ok(())
}
