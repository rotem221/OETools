//! Read + export personal data (Contacts, Notes, WhatsApp) from an
//! **unencrypted** local iOS backup, plus an "export everything" bundler.
//!
//! Everything here is read-only with respect to the backup and fully local:
//! databases are opened read-only, nothing is uploaded, and only a
//! user-selected destination folder is written to.

use crate::core::app_state::AppState;
use crate::core::backup_reader;
use crate::core::errors::{envelope, CommandError, CommandResult};
use crate::core::job_queue;
use crate::models::{now_iso, ContactEntry, Job, MessageEntry, MessageThread, NoteEntry};
use crate::security::path_validation::{validate_existing_path, validate_writable_dir};
use rusqlite::{Connection, OpenFlags};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, State};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/// Resolve the backup root from a user-selected folder.
fn backup_root(path: &str) -> Result<PathBuf, CommandError> {
    let p = validate_existing_path(path)?;
    Ok(backup_reader::find_backup_roots(&p, 3)
        .into_iter()
        .next()
        .unwrap_or(p))
}

/// Open a named SQLite database inside the backup read-only. Tries each
/// candidate relative path until one resolves.
fn open_named_db(root: &Path, candidates: &[&str], what: &str) -> Result<Connection, CommandError> {
    for rel in candidates {
        if let Some(p) = backup_reader::resolve_named_file(root, rel) {
            return Connection::open_with_flags(&p, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(|e| {
                CommandError::new(format!("Could not open the {what} database."))
                    .with_details(e.to_string())
            });
        }
    }
    Err(
        CommandError::new(format!("No {what} data was found in this backup."))
            .with_fix("The backup may be encrypted, from a different iOS version, or contain no such data."),
    )
}

/// Convert a Core Data / Apple-absolute timestamp (seconds since 2001-01-01)
/// to RFC-3339. Accepts seconds or nanoseconds.
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

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn csv_cell(s: &str) -> String {
    format!("\"{}\"", s.replace('"', "\"\""))
}

fn timestamped(dir: &Path, stem: &str, ext: &str) -> PathBuf {
    dir.join(format!(
        "{stem}_{}.{ext}",
        chrono::Utc::now().format("%Y%m%d_%H%M%S")
    ))
}

fn record_export(state: &State<AppState>, source: &str, kind: &str, file: &Path, count: i64) {
    let conn = state.db.conn.lock().unwrap();
    let _ = conn.execute(
        "INSERT INTO message_exports (id, backup_source_id, device_udid, export_type, output_path, message_count, date_from, date_to, evidence_mode, hash_manifest_path, created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
        rusqlite::params![
            Uuid::new_v4().to_string(),
            source,
            Option::<String>::None,
            kind,
            file.to_string_lossy().to_string(),
            count,
            Option::<String>::None,
            Option::<String>::None,
            0i64,
            Option::<String>::None,
            now_iso(),
        ],
    );
}

// ---------------------------------------------------------------------------
// Contacts (AddressBook.sqlitedb)
// ---------------------------------------------------------------------------

fn open_addressbook(root: &Path) -> Result<Connection, CommandError> {
    open_named_db(
        root,
        &["Library/AddressBook/AddressBook.sqlitedb"],
        "Contacts",
    )
}

fn read_contacts(conn: &Connection) -> Result<Vec<ContactEntry>, CommandError> {
    // ABMultiValue.property: 3 = phone, 4 = email (iOS AddressBook schema).
    let mut stmt = conn
        .prepare(
            "SELECT p.ROWID, COALESCE(p.First,''), COALESCE(p.Last,''), COALESCE(p.Organization,'')
               FROM ABPerson p ORDER BY p.Last, p.First",
        )
        .map_err(|e| CommandError::internal(e.to_string()))?;

    let people: Vec<(i64, String, String, String)> = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
            ))
        })
        .map_err(|e| CommandError::internal(e.to_string()))?
        .filter_map(|r| r.ok())
        .collect();

    let mut mv = conn
        .prepare("SELECT value FROM ABMultiValue WHERE record_id = ?1 AND property = ?2 AND value IS NOT NULL")
        .map_err(|e| CommandError::internal(e.to_string()))?;

    let mut out = Vec::with_capacity(people.len());
    for (rowid, first, last, org) in people {
        let collect = |prop: i64, stmt: &mut rusqlite::Statement| -> Vec<String> {
            stmt.query_map(rusqlite::params![rowid, prop], |r| r.get::<_, String>(0))
                .map(|rows| rows.filter_map(|r| r.ok()).collect())
                .unwrap_or_default()
        };
        let phones = collect(3, &mut mv);
        let emails = collect(4, &mut mv);
        let name = format!("{first} {last}").trim().to_string();
        let name = if name.is_empty() {
            if !org.is_empty() {
                org.clone()
            } else if let Some(p) = phones.first() {
                p.clone()
            } else {
                "(no name)".to_string()
            }
        } else {
            name
        };
        out.push(ContactEntry {
            id: rowid.to_string(),
            name,
            organization: if org.is_empty() { None } else { Some(org) },
            phones,
            emails,
        });
    }
    Ok(out)
}

