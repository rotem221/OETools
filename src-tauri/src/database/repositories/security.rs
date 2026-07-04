use crate::models::{SecurityFinding, SecurityScan};
use rusqlite::{Connection, Row};

fn map_scan(row: &Row) -> rusqlite::Result<SecurityScan> {
    Ok(SecurityScan {
        id: row.get(0)?,
        backup_source_id: row.get(1)?,
        device_udid: row.get(2)?,
        status: row.get(3)?,
        started_at: row.get(4)?,
        completed_at: row.get(5)?,
        risk_level: row.get(6)?,
        findings_count: row.get(7)?,
        report_path: row.get(8)?,
        error_message: row.get(9)?,
    })
}

const SCAN_COLS: &str = "id, backup_source_id, device_udid, status, started_at, completed_at, risk_level, findings_count, report_path, error_message";

pub fn insert_scan(conn: &Connection, s: &SecurityScan) -> rusqlite::Result<()> {
    conn.execute(
        &format!("INSERT INTO security_scans ({SCAN_COLS}) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)"),
        rusqlite::params![
            s.id,
            s.backup_source_id,
            s.device_udid,
            s.status,
            s.started_at,
            s.completed_at,
            s.risk_level,
            s.findings_count,
            s.report_path,
            s.error_message,
        ],
    )?;
    Ok(())
}

pub fn list_scans(conn: &Connection, udid: Option<&str>) -> rusqlite::Result<Vec<SecurityScan>> {
    match udid {
        Some(u) => {
            let mut stmt = conn.prepare(&format!(
                "SELECT {SCAN_COLS} FROM security_scans WHERE device_udid = ?1 ORDER BY started_at DESC"
            ))?;
            let rows = stmt.query_map([u], map_scan)?;
            rows.collect()
        }
        None => {
            let mut stmt = conn.prepare(&format!(
                "SELECT {SCAN_COLS} FROM security_scans ORDER BY started_at DESC"
            ))?;
            let rows = stmt.query_map([], map_scan)?;
            rows.collect()
        }
    }
}

fn map_finding(row: &Row) -> rusqlite::Result<SecurityFinding> {
    Ok(SecurityFinding {
        id: row.get(0)?,
        scan_id: row.get(1)?,
        severity: row.get(2)?,
        category: row.get(3)?,
        title: row.get(4)?,
        description: row.get(5)?,
        evidence: row.get(6)?,
        recommendation: row.get(7)?,
        created_at: row.get(8)?,
    })
}

const FINDING_COLS: &str =
    "id, scan_id, severity, category, title, description, evidence, recommendation, created_at";

pub fn insert_finding(conn: &Connection, f: &SecurityFinding) -> rusqlite::Result<()> {
    conn.execute(
        &format!("INSERT INTO security_findings ({FINDING_COLS}) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)"),
        rusqlite::params![
            f.id,
            f.scan_id,
            f.severity,
            f.category,
            f.title,
            f.description,
            f.evidence,
            f.recommendation,
            f.created_at,
        ],
    )?;
    Ok(())
}

pub fn list_findings(conn: &Connection, scan_id: &str) -> rusqlite::Result<Vec<SecurityFinding>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {FINDING_COLS} FROM security_findings WHERE scan_id = ?1 ORDER BY severity"
    ))?;
    let rows = stmt.query_map([scan_id], map_finding)?;
    rows.collect()
}
