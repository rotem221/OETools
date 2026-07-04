//! Read + export Messages (iMessage/SMS) from an **unencrypted** local backup.
//! Opens the backup's `sms.db` read-only; nothing is modified on the backup or
//! device, and no data leaves the machine.

use crate::core::app_state::AppState;
use crate::core::backup_reader;
use crate::core::errors::{envelope, CommandError, CommandResult};
use crate::models::{now_iso, MessageEntry, MessageThread};
use crate::security::path_validation::{validate_existing_path, validate_writable_dir};
use rusqlite::{Connection, OpenFlags};
use tauri::State;
use uuid::Uuid;

/// Convert an Apple/Mac-absolute timestamp (seconds or nanoseconds since
/// 2001-01-01) to an RFC-3339 string.
fn apple_to_rfc3339(raw: i64) -> Option<String> {
    if raw == 0 {
        return None;
    }
    let secs = if raw > 1_000_000_000_000 {
        raw / 1_000_000_000
    } else {
        raw
    };
    chrono::DateTime::from_timestamp(secs + 978_307_200, 0).map(|d| d.to_rfc3339())
}

fn open_sms(path: &str) -> Result<(Connection, std::path::PathBuf), CommandError> {
    let root = validate_existing_path(path)?;
    let root = backup_reader::find_backup_roots(&root, 3)
        .into_iter()
        .next()
        .unwrap_or(root);
    let sms = backup_reader::resolve_named_file(&root, "Library/SMS/sms.db").ok_or_else(|| {
        CommandError::new("No Messages database was found in this backup.")
            .with_fix("The backup may be encrypted or contain no messages.")
    })?;
    let conn = Connection::open_with_flags(&sms, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| CommandError::new("Could not open the Messages database.").with_details(e.to_string()))?;
    Ok((conn, root))
}

#[tauri::command]
pub fn list_conversations(path: String) -> CommandResult<Vec<MessageThread>> {
    envelope((|| {
        let (conn, _) = open_sms(&path)?;
        let mut stmt = conn
            .prepare(
                "SELECT c.ROWID, c.chat_identifier, COALESCE(c.display_name,''), COALESCE(c.service_name,''),
                        COUNT(m.ROWID) AS cnt, MAX(m.date) AS last,
                        (SELECT COALESCE(m2.text,'') FROM message m2
                           JOIN chat_message_join j2 ON j2.message_id = m2.ROWID
                          WHERE j2.chat_id = c.ROWID ORDER BY m2.date DESC LIMIT 1) AS snippet
                   FROM chat c
                   JOIN chat_message_join cmj ON cmj.chat_id = c.ROWID
                   JOIN message m ON m.ROWID = cmj.message_id
                  GROUP BY c.ROWID
                  ORDER BY last DESC",
            )
            .map_err(|e| CommandError::internal(e.to_string()))?;

        let rows = stmt
            .query_map([], |r| {
                let chat_rowid: i64 = r.get(0)?;
                let identifier: String = r.get(1)?;
                let display: String = r.get(2)?;
                let service: String = r.get(3)?;
                let count: i64 = r.get(4)?;
                let last_raw: i64 = r.get::<_, Option<i64>>(5)?.unwrap_or(0);
                let snippet: String = r.get(6)?;
                Ok(MessageThread {
                    chat_id: chat_rowid.to_string(),
                    display_name: if display.is_empty() { identifier.clone() } else { display },
                    handle: identifier,
                    service: if service.is_empty() { "SMS".into() } else { service },
                    message_count: count,
                    last_message_at: apple_to_rfc3339(last_raw),
                    last_snippet: snippet.chars().take(120).collect(),
                })
            })
            .map_err(|e| CommandError::internal(e.to_string()))?;

        Ok(rows.filter_map(|r| r.ok()).collect())
    })())
}

fn chat_id_num(chat_id: &str) -> Result<i64, CommandError> {
    chat_id
        .parse::<i64>()
        .map_err(|_| CommandError::new("Invalid conversation id."))
}

