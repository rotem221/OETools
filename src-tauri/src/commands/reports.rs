use crate::core::app_state::AppState;
use crate::core::errors::{envelope, CommandError, CommandResult};
use crate::core::filesystem;
use crate::database::repositories::{devices as devices_repo, reports as reports_repo, settings as settings_repo};
use crate::models::{now_iso, DeviceInfo, Report};
use crate::security::path_validation::sanitize_identifier;
use serde_json::json;
use std::io::Write;
use tauri::State;
use uuid::Uuid;

fn report_title(report_type: &str) -> &str {
    match report_type {
        "basic" => "Basic Device Report",
        "technical" => "Technical Device Report",
        "pre_service" => "Pre-Service Report",
        "backup_summary" => "Backup Summary Report",
        _ => "Device Report",
    }
}

#[tauri::command]
pub fn generate_report(
    state: State<AppState>,
    udid: String,
    report_type: String,
    notes: String,
) -> CommandResult<Report> {
    envelope((|| {
        let udid = sanitize_identifier(&udid)?;
        if notes.len() > 4000 {
            return Err(CommandError::new("Notes are too long."));
        }

        let info = state.bridge().get_device_info(&udid)?;
        let settings = {
            let conn = state.db.conn.lock().unwrap();
            settings_repo::get(&conn)
        };

        let dir = filesystem::resolve(&settings.reports_folder);
        std::fs::create_dir_all(&dir)
            .map_err(|_| CommandError::folder_not_writable(&dir.display().to_string()))?;

        let ts = chrono::Utc::now().format("%Y-%m-%d_%H%M%S").to_string();
        let file_name = format!("{report_type}-{ts}.html");
        let path = dir.join(&file_name);

        let summary = json!({
            "device": info.name,
            "model": info.model,
            "os_version": info.os_version,
            "udid": info.udid,
        });

        let html = render_html(&report_type, &info, &notes);
        let mut file = std::fs::File::create(&path)
            .map_err(|_| CommandError::folder_not_writable(&path.display().to_string()))?;
        file.write_all(html.as_bytes())
            .map_err(CommandError::from)?;

        let report = Report {
            id: Uuid::new_v4().to_string(),
            device_udid: udid.clone(),
            report_type: report_type.clone(),
            path: path.display().to_string(),
            format: "html".into(),
            created_at: now_iso(),
            summary_json: summary.to_string(),
        };
        {
            let conn = state.db.conn.lock().unwrap();
            reports_repo::insert(&conn, &report)?;
            let _ = devices_repo::touch_report(&conn, &udid);
        }
        Ok(report)
    })())
}

