use rusqlite::Connection;

/// Ordered list of schema migrations. Each entry is applied once and tracked
/// in the `schema_migrations` table.
const MIGRATIONS: &[(&str, &str)] = &[(
    "0001_initial",
    r#"
    CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        udid TEXT NOT NULL UNIQUE,
        serial_number TEXT,
        name TEXT,
        model TEXT,
        product_type TEXT,
        os_version TEXT,
        first_seen_at TEXT,
        last_seen_at TEXT,
        last_backup_at TEXT,
        last_report_at TEXT,
        notes TEXT
    );

    CREATE TABLE IF NOT EXISTS backups (
        id TEXT PRIMARY KEY,
        device_udid TEXT NOT NULL,
        path TEXT NOT NULL,
        size_bytes INTEGER,
        encrypted INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        device_udid TEXT NOT NULL,
        report_type TEXT NOT NULL,
        path TEXT NOT NULL,
        format TEXT NOT NULL,
        created_at TEXT NOT NULL,
        summary_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        progress INTEGER NOT NULL DEFAULT 0,
        device_udid TEXT,
        title TEXT NOT NULL,
        description TEXT,
        error_message TEXT,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        cancellable INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
        id TEXT PRIMARY KEY,
        job_id TEXT,
        device_udid TEXT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        technical_details TEXT,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS known_dependencies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        detected INTEGER NOT NULL DEFAULT 0,
        version TEXT,
        path TEXT,
        last_checked_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_backups_device ON backups(device_udid);
    CREATE INDEX IF NOT EXISTS idx_reports_device ON reports(device_udid);
    CREATE INDEX IF NOT EXISTS idx_logs_device ON operation_logs(device_udid);
    CREATE INDEX IF NOT EXISTS idx_logs_job ON operation_logs(job_id);
    "#,
),
(
    "0002_expansion",
    r#"
    -- Smart backup snapshots (Time Machine-style history).
    CREATE TABLE IF NOT EXISTS backup_snapshots (
        id TEXT PRIMARY KEY,
        device_udid TEXT NOT NULL,
        backup_id TEXT,
        snapshot_label TEXT,
        notes TEXT,
        path TEXT NOT NULL,
        size_bytes INTEGER,
        encrypted INTEGER NOT NULL DEFAULT 0,
        is_protected INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        status TEXT NOT NULL DEFAULT 'completed',
        source_type TEXT NOT NULL DEFAULT 'usb',
        os_version TEXT,
        app_version TEXT,
        error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS backup_retention_policies (
        id TEXT PRIMARY KEY,
        device_udid TEXT,
        keep_daily_count INTEGER NOT NULL DEFAULT 7,
        keep_weekly_count INTEGER NOT NULL DEFAULT 4,
        keep_monthly_count INTEGER NOT NULL DEFAULT 6,
        max_storage_bytes INTEGER,
        auto_cleanup_enabled INTEGER NOT NULL DEFAULT 0,
        protect_first_backup INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scheduled_backups (
        id TEXT PRIMARY KEY,
        device_udid TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 0,
        schedule_type TEXT NOT NULL DEFAULT 'manual',
        preferred_time TEXT,
        weekdays_json TEXT,
        destination_path TEXT,
        encrypted_preferred INTEGER NOT NULL DEFAULT 0,
        last_run_at TEXT,
        next_run_at TEXT,
        last_status TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    -- Backup browser / extractor.
    CREATE TABLE IF NOT EXISTS backup_sources (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        path TEXT NOT NULL,
        detected_at TEXT,
        last_indexed_at TEXT,
        status TEXT NOT NULL DEFAULT 'detected',
        encrypted INTEGER NOT NULL DEFAULT 0,
        device_udid TEXT
    );

    CREATE TABLE IF NOT EXISTS backup_index_items (
        id TEXT PRIMARY KEY,
        backup_source_id TEXT NOT NULL,
        category TEXT NOT NULL,
        display_name TEXT,
        relative_path TEXT,
        size_bytes INTEGER,
        created_at TEXT,
        modified_at TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}'
    );

    -- Data export center + specialized exports.
    CREATE TABLE IF NOT EXISTS data_exports (
        id TEXT PRIMARY KEY,
        device_udid TEXT,
        source_type TEXT NOT NULL,
        source_id TEXT,
        category TEXT NOT NULL,
        format TEXT NOT NULL,
        output_path TEXT,
        status TEXT NOT NULL DEFAULT 'completed',
        item_count INTEGER,
        created_at TEXT NOT NULL,
        completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS message_exports (
        id TEXT PRIMARY KEY,
        backup_source_id TEXT,
        device_udid TEXT,
        export_type TEXT NOT NULL,
        output_path TEXT,
        message_count INTEGER,
        date_from TEXT,
        date_to TEXT,
        evidence_mode INTEGER NOT NULL DEFAULT 0,
        hash_manifest_path TEXT,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evidence_exports (
        id TEXT PRIMARY KEY,
        case_id TEXT,
        operator_name TEXT,
        organization TEXT,
        device_udid TEXT,
        source_type TEXT,
        source_id TEXT,
        output_path TEXT,
        manifest_path TEXT,
        hash_manifest_path TEXT,
        created_at TEXT NOT NULL,
        notes TEXT
    );

    -- Quick transfer.
    CREATE TABLE IF NOT EXISTS transfer_jobs (
        id TEXT PRIMARY KEY,
        device_udid TEXT NOT NULL,
        source_path TEXT NOT NULL,
        destination_type TEXT NOT NULL,
        destination_app_bundle_id TEXT,
        file_count INTEGER,
        total_size_bytes INTEGER,
        status TEXT NOT NULL DEFAULT 'queued',
        started_at TEXT,
        completed_at TEXT,
        error_message TEXT
    );

    -- Configuration profiles + editor.
    CREATE TABLE IF NOT EXISTS configuration_profiles (
        id TEXT PRIMARY KEY,
        device_udid TEXT NOT NULL,
        name TEXT,
        organization TEXT,
        identifier TEXT,
        profile_type TEXT,
        removable INTEGER NOT NULL DEFAULT 1,
        installed_at TEXT,
        last_seen_at TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS profile_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        payload_type TEXT NOT NULL,
        profile_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    -- Supervision.
    CREATE TABLE IF NOT EXISTS supervision_organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        identifier TEXT,
        certificate_path TEXT,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS supervision_states (
        id TEXT PRIMARY KEY,
        device_udid TEXT NOT NULL,
        supervised INTEGER NOT NULL DEFAULT 0,
        organization_name TEXT,
        last_checked_at TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}'
    );

    -- Fleet / configurator mode.
    CREATE TABLE IF NOT EXISTS device_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS device_group_members (
        group_id TEXT NOT NULL,
        device_udid TEXT NOT NULL,
        PRIMARY KEY (group_id, device_udid)
    );

    CREATE TABLE IF NOT EXISTS device_assets (
        id TEXT PRIMARY KEY,
        device_udid TEXT NOT NULL,
        employee_name TEXT,
        department TEXT,
        location TEXT,
        asset_tag TEXT,
        notes TEXT,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blueprints (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        blueprint_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blueprint_runs (
        id TEXT PRIMARY KEY,
        blueprint_id TEXT NOT NULL,
        device_udid TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        started_at TEXT,
        completed_at TEXT,
        error_message TEXT
    );

    -- Security analyzer.
    CREATE TABLE IF NOT EXISTS security_scans (
        id TEXT PRIMARY KEY,
        backup_source_id TEXT,
        device_udid TEXT,
        status TEXT NOT NULL DEFAULT 'completed',
        started_at TEXT,
        completed_at TEXT,
        risk_level TEXT,
        findings_count INTEGER NOT NULL DEFAULT 0,
        report_path TEXT,
        error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS security_findings (
        id TEXT PRIMARY KEY,
        scan_id TEXT NOT NULL,
        severity TEXT NOT NULL,
        category TEXT,
        title TEXT NOT NULL,
        description TEXT,
        evidence TEXT,
        recommendation TEXT,
        created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_snapshots_device ON backup_snapshots(device_udid);
    CREATE INDEX IF NOT EXISTS idx_schedules_device ON scheduled_backups(device_udid);
    CREATE INDEX IF NOT EXISTS idx_index_items_source ON backup_index_items(backup_source_id);
    CREATE INDEX IF NOT EXISTS idx_findings_scan ON security_findings(scan_id);
    CREATE INDEX IF NOT EXISTS idx_profiles_device ON configuration_profiles(device_udid);
    CREATE INDEX IF NOT EXISTS idx_assets_device ON device_assets(device_udid);
    "#,
),
(
    "0003_battery_history",
    r#"
    -- Local battery health/level snapshots for trend charts.
    CREATE TABLE IF NOT EXISTS battery_snapshots (
        id TEXT PRIMARY KEY,
        device_udid TEXT NOT NULL,
        level_percent INTEGER,
        health_percent INTEGER,
        cycle_count INTEGER,
        is_charging INTEGER,
        captured_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_battery_device ON battery_snapshots(device_udid);
    "#,
)];

pub fn run_migrations(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            name TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL
        );",
    )?;

    for (name, sql) in MIGRATIONS {
        let applied: bool = conn
            .query_row(
                "SELECT 1 FROM schema_migrations WHERE name = ?1",
                [name],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if !applied {
            conn.execute_batch(sql)?;
            conn.execute(
                "INSERT INTO schema_migrations (name, applied_at) VALUES (?1, ?2)",
                rusqlite::params![name, chrono::Utc::now().to_rfc3339()],
            )?;
        }
    }
    Ok(())
}
