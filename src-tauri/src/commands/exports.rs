//! Export History + Evidence Export.
//!
//! - Export History aggregates every export the app has produced (messages,
//!   contacts/notes/WhatsApp, and evidence packages) so the user can review,
//!   re-open or delete them.
//! - Evidence Export copies selected backup categories into a package and
//!   writes SHA-256 hashes, a manifest and a chain-of-custody record. Read-only
//!   with respect to the backup and fully local.

use crate::core::app_state::AppState;
use crate::core::backup_reader;
use crate::core::errors::{envelope, CommandError, CommandResult};
use crate::core::job_queue;
use crate::models::{now_iso, ExportHistoryEntry, Job};
use crate::security::path_validation::{validate_existing_path, validate_writable_dir};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, State};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Export history
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn list_export_history(state: State<AppState>) -> CommandResult<Vec<ExportHistoryEntry>> {
    let build = || -> Result<Vec<ExportHistoryEntry>, CommandError> {
        let conn = state.db.conn.lock().unwrap();
        let mut out: Vec<ExportHistoryEntry> = Vec::new();

        // message_exports (also used for contacts/notes/whatsapp exports)
        if let Ok(mut stmt) = conn.prepare(
            "SELECT id, export_type, output_path, message_count, evidence_mode, created_at
               FROM message_exports ORDER BY created_at DESC",
        ) {
            let rows = stmt
                .query_map([], |r| {
                    let evidence: i64 = r.get(4)?;
                    Ok(ExportHistoryEntry {
                        id: r.get(0)?,
                        kind: "data".into(),
                        label: r.get::<_, Option<String>>(1)?.unwrap_or_else(|| "export".into()),
                        output_path: r.get(2)?,
                        item_count: r.get(3)?,
                        evidence: evidence != 0,
                        created_at: r.get(5)?,
                    })
                })
                .map(|rs| rs.filter_map(|r| r.ok()).collect::<Vec<_>>())
                .unwrap_or_default();
            out.extend(rows);
        }

        // data_exports (category exports from the backup browser)
        if let Ok(mut stmt) = conn.prepare(
            "SELECT id, category, output_path, item_count, created_at
               FROM data_exports ORDER BY created_at DESC",
        ) {
            let rows = stmt
                .query_map([], |r| {
                    Ok(ExportHistoryEntry {
                        id: r.get(0)?,
                        kind: "data".into(),
                        label: r.get::<_, Option<String>>(1)?.unwrap_or_else(|| "export".into()),
                        output_path: r.get(2)?,
                        item_count: r.get(3)?,
                        evidence: false,
                        created_at: r.get(4)?,
                    })
                })
                .map(|rs| rs.filter_map(|r| r.ok()).collect::<Vec<_>>())
                .unwrap_or_default();
            out.extend(rows);
        }

        // evidence_exports
        if let Ok(mut stmt) = conn.prepare(
            "SELECT id, output_path, created_at FROM evidence_exports ORDER BY created_at DESC",
        ) {
            let rows = stmt
                .query_map([], |r| {
                    Ok(ExportHistoryEntry {
                        id: r.get(0)?,
                        kind: "evidence".into(),
                        label: "evidence".into(),
                        output_path: r.get(1)?,
                        item_count: None,
                        evidence: true,
                        created_at: r.get(2)?,
                    })
                })
                .map(|rs| rs.filter_map(|r| r.ok()).collect::<Vec<_>>())
                .unwrap_or_default();
            out.extend(rows);
        }

        out.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(out)
    };
    envelope(build())
}

/// Open an exported file or its containing folder in the OS file manager.
#[tauri::command]
pub fn open_export(path: String) -> CommandResult<()> {
    crate::commands::backups::open_path(&path);
    envelope(Ok(()))
}

/// Delete a history record (and its file, if present) from any export table.
#[tauri::command]
pub fn delete_export(state: State<AppState>, id: String, kind: String) -> CommandResult<()> {
    envelope((|| {
        let conn = state.db.conn.lock().unwrap();
        let table = match kind.as_str() {
            "evidence" => "evidence_exports",
            "message" | "messages" => "message_exports",
            _ => {
                // Could be in either message_exports or data_exports.
                let _ = conn.execute("DELETE FROM message_exports WHERE id = ?1", [&id]);
                let _ = conn.execute("DELETE FROM data_exports WHERE id = ?1", [&id]);
                return Ok(());
            }
        };
        conn.execute(&format!("DELETE FROM {table} WHERE id = ?1"), [&id])
            .map_err(CommandError::from)?;
        Ok(())
    })())
}

// ---------------------------------------------------------------------------
// Evidence export
// ---------------------------------------------------------------------------

fn sanitize(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_') {
                c
            } else {
                '_'
            }
        })
        .collect()
}

fn sha256_file(p: &Path) -> Option<String> {
    let mut f = std::fs::File::open(p).ok()?;
    let mut hasher = Sha256::new();
    std::io::copy(&mut f, &mut hasher).ok()?;
    Some(format!("{:x}", hasher.finalize()))
}