#[tauri::command]
pub fn list_contacts(path: String) -> CommandResult<Vec<ContactEntry>> {
    envelope((|| {
        let root = backup_root(&path)?;
        let conn = open_addressbook(&root)?;
        read_contacts(&conn)
    })())
}

fn render_vcard(contacts: &[ContactEntry]) -> String {
    let mut out = String::new();
    for c in contacts {
        out.push_str("BEGIN:VCARD\r\nVERSION:3.0\r\n");
        out.push_str(&format!("FN:{}\r\n", c.name));
        if let Some(org) = &c.organization {
            out.push_str(&format!("ORG:{org}\r\n"));
        }
        for p in &c.phones {
            out.push_str(&format!("TEL:{p}\r\n"));
        }
        for e in &c.emails {
            out.push_str(&format!("EMAIL:{e}\r\n"));
        }
        out.push_str("END:VCARD\r\n");
    }
    out
}

fn render_contacts_csv(contacts: &[ContactEntry]) -> String {
    let mut out = String::from("name,organization,phones,emails\n");
    for c in contacts {
        out.push_str(&format!(
            "{},{},{},{}\n",
            csv_cell(&c.name),
            csv_cell(c.organization.as_deref().unwrap_or("")),
            csv_cell(&c.phones.join("; ")),
            csv_cell(&c.emails.join("; ")),
        ));
    }
    out
}

#[tauri::command]
pub fn export_contacts(
    state: State<AppState>,
    path: String,
    destination: String,
    format: String,
) -> CommandResult<String> {
    envelope((|| {
        let root = backup_root(&path)?;
        let dest = validate_writable_dir(&destination)?;
        let conn = open_addressbook(&root)?;
        let contacts = read_contacts(&conn)?;
        let (contents, ext) = match format.to_ascii_lowercase().as_str() {
            "csv" => (render_contacts_csv(&contacts), "csv"),
            _ => (render_vcard(&contacts), "vcf"),
        };
        let file = timestamped(&dest, "contacts", ext);
        std::fs::write(&file, contents).map_err(|e| {
            CommandError::new("Could not write the contacts file.").with_details(e.to_string())
        })?;
        record_export(&state, &path, "contacts", &file, contacts.len() as i64);
        Ok(file.to_string_lossy().to_string())
    })())
}

// ---------------------------------------------------------------------------
// Notes (NoteStore.sqlite — modern Core Data + gzip/protobuf bodies)
// ---------------------------------------------------------------------------

fn open_notestore(root: &Path) -> Result<Connection, CommandError> {
    open_named_db(
        root,
        &["NoteStore.sqlite", "Library/Notes/notes.sqlite"],
        "Notes",
    )
}

fn read_varint(buf: &[u8]) -> Option<(u64, usize)> {
    let mut result: u64 = 0;
    let mut shift = 0;
    for (i, b) in buf.iter().enumerate() {
        result |= ((b & 0x7f) as u64) << shift;
        if b & 0x80 == 0 {
            return Some((result, i + 1));
        }
        shift += 7;
        if shift >= 64 {
            return None;
        }
    }
    None
}

