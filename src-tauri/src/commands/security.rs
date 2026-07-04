//! Security / spyware analyzer. Performs a **local, read-only** inspection of an
//! unencrypted iOS backup, looking for well-understood risk signals: jailbreak
//! artifacts, installed configuration/MDM profiles, backup-encryption status,
//! and (optionally) matches against a user-maintained local IOC domain feed.
//!
//! This is a triage aid, not a definitive malware verdict. It never contacts
//! any network and never modifies the backup or device.

use crate::core::app_state::AppState;
use crate::core::backup_reader;
use crate::core::errors::{envelope, CommandError, CommandResult};
use crate::core::filesystem;
use crate::database::repositories::security as security_repo;
use crate::models::{now_iso, SecurityFinding, SecurityScan};
use crate::security::path_validation::validate_existing_path;
use rusqlite::{Connection, OpenFlags};
use std::path::Path;
use tauri::State;
use uuid::Uuid;

fn severity_rank(s: &str) -> i32 {
    match s {
        "high" => 4,
        "medium" => 3,
        "low" => 2,
        "info" => 1,
        _ => 0,
    }
}

fn finding(scan_id: &str, severity: &str, category: &str, title: &str, desc: &str, evidence: Option<String>, rec: &str) -> SecurityFinding {
    SecurityFinding {
        id: Uuid::new_v4().to_string(),
        scan_id: scan_id.to_string(),
        severity: severity.to_string(),
        category: Some(category.to_string()),
        title: title.to_string(),
        description: Some(desc.to_string()),
        evidence,
        recommendation: Some(rec.to_string()),
        created_at: now_iso(),
    }
}

fn count_where(conn: &Connection, predicate: &str) -> i64 {
    conn.query_row(&format!("SELECT COUNT(*) FROM Files WHERE ({predicate})"), [], |r| r.get(0))
        .unwrap_or(0)
}

/// Load a local IOC domain feed (one domain per line) if the user provides one
/// at `<app_data>/ioc/domains.txt`.
fn load_ioc_feed() -> Vec<String> {
    let p = filesystem::app_data_dir().join("ioc").join("domains.txt");
    std::fs::read_to_string(p)
        .map(|s| {
            s.lines()
                .map(|l| l.trim().to_ascii_lowercase())
                .filter(|l| !l.is_empty() && !l.starts_with('#'))
                .collect()
        })
        .unwrap_or_default()
}

fn scan_safari_for_iocs(root: &Path, iocs: &[String]) -> Vec<String> {
    let mut hits = Vec::new();
    if iocs.is_empty() {
        return hits;
    }
    let Some(hist) = backup_reader::resolve_named_file(root, "Library/Safari/History.db") else {
        return hits;
    };
    let Ok(conn) = Connection::open_with_flags(&hist, OpenFlags::SQLITE_OPEN_READ_ONLY) else {
        return hits;
    };
    if let Ok(mut stmt) = conn.prepare("SELECT url FROM history_items") {
        if let Ok(rows) = stmt.query_map([], |r| r.get::<_, String>(0)) {
            for url in rows.flatten() {
                let low = url.to_ascii_lowercase();
                for ioc in iocs {
                    if low.contains(ioc) {
                        hits.push(url.clone());
                    }
                }
            }
        }
    }
    hits
}