fn read_messages(conn: &Connection, chat_num: i64, limit: i64) -> Result<Vec<MessageEntry>, CommandError> {
    let mut stmt = conn
        .prepare(
            "SELECT m.ROWID, m.is_from_me, COALESCE(m.text,''), m.date, COALESCE(m.service,''),
                    COALESCE(h.id,''),
                    (SELECT COUNT(*) FROM message_attachment_join maj WHERE maj.message_id = m.ROWID) AS att
               FROM message m
               JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
               LEFT JOIN handle h ON h.ROWID = m.handle_id
              WHERE cmj.chat_id = ?1
              ORDER BY m.date ASC
              LIMIT ?2",
        )
        .map_err(|e| CommandError::internal(e.to_string()))?;

    let rows = stmt
        .query_map(rusqlite::params![chat_num, limit], |r| {
            let from_me: i64 = r.get(1)?;
            let text: String = r.get(2)?;
            let date_raw: i64 = r.get::<_, Option<i64>>(3)?.unwrap_or(0);
            let service: String = r.get(4)?;
            let handle: String = r.get(5)?;
            let att: i64 = r.get(6)?;
            Ok(MessageEntry {
                id: r.get::<_, i64>(0)?.to_string(),
                from_me: from_me != 0,
                sender: if from_me != 0 { "Me".into() } else if handle.is_empty() { "Unknown".into() } else { handle },
                text,
                sent_at: apple_to_rfc3339(date_raw),
                service: if service.is_empty() { "SMS".into() } else { service },
                has_attachment: att > 0,
            })
        })
        .map_err(|e| CommandError::internal(e.to_string()))?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
pub fn get_conversation(
    path: String,
    chat_id: String,
    limit: Option<i64>,
) -> CommandResult<Vec<MessageEntry>> {
    envelope((|| {
        let (conn, _) = open_sms(&path)?;
        let chat_num = chat_id_num(&chat_id)?;
        read_messages(&conn, chat_num, limit.unwrap_or(1000))
    })())
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
}

fn render_html(title: &str, msgs: &[MessageEntry]) -> String {
    let mut body = String::new();
    for m in msgs {
        let who = if m.from_me { "me" } else { "them" };
        let att = if m.has_attachment { " 📎" } else { "" };
        body.push_str(&format!(
            "<div class=\"msg {who}\"><div class=\"meta\">{} · {}{}</div><div class=\"text\">{}</div></div>",
            html_escape(&m.sender),
            m.sent_at.clone().unwrap_or_default(),
            att,
            html_escape(if m.text.is_empty() { "(no text / attachment)" } else { &m.text })
        ));
    }
    format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>{t}</title><style>\
body{{font-family:-apple-system,Segoe UI,sans-serif;background:#f4f4f7;margin:0;padding:24px}}\
h1{{font-size:18px}}.msg{{max-width:70%;margin:8px 0;padding:10px 12px;border-radius:12px}}\
.them{{background:#e9e9eb}}.me{{background:#0b7bff;color:#fff;margin-left:auto}}\
.meta{{font-size:11px;opacity:.7;margin-bottom:2px}}</style></head><body><h1>{t}</h1>{body}</body></html>",
        t = html_escape(title)
    )
}

fn render_csv(msgs: &[MessageEntry]) -> String {
    let mut out = String::from("timestamp,direction,sender,service,has_attachment,text\n");
    for m in msgs {
        let text = m.text.replace('"', "\"\"");
        out.push_str(&format!(
            "\"{}\",\"{}\",\"{}\",\"{}\",{},\"{}\"\n",
            m.sent_at.clone().unwrap_or_default(),
            if m.from_me { "outgoing" } else { "incoming" },
            m.sender.replace('"', "\"\""),
            m.service,
            m.has_attachment,
            text
        ));
    }
    out
}

/// Export one conversation (or a title placeholder) to HTML or CSV.
#[tauri::command]
pub fn export_messages(
    state: State<AppState>,
    path: String,
    chat_id: String,
    destination: String,
    format: String,
) -> CommandResult<String> {
    envelope((|| {
        let (conn, _) = open_sms(&path)?;
        let chat_num = chat_id_num(&chat_id)?;
        let dest = validate_writable_dir(&destination)?;
        let msgs = read_messages(&conn, chat_num, 100_000)?;

        let fmt = format.to_ascii_lowercase();
        let (contents, ext) = match fmt.as_str() {
            "csv" => (render_csv(&msgs), "csv"),
            _ => (render_html(&format!("Conversation {chat_id}"), &msgs), "html"),
        };
        let file = dest.join(format!(
            "messages_{}_{}.{}",
            chat_num,
            chrono::Utc::now().format("%Y%m%d_%H%M%S"),
            ext
        ));
        std::fs::write(&file, contents)
            .map_err(|e| CommandError::new("Could not write the export file.").with_details(e.to_string()))?;

        {
            let conn = state.db.conn.lock().unwrap();
            let _ = conn.execute(
                "INSERT INTO message_exports (id, backup_source_id, device_udid, export_type, output_path, message_count, date_from, date_to, evidence_mode, hash_manifest_path, created_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
                rusqlite::params![
                    Uuid::new_v4().to_string(),
                    path,
                    Option::<String>::None,
                    ext,
                    file.to_string_lossy().to_string(),
                    msgs.len() as i64,
                    Option::<String>::None,
                    Option::<String>::None,
                    0i64,
                    Option::<String>::None,
                    now_iso(),
                ],
            );
        }

        Ok(file.to_string_lossy().to_string())
    })())
}