/// Return the bytes of the first length-delimited (wire type 2) field with the
/// given number in a protobuf message.
fn pb_field(buf: &[u8], field: u64) -> Option<&[u8]> {
    let mut i = 0;
    while i < buf.len() {
        let (tag, n) = read_varint(&buf[i..])?;
        i += n;
        let fnum = tag >> 3;
        let wtype = tag & 7;
        match wtype {
            0 => {
                let (_, n) = read_varint(&buf[i..])?;
                i += n;
            }
            2 => {
                let (len, n) = read_varint(&buf[i..])?;
                i += n;
                let len = len as usize;
                if i + len > buf.len() {
                    return None;
                }
                if fnum == field {
                    return Some(&buf[i..i + len]);
                }
                i += len;
            }
            5 => i += 4,
            1 => i += 8,
            _ => return None,
        }
    }
    None
}

/// Decompress an Apple Notes body blob (gzip) and extract the note text from
/// the embedded protobuf (NoteStoreProto → Document → Note → note_text).
fn decode_note_body(data: &[u8]) -> Option<String> {
    use flate2::read::GzDecoder;
    use std::io::Read;
    let mut d = GzDecoder::new(data);
    let mut out = Vec::new();
    d.read_to_end(&mut out).ok()?;
    let document = pb_field(&out, 2)?;
    let note = pb_field(document, 3)?;
    let text = pb_field(note, 2)?;
    let s = String::from_utf8_lossy(text).to_string();
    let trimmed = s.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn read_notes(conn: &Connection, with_body: bool) -> Result<Vec<NoteEntry>, CommandError> {
    let mut stmt = conn
        .prepare(
            "SELECT Z_PK, COALESCE(ZTITLE1,''), COALESCE(ZSNIPPET,''), ZMODIFICATIONDATE1
               FROM ZICCLOUDSYNCINGOBJECT
              WHERE ZTITLE1 IS NOT NULL AND (ZMARKEDFORDELETION IS NULL OR ZMARKEDFORDELETION = 0)
              ORDER BY ZMODIFICATIONDATE1 DESC",
        )
        .map_err(|e| {
            CommandError::new("This backup's Notes database uses an unsupported format.")
                .with_details(e.to_string())
        })?;

    let base: Vec<(i64, String, String, Option<f64>)> = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, Option<f64>>(3)?,
            ))
        })
        .map_err(|e| CommandError::internal(e.to_string()))?
        .filter_map(|r| r.ok())
        .collect();

    let mut out = Vec::with_capacity(base.len());
    for (pk, title, snippet, mdate) in base {
        let body = if with_body {
            conn.query_row(
                "SELECT ZDATA FROM ZICNOTEDATA WHERE ZNOTE = ?1",
                rusqlite::params![pk],
                |r| r.get::<_, Vec<u8>>(0),
            )
            .ok()
            .and_then(|blob| decode_note_body(&blob))
        } else {
            None
        };
        out.push(NoteEntry {
            id: pk.to_string(),
            title,
            snippet,
            folder: None,
            modified_at: mdate.map(|d| d as i64).and_then(apple_to_rfc3339),
            body,
        });
    }
    Ok(out)
}

#[tauri::command]
pub fn list_notes(path: String) -> CommandResult<Vec<NoteEntry>> {
    envelope((|| {
        let root = backup_root(&path)?;
        let conn = open_notestore(&root)?;
        read_notes(&conn, false)
    })())
}

#[tauri::command]
pub fn get_note(path: String, note_id: String) -> CommandResult<NoteEntry> {
    envelope((|| {
        let root = backup_root(&path)?;
        let conn = open_notestore(&root)?;
        let pk: i64 = note_id
            .parse()
            .map_err(|_| CommandError::new("Invalid note id."))?;
        let title: String = conn
            .query_row(
                "SELECT COALESCE(ZTITLE1,'') FROM ZICCLOUDSYNCINGOBJECT WHERE Z_PK = ?1",
                rusqlite::params![pk],
                |r| r.get(0),
            )
            .unwrap_or_default();
        let body = conn
            .query_row(
                "SELECT ZDATA FROM ZICNOTEDATA WHERE ZNOTE = ?1",
                rusqlite::params![pk],
                |r| r.get::<_, Vec<u8>>(0),
            )
            .ok()
            .and_then(|blob| decode_note_body(&blob));
        Ok(NoteEntry {
            id: note_id,
            title,
            snippet: String::new(),
            folder: None,
            modified_at: None,
            body,
        })
    })())
}

