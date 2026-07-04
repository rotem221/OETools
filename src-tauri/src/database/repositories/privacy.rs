use rusqlite::Connection;

fn count(conn: &Connection, table: &str) -> i64 {
    conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0))
        .unwrap_or(0)
}

/// Return row counts for each user-data category shown in the Privacy Center.
pub fn counts(conn: &Connection) -> PrivacyCounts {
    PrivacyCounts {
        devices: count(conn, "devices"),
        backups: count(conn, "backups"),
        snapshots: count(conn, "backup_snapshots"),
        reports: count(conn, "reports"),
        logs: count(conn, "operation_logs"),
        jobs: count(conn, "jobs"),
        index_items: count(conn, "backup_index_items"),
        security_scans: count(conn, "security_scans"),
        data_exports: count(conn, "data_exports"),
    }
}

pub struct PrivacyCounts {
    pub devices: i64,
    pub backups: i64,
    pub snapshots: i64,
    pub reports: i64,
    pub logs: i64,
    pub jobs: i64,
    pub index_items: i64,
    pub security_scans: i64,
    pub data_exports: i64,
}

/// Delete all rows for a named privacy category. Returns an error only for
/// unknown categories so callers can surface a clear message.
pub fn delete_category(conn: &Connection, category: &str) -> Result<(), String> {
    let statements: &[&str] = match category {
        "devices" => &["DELETE FROM devices", "DELETE FROM device_assets", "DELETE FROM device_group_members"],
        "backups" => &["DELETE FROM backups", "DELETE FROM backup_snapshots"],
        "snapshots" => &["DELETE FROM backup_snapshots WHERE is_protected = 0"],
        "reports" => &["DELETE FROM reports"],
        "logs" => &["DELETE FROM operation_logs"],
        "jobs" => &["DELETE FROM jobs"],
        "indexes" => &["DELETE FROM backup_index_items", "DELETE FROM backup_sources"],
        "security" => &["DELETE FROM security_findings", "DELETE FROM security_scans"],
        "exports" => &["DELETE FROM data_exports", "DELETE FROM message_exports", "DELETE FROM evidence_exports"],
        _ => return Err(format!("Unknown privacy category: {category}")),
    };
    for sql in statements {
        conn.execute(sql, []).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Wipe all user/device data, keeping only schema. Settings are reset by the
/// caller. Used by the "Delete all app data" action.
pub fn factory_reset(conn: &Connection) -> Result<(), String> {
    const TABLES: &[&str] = &[
        "devices",
        "backups",
        "backup_snapshots",
        "backup_retention_policies",
        "scheduled_backups",
        "backup_sources",
        "backup_index_items",
        "data_exports",
        "message_exports",
        "evidence_exports",
        "transfer_jobs",
        "configuration_profiles",
        "profile_templates",
        "supervision_organizations",
        "supervision_states",
        "device_groups",
        "device_group_members",
        "device_assets",
        "blueprints",
        "blueprint_runs",
        "security_scans",
        "security_findings",
        "reports",
        "operation_logs",
        "jobs",
    ];
    for table in TABLES {
        conn.execute(&format!("DELETE FROM {table}"), [])
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