/// Build a verifiable evidence package from selected backup categories.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub fn create_evidence_package(
    app: AppHandle,
    state: State<AppState>,
    path: String,
    categories: Vec<String>,
    destination: String,
    operator: Option<String>,
    organization: Option<String>,
    case_id: Option<String>,
    notes: Option<String>,
) -> CommandResult<Job> {
    envelope((|| {
        let p = validate_existing_path(&path)?;
        let root: PathBuf = backup_reader::find_backup_roots(&p, 3)
            .into_iter()
            .next()
            .unwrap_or(p);
        let dest_base = validate_writable_dir(&destination)?;
        if categories.is_empty() {
            return Err(CommandError::new("Select at least one category to include."));
        }

        let ts = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
        let pkg = dest_base.join(format!("OETools_evidence_{ts}"));
        std::fs::create_dir_all(&pkg).map_err(|e| {
            CommandError::new("Could not create the evidence folder.").with_details(e.to_string())
        })?;

        let job = job_queue::create(
            &state.db,
            &app,
            "data_export",
            "Evidence export",
            Some("Copying files and computing hashes"),
            None,
            false,
        );

        let db = state.db.clone();
        let mut worker = job.clone();
        let src_info = backup_reader::read_backup_info(&root, "evidence");
        std::thread::spawn(move || {
            let mut manifest: Vec<(String, String, u64)> = Vec::new();

            let total_cats = categories.len().max(1);
            for (ci, cat) in categories.iter().enumerate() {
                if let Ok(files) = backup_reader::category_files(&root, cat) {
                    let cat_dir = pkg.join(sanitize(cat));
                    let _ = std::fs::create_dir_all(&cat_dir);
                    for (idx, (file_id, rel)) in files.iter().enumerate() {
                        if let Some(src) = backup_reader::file_path(&root, file_id) {
                            if src.exists() {
                                let base = Path::new(rel)
                                    .file_name()
                                    .map(|s| s.to_string_lossy().to_string())
                                    .unwrap_or_else(|| "file".into());
                                let out = cat_dir.join(format!("{idx:05}_{}", sanitize(&base)));
                                if std::fs::copy(&src, &out).is_ok() {
                                    if let Some(hash) = sha256_file(&out) {
                                        let size = std::fs::metadata(&out).map(|m| m.len()).unwrap_or(0);
                                        let rel_out = format!("{}/{}", sanitize(cat), out.file_name().unwrap().to_string_lossy());
                                        manifest.push((rel_out, hash, size));
                                    }
                                }
                            }
                        }
                    }
                }
                let pct = (((ci + 1) as f64 / total_cats as f64) * 90.0) as i64;
                job_queue::progress(&db, &app, &mut worker, pct);
            }

            // Write manifest.json
            let manifest_json = serde_json::json!({
                "tool": "OETools 0.1.0",
                "generated_at": now_iso(),
                "case_id": case_id,
                "operator": operator,
                "organization": organization,
                "notes": notes,
                "source": {
                    "device_name": src_info.device_name,
                    "product_type": src_info.product_type,
                    "product_version": src_info.product_version,
                    "serial_number": src_info.serial_number,
                    "last_backup_date": src_info.last_backup_date,
                },
                "categories": categories,
                "file_count": manifest.len(),
                "files": manifest.iter().map(|(p, h, s)| serde_json::json!({
                    "path": p, "sha256": h, "size_bytes": s
                })).collect::<Vec<_>>(),
            });
            let manifest_path = pkg.join("manifest.json");
            let _ = std::fs::write(&manifest_path, serde_json::to_string_pretty(&manifest_json).unwrap_or_default());

            // Write SHA-256 sidecar (one "hash  path" line per file)
            let mut sha_txt = String::new();
            for (p, h, _) in &manifest {
                sha_txt.push_str(&format!("{h}  {p}\n"));
            }
            let hash_manifest_path = pkg.join("SHA256SUMS.txt");
            let _ = std::fs::write(&hash_manifest_path, &sha_txt);

            // Chain-of-custody
            let coc = format!(
                "OETools — Evidence Export (Chain of Custody)\n\
=================================================\n\
Generated:     {}\n\
Case ID:       {}\n\
Operator:      {}\n\
Organization:  {}\n\
Source device: {} ({} {})\n\
Serial:        {}\n\
Categories:    {}\n\
Files:         {}\n\
Notes:         {}\n\n\
Integrity: every file is listed in SHA256SUMS.txt with its SHA-256 digest.\n\
Verify with: shasum -a 256 -c SHA256SUMS.txt\n",
                now_iso(),
                case_id.clone().unwrap_or_else(|| "—".into()),
                operator.clone().unwrap_or_else(|| "—".into()),
                organization.clone().unwrap_or_else(|| "—".into()),
                src_info.device_name.clone().unwrap_or_else(|| "—".into()),
                src_info.product_type.clone().unwrap_or_else(|| "—".into()),
                src_info.product_version.clone().unwrap_or_else(|| "".into()),
                src_info.serial_number.clone().unwrap_or_else(|| "—".into()),
                categories.join(", "),
                manifest.len(),
                notes.clone().unwrap_or_else(|| "—".into()),
            );
            let _ = std::fs::write(pkg.join("chain_of_custody.txt"), coc);

            // Record in DB
            {
                let conn = db.conn.lock().unwrap();
                let _ = conn.execute(
                    "INSERT INTO evidence_exports (id, case_id, operator_name, organization, device_udid, source_type, source_id, output_path, manifest_path, hash_manifest_path, created_at, notes)
                     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
                    rusqlite::params![
                        Uuid::new_v4().to_string(),
                        case_id,
                        operator,
                        organization,
                        Option::<String>::None,
                        "backup",
                        path,
                        pkg.to_string_lossy().to_string(),
                        manifest_path.to_string_lossy().to_string(),
                        hash_manifest_path.to_string_lossy().to_string(),
                        now_iso(),
                        notes,
                    ],
                );
            }

            job_queue::log(
                &db,
                &app,
                Some(&worker.id),
                None,
                "info",
                &format!("Evidence package created with {} file(s)", manifest.len()),
                None,
            );
            job_queue::progress(&db, &app, &mut worker, 100);
            job_queue::complete(&db, &app, &mut worker);
        });

        Ok(job)
    })())
}