fn render_notes_html(notes: &[NoteEntry]) -> String {
    let mut body = String::new();
    for n in notes {
        body.push_str(&format!(
            "<article><h2>{}</h2><div class=\"date\">{}</div><pre>{}</pre></article>",
            html_escape(&n.title),
            n.modified_at.clone().unwrap_or_default(),
            html_escape(n.body.as_deref().unwrap_or(&n.snippet))
        ));
    }
    format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>Notes</title><style>\
body{{font-family:-apple-system,Segoe UI,sans-serif;background:#f7f7f9;margin:0;padding:24px;color:#1c1c1e}}\
article{{background:#fff;border-radius:12px;padding:16px 20px;margin:0 0 16px;box-shadow:0 1px 2px rgba(0,0,0,.06)}}\
h2{{font-size:16px;margin:0 0 4px}}.date{{font-size:11px;color:#8a8a8e;margin-bottom:8px}}\
pre{{white-space:pre-wrap;font-family:inherit;font-size:14px;margin:0}}</style></head><body><h1>Notes</h1>{body}</body></html>"
    )
}

fn render_notes_csv(notes: &[NoteEntry]) -> String {
    let mut out = String::from("modified_at,title,text\n");
    for n in notes {
        out.push_str(&format!(
            "{},{},{}\n",
            csv_cell(n.modified_at.as_deref().unwrap_or("")),
            csv_cell(&n.title),
            csv_cell(n.body.as_deref().unwrap_or(&n.snippet)),
        ));
    }
    out
}

#[tauri::command]
pub fn export_notes(
    state: State<AppState>,
    path: String,
    destination: String,
    format: String,
) -> CommandResult<String> {
    envelope((|| {
        let root = backup_root(&path)?;
        let dest = validate_writable_dir(&destination)?;
        let conn = open_notestore(&root)?;
        let notes = read_notes(&conn, true)?;
        let (contents, ext) = match format.to_ascii_lowercase().as_str() {
            "csv" => (render_notes_csv(&notes), "csv"),
            _ => (render_notes_html(&notes), "html"),
        };
        let file = timestamped(&dest, "notes", ext);
        std::fs::write(&file, contents).map_err(|e| {
            CommandError::new("Could not write the notes file.").with_details(e.to_string())
        })?;
        record_export(&state, &path, "notes", &file, notes.len() as i64);
        Ok(file.to_string_lossy().to_string())
    })())
}

// ---------------------------------------------------------------------------
// WhatsApp (ChatStorage.sqlite) — reuses MessageThread / MessageEntry
// ---------------------------------------------------------------------------

fn open_whatsapp(root: &Path) -> Result<Connection, CommandError> {
    open_named_db(root, &["ChatStorage.sqlite"], "WhatsApp")
}

fn read_wa_chats(conn: &Connection) -> Result<Vec<MessageThread>, CommandError> {
    let mut stmt = conn
        .prepare(
            "SELECT s.Z_PK, COALESCE(s.ZPARTNERNAME,''), COALESCE(s.ZCONTACTJID,''),
                    s.ZLASTMESSAGEDATE,
                    (SELECT COUNT(*) FROM ZWAMESSAGE m WHERE m.ZCHATSESSION = s.Z_PK) AS cnt,
                    (SELECT COALESCE(m2.ZTEXT,'') FROM ZWAMESSAGE m2
                       WHERE m2.ZCHATSESSION = s.Z_PK ORDER BY m2.ZMESSAGEDATE DESC LIMIT 1) AS snippet
               FROM ZWACHATSESSION s
              ORDER BY s.ZLASTMESSAGEDATE DESC",
        )
        .map_err(|e| {
            CommandError::new("This WhatsApp backup uses an unsupported format.")
                .with_details(e.to_string())
        })?;

    let rows = stmt
        .query_map([], |r| {
            let pk: i64 = r.get(0)?;
            let name: String = r.get(1)?;
            let jid: String = r.get(2)?;
            let last: Option<f64> = r.get(3)?;
            let cnt: i64 = r.get(4)?;
            let snippet: String = r.get(5)?;
            Ok(MessageThread {
                chat_id: pk.to_string(),
                display_name: if name.is_empty() {
                    jid.split('@').next().unwrap_or(&jid).to_string()
                } else {
                    name
                },
                handle: jid,
                service: "WhatsApp".into(),
                message_count: cnt,
                last_message_at: last.map(|d| d as i64).and_then(apple_to_rfc3339),
                last_snippet: snippet.chars().take(120).collect(),
            })
        })
        .map_err(|e| CommandError::internal(e.to_string()))?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

fn read_wa_messages(
    conn: &Connection,
    chat_pk: i64,
    limit: i64,
) -> Result<Vec<MessageEntry>, CommandError> {
    let mut stmt = conn
        .prepare(
            "SELECT m.Z_PK, m.ZISFROMME, COALESCE(m.ZTEXT,''), m.ZMESSAGEDATE, COALESCE(m.ZFROMJID,''),
                    (SELECT COUNT(*) FROM ZWAMEDIAITEM mi WHERE mi.ZMESSAGE = m.Z_PK) AS media
               FROM ZWAMESSAGE m
              WHERE m.ZCHATSESSION = ?1
              ORDER BY m.ZMESSAGEDATE ASC
              LIMIT ?2",
        )
        .map_err(|e| CommandError::internal(e.to_string()))?;
    let rows = stmt
        .query_map(rusqlite::params![chat_pk, limit], |r| {
            let from_me: i64 = r.get(1)?;
            let text: String = r.get(2)?;
            let date: Option<f64> = r.get(3)?;
            let jid: String = r.get(4)?;
            let media: i64 = r.get(5)?;
            Ok(MessageEntry {
                id: r.get::<_, i64>(0)?.to_string(),
                from_me: from_me != 0,
                sender: if from_me != 0 {
                    "Me".into()
                } else if jid.is_empty() {
                    "Contact".into()
                } else {
                    jid.split('@').next().unwrap_or(&jid).to_string()
                },
                text,
                sent_at: date.map(|d| d as i64).and_then(apple_to_rfc3339),
                service: "WhatsApp".into(),
                has_attachment: media > 0,
            })
        })
        .map_err(|e| CommandError::internal(e.to_string()))?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
pub fn list_wa_chats(path: String) -> CommandResult<Vec<MessageThread>> {
    envelope((|| {
        let root = backup_root(&path)?;
        let conn = open_whatsapp(&root)?;
        read_wa_chats(&conn)
    })())
}

#[tauri::command]
pub fn get_wa_chat(
    path: String,
    chat_id: String,
    limit: Option<i64>,
) -> CommandResult<Vec<MessageEntry>> {
    envelope((|| {
        let root = backup_root(&path)?;
        let conn = open_whatsapp(&root)?;
        let pk: i64 = chat_id
            .parse()
            .map_err(|_| CommandError::new("Invalid chat id."))?;
        read_wa_messages(&conn, pk, limit.unwrap_or(2000))
    })())
}

fn render_chat_html(title: &str, msgs: &[MessageEntry]) -> String {
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
body{{font-family:-apple-system,Segoe UI,sans-serif;background:#e5ddd5;margin:0;padding:24px}}\
h1{{font-size:18px}}.msg{{max-width:70%;margin:8px 0;padding:8px 10px;border-radius:10px;background:#fff}}\
.me{{background:#dcf8c6;margin-left:auto}}.meta{{font-size:11px;opacity:.6;margin-bottom:2px}}</style></head><body><h1>{t}</h1>{body}</body></html>",
        t = html_escape(title)
    )
}

fn render_chat_csv(msgs: &[MessageEntry]) -> String {
    let mut out = String::from("timestamp,direction,sender,has_attachment,text\n");
    for m in msgs {
        out.push_str(&format!(
            "{},{},{},{},{}\n",
            csv_cell(m.sent_at.as_deref().unwrap_or("")),
            if m.from_me { "outgoing" } else { "incoming" },
            csv_cell(&m.sender),
            m.has_attachment,
            csv_cell(&m.text),
        ));
    }
    out
}

#[tauri::command]
pub fn export_wa_chat(
    state: State<AppState>,
    path: String,
    chat_id: String,
    destination: String,
    format: String,
) -> CommandResult<String> {
    envelope((|| {
        let root = backup_root(&path)?;
        let dest = validate_writable_dir(&destination)?;
        let conn = open_whatsapp(&root)?;
        let pk: i64 = chat_id
            .parse()
            .map_err(|_| CommandError::new("Invalid chat id."))?;
        let msgs = read_wa_messages(&conn, pk, 100_000)?;
        let (contents, ext) = match format.to_ascii_lowercase().as_str() {
            "csv" => (render_chat_csv(&msgs), "csv"),
            _ => (render_chat_html(&format!("WhatsApp {chat_id}"), &msgs), "html"),
        };
        let file = timestamped(&dest, &format!("whatsapp_{pk}"), ext);
        std::fs::write(&file, contents).map_err(|e| {
            CommandError::new("Could not write the WhatsApp export.").with_details(e.to_string())
        })?;
        record_export(&state, &path, "whatsapp", &file, msgs.len() as i64);
        Ok(file.to_string_lossy().to_string())
    })())
}

// ---------------------------------------------------------------------------
// Export everything (background job)
// ---------------------------------------------------------------------------

/// Export all available personal data (contacts, notes, WhatsApp) from a
/// backup into a single dated folder as a background job.
#[tauri::command]
pub fn export_all_data(
    app: AppHandle,
    state: State<AppState>,
    path: String,
    destination: String,
) -> CommandResult<Job> {
    envelope((|| {
        let root = backup_root(&path)?;
        let dest_base = validate_writable_dir(&destination)?;
        let out_dir = dest_base.join(format!(
            "OETools_export_{}",
            chrono::Utc::now().format("%Y%m%d_%H%M%S")
        ));
        std::fs::create_dir_all(&out_dir).map_err(|e| {
            CommandError::new("Could not create the export folder.").with_details(e.to_string())
        })?;

        let job = job_queue::create(
            &state.db,
            &app,
            "data_export",
            "Export all data",
            Some("Exporting contacts, notes and WhatsApp"),
            None,
            false,
        );

        let db = state.db.clone();
        let mut worker = job.clone();
        std::thread::spawn(move || {
            let steps = 3;
            let mut done = 0;
            let mut written = 0i64;

            // Contacts
            if let Ok(conn) = open_addressbook(&root) {
                if let Ok(contacts) = read_contacts(&conn) {
                    if std::fs::write(out_dir.join("contacts.vcf"), render_vcard(&contacts)).is_ok()
                    {
                        written += contacts.len() as i64;
                    }
                }
            }
            done += 1;
            job_queue::progress(&db, &app, &mut worker, done * 100 / steps);

            // Notes
            if let Ok(conn) = open_notestore(&root) {
                if let Ok(notes) = read_notes(&conn, true) {
                    if std::fs::write(out_dir.join("notes.html"), render_notes_html(&notes)).is_ok()
                    {
                        written += notes.len() as i64;
                    }
                }
            }
            done += 1;
            job_queue::progress(&db, &app, &mut worker, done * 100 / steps);

            // WhatsApp (one HTML file per chat)
            if let Ok(conn) = open_whatsapp(&root) {
                if let Ok(chats) = read_wa_chats(&conn) {
                    let wa_dir = out_dir.join("whatsapp");
                    let _ = std::fs::create_dir_all(&wa_dir);
                    for c in &chats {
                        if let Ok(pk) = c.chat_id.parse::<i64>() {
                            if let Ok(msgs) = read_wa_messages(&conn, pk, 100_000) {
                                let safe: String = c
                                    .display_name
                                    .chars()
                                    .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '_' })
                                    .collect();
                                let _ = std::fs::write(
                                    wa_dir.join(format!("{pk}_{safe}.html")),
                                    render_chat_html(&c.display_name, &msgs),
                                );
                                written += msgs.len() as i64;
                            }
                        }
                    }
                }
            }
            done += 1;
            job_queue::progress(&db, &app, &mut worker, done * 100 / steps);

            job_queue::log(
                &db,
                &app,
                Some(&worker.id),
                None,
                "info",
                &format!("Exported {written} item(s) to {}", out_dir.display()),
                None,
            );
            job_queue::complete(&db, &app, &mut worker);
        });

        Ok(job)
    })())
}