fn run_scan(root: &Path) -> Result<(String, Vec<SecurityFinding>), CommandError> {
    let scan_id = Uuid::new_v4().to_string();
    let mut findings = Vec::new();

    let info = backup_reader::read_backup_info(root, "");

    // Encrypted backups: we can only report metadata.
    if info.encrypted {
        findings.push(finding(
            &scan_id,
            "info",
            "encryption",
            "Backup is encrypted",
            "This backup is encrypted, which is good for confidentiality. Its contents can't be scanned without the password.",
            None,
            "To scan contents, create an unencrypted backup or provide the password (future feature).",
        ));
        return Ok((scan_id, findings));
    }

    let conn = backup_reader::open_manifest(root)?;

    // 1. Jailbreak artifacts.
    let jb = count_where(
        &conn,
        "domain LIKE '%Cydia%' OR domain LIKE '%sileo%' OR relativePath LIKE '%Cydia%' \
         OR relativePath LIKE '%unc0ver%' OR relativePath LIKE '%checkra1n%' OR relativePath LIKE '%/Zebra%'",
    );
    if jb > 0 {
        findings.push(finding(
            &scan_id,
            "high",
            "jailbreak",
            "Jailbreak artifacts detected",
            "Files associated with jailbreak tools (Cydia/Sileo/unc0ver/checkra1n) were found. A jailbroken device has a substantially larger attack surface.",
            Some(format!("{jb} matching file(s) in the backup index")),
            "Consider restoring the device to a clean iOS install if the jailbreak was not intentional.",
        ));
    }

    // 2. Configuration / MDM profiles.
    let profiles = count_where(
        &conn,
        "relativePath LIKE '%ConfigurationProfiles%' OR domain LIKE '%ManagedConfiguration%'",
    );
    if profiles > 0 {
        findings.push(finding(
            &scan_id,
            "medium",
            "profiles",
            "Configuration profiles present",
            "One or more configuration/MDM profiles are installed. These can be legitimate (work/school) but are also a common surveillance vector.",
            Some(format!("{profiles} profile-related file(s)")),
            "Review installed profiles on the device under Settings → General → VPN & Device Management and remove any you don't recognize.",
        ));
    }

    // 3. Encryption recommendation.
    findings.push(finding(
        &scan_id,
        "info",
        "encryption",
        "Backup is not encrypted",
        "This backup is unencrypted, so anyone with file access can read its contents.",
        None,
        "Enable encrypted backups to protect sensitive data (Health, Keychain, saved passwords).",
    ));

    // 4. IOC feed matching (optional, user-provided).
    let iocs = load_ioc_feed();
    if iocs.is_empty() {
        findings.push(finding(
            &scan_id,
            "info",
            "ioc",
            "No IOC feed configured",
            "No local indicator-of-compromise feed was found, so URL matching was skipped.",
            None,
            "Add domains (one per line) to <app data>/ioc/domains.txt to enable Safari-history IOC matching.",
        ));
    } else {
        let hits = scan_safari_for_iocs(root, &iocs);
        if hits.is_empty() {
            findings.push(finding(
                &scan_id,
                "info",
                "ioc",
                "No IOC matches in Safari history",
                &format!("Checked Safari history against {} indicator(s); no matches.", iocs.len()),
                None,
                "Keep your IOC feed up to date.",
            ));
        } else {
            let sample: Vec<String> = hits.iter().take(10).cloned().collect();
            findings.push(finding(
                &scan_id,
                "high",
                "ioc",
                "Known malicious domains in Safari history",
                "Safari history contains URLs matching your local IOC feed.",
                Some(sample.join("\n")),
                "Investigate these visits. Consider a full forensic analysis (e.g. Amnesty MVT).",
            ));
        }
    }

    Ok((scan_id, findings))
}

#[tauri::command]
pub fn run_security_scan(
    state: State<AppState>,
    path: String,
    udid: Option<String>,
) -> CommandResult<SecurityScan> {
    envelope((|| {
        let p = validate_existing_path(&path)?;
        let root = backup_reader::find_backup_roots(&p, 3)
            .into_iter()
            .next()
            .ok_or_else(|| CommandError::new("No iOS backup was found in that folder."))?;

        let started = now_iso();
        let (scan_id, findings) = run_scan(&root)?;

        let risk = findings
            .iter()
            .map(|f| f.severity.as_str())
            .max_by_key(|s| severity_rank(s))
            .unwrap_or("clean")
            .to_string();

        let scan = SecurityScan {
            id: scan_id,
            backup_source_id: Some(root.to_string_lossy().to_string()),
            device_udid: udid,
            status: "completed".into(),
            started_at: Some(started),
            completed_at: Some(now_iso()),
            risk_level: Some(risk),
            findings_count: findings.len() as i64,
            report_path: None,
            error_message: None,
        };

        {
            let conn = state.db.conn.lock().unwrap();
            security_repo::insert_scan(&conn, &scan)?;
            for f in &findings {
                security_repo::insert_finding(&conn, f)?;
            }
        }

        Ok(scan)
    })())
}

#[tauri::command]
pub fn list_security_scans(
    state: State<AppState>,
    udid: Option<String>,
) -> CommandResult<Vec<SecurityScan>> {
    let conn = state.db.conn.lock().unwrap();
    envelope(security_repo::list_scans(&conn, udid.as_deref()).map_err(CommandError::from))
}

#[tauri::command]
pub fn get_scan_findings(
    state: State<AppState>,
    scan_id: String,
) -> CommandResult<Vec<SecurityFinding>> {
    let conn = state.db.conn.lock().unwrap();
    envelope(security_repo::list_findings(&conn, &scan_id).map_err(CommandError::from))
}