fn render_html(report_type: &str, info: &DeviceInfo, notes: &str) -> String {
    let title = report_title(report_type);
    let fmt_bytes = |b: Option<i64>| {
        b.map(|v| format!("{:.1} GB", v as f64 / 1_073_741_824.0))
            .unwrap_or_else(|| "N/A".into())
    };
    let row = |k: &str, v: &str| format!("<tr><td class=\"k\">{k}</td><td>{v}</td></tr>");
    let notes_html = if notes.trim().is_empty() {
        String::new()
    } else {
        format!(
            "<h2>Notes</h2><p class=\"notes\">{}</p>",
            html_escape(notes)
        )
    };

    format!(
        r#"<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>{title}</title>
<style>
  :root {{ color-scheme: light; }}
  body {{ font-family: -apple-system, Segoe UI, Roboto, sans-serif; color:#111; margin:0; padding:40px; background:#f7f8fa; }}
  .wrap {{ max-width:760px; margin:0 auto; background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:32px; }}
  h1 {{ font-size:22px; margin:0 0 4px; }}
  .sub {{ color:#6b7280; font-size:13px; margin-bottom:24px; }}
  h2 {{ font-size:15px; margin:24px 0 8px; border-bottom:1px solid #eee; padding-bottom:6px; }}
  table {{ width:100%; border-collapse:collapse; font-size:13px; }}
  td {{ padding:6px 8px; border-bottom:1px solid #f0f0f0; }}
  td.k {{ color:#6b7280; width:220px; }}
  .notes {{ font-size:13px; white-space:pre-wrap; background:#f9fafb; padding:12px; border-radius:8px; }}
  .footer {{ margin-top:28px; color:#9ca3af; font-size:11px; }}
  .badge {{ display:inline-block; background:#eef2ff; color:#4338ca; padding:2px 8px; border-radius:999px; font-size:11px; }}
  @media print {{ body {{ background:#fff; padding:0; }} .wrap {{ border:0; }} }}
</style></head><body><div class="wrap">
<h1>{title}</h1>
<div class="sub">OETools (Or Eliav Tools) · Generated {generated} · <span class="badge">Safe data only</span></div>

<h2>Device</h2>
<table>
{r_name}{r_model}{r_type}{r_os}{r_build}{r_serial}{r_udid}{r_activation}
</table>

<h2>Storage</h2>
<table>{r_total}{r_used}{r_free}</table>

<h2>Battery</h2>
<table>{r_batt}{r_health}{r_cycles}</table>

{notes_html}

<div class="footer">OETools v0.1.0 — local-first, privacy-first. No device data leaves this computer. This report contains only non-sensitive device information.</div>
</div></body></html>"#,
        title = title,
        generated = now_iso(),
        r_name = row("Name", &html_escape(&info.name)),
        r_model = row("Model", &html_escape(&info.model)),
        r_type = row("Product type", &html_escape(&info.product_type)),
        r_os = row("iOS / iPadOS", &html_escape(&info.os_version)),
        r_build = row("Build", info.build_version.as_deref().unwrap_or("N/A")),
        r_serial = row("Serial number", &html_escape(&info.serial_number)),
        r_udid = row("UDID", &html_escape(&info.udid)),
        r_activation = row("Activation", info.activation_state.as_deref().unwrap_or("N/A")),
        r_total = row("Total", &fmt_bytes(info.storage.total_bytes)),
        r_used = row("Used", &fmt_bytes(info.storage.used_bytes)),
        r_free = row("Free", &fmt_bytes(info.storage.free_bytes)),
        r_batt = row(
            "Level",
            &info.battery.level_percent.map(|v| format!("{v}%")).unwrap_or_else(|| "N/A".into())
        ),
        r_health = row(
            "Health",
            &info.battery.health_percent.map(|v| format!("{v}%")).unwrap_or_else(|| "N/A".into())
        ),
        r_cycles = row(
            "Cycles",
            &info.battery.cycle_count.map(|v| v.to_string()).unwrap_or_else(|| "N/A".into())
        ),
        notes_html = notes_html,
    )
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[tauri::command]
pub fn list_reports(state: State<AppState>, udid: Option<String>) -> CommandResult<Vec<Report>> {
    let conn = state.db.conn.lock().unwrap();
    envelope(reports_repo::list(&conn, udid.as_deref()).map_err(CommandError::from))
}

#[tauri::command]
pub fn open_report(state: State<AppState>, id: String) -> CommandResult<()> {
    envelope((|| {
        let report = {
            let conn = state.db.conn.lock().unwrap();
            reports_repo::get(&conn, &id).map_err(|_| CommandError::new("Report not found."))?
        };
        crate::commands::backups::open_path(&report.path);
        Ok(())
    })())
}

#[tauri::command]
pub fn delete_report(state: State<AppState>, id: String) -> CommandResult<()> {
    let report = {
        let conn = state.db.conn.lock().unwrap();
        reports_repo::get(&conn, &id).ok()
    };
    if let Some(r) = report {
        let _ = std::fs::remove_file(filesystem::resolve(&r.path));
    }
    let conn = state.db.conn.lock().unwrap();
    envelope(reports_repo::delete(&conn, &id).map_err(CommandError::from))
}
