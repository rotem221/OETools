//! Business tools: configuration-profile library, a simple profile generator,
//! supervision status, and a local device/asset fleet inventory.
//!
//! Everything is local: profiles are stored in the app data folder, generated
//! `.mobileconfig` files are plain XML, and the fleet/asset data lives in the
//! local SQLite database. Nothing is transmitted anywhere.

use crate::core::app_state::AppState;
use crate::core::errors::{envelope, CommandError, CommandResult};
use crate::core::filesystem;
use crate::models::{
    now_iso, ConfigProfile, DeviceAsset, ProfileTemplate, SupervisionInfo,
};
use crate::security::path_validation::{validate_existing_path, validate_writable_dir};
use tauri::State;
use uuid::Uuid;

fn profiles_dir() -> std::path::PathBuf {
    let dir = filesystem::app_data_dir().join("profiles");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

// ---------------------------------------------------------------------------
// Configuration-profile library
// ---------------------------------------------------------------------------

fn plist_string(dict: &plist::Dictionary, key: &str) -> Option<String> {
    dict.get(key).and_then(|v| v.as_string()).map(|s| s.to_string())
}

/// Import a `.mobileconfig` file into the local library (copied into app data).
#[tauri::command]
pub fn import_profile(state: State<AppState>, path: String) -> CommandResult<ConfigProfile> {
    envelope((|| {
        let src = validate_existing_path(&path)?;
        let file_name = src
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "profile.mobileconfig".into());
        let stored = profiles_dir().join(format!("{}_{}", Uuid::new_v4(), file_name));
        std::fs::copy(&src, &stored).map_err(|e| {
            CommandError::new("Could not import the profile.").with_details(e.to_string())
        })?;

        // Best-effort parse (unsigned XML profiles). Signed profiles fall back to
        // the file name as the display name.
        let (name, org, ident, ptype) = match plist::Value::from_file(&stored) {
            Ok(v) => {
                let d = v.as_dictionary().cloned().unwrap_or_default();
                (
                    plist_string(&d, "PayloadDisplayName").or(Some(file_name.clone())),
                    plist_string(&d, "PayloadOrganization"),
                    plist_string(&d, "PayloadIdentifier"),
                    plist_string(&d, "PayloadType").or_else(|| Some("Configuration".into())),
                )
            }
            Err(_) => (Some(file_name.clone()), None, None, Some("Signed".into())),
        };

        let id = Uuid::new_v4().to_string();
        let now = now_iso();
        let meta = serde_json::json!({ "path": stored.to_string_lossy() }).to_string();
        {
            let conn = state.db.conn.lock().unwrap();
            conn.execute(
                "INSERT INTO configuration_profiles (id, device_udid, name, organization, identifier, profile_type, removable, installed_at, last_seen_at, metadata_json)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?8,?9)",
                rusqlite::params![id, "library", name, org, ident, ptype, 1i64, now, meta],
            )
            .map_err(CommandError::from)?;
        }
        Ok(ConfigProfile {
            id,
            name,
            organization: org,
            identifier: ident,
            profile_type: ptype,
            path: Some(stored.to_string_lossy().to_string()),
            installed_at: Some(now),
        })
    })())
}

#[tauri::command]
pub fn list_profiles(state: State<AppState>) -> CommandResult<Vec<ConfigProfile>> {
    envelope((|| {
        let conn = state.db.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT id, name, organization, identifier, profile_type, installed_at, metadata_json
                   FROM configuration_profiles ORDER BY installed_at DESC",
            )
            .map_err(CommandError::from)?;
        let rows = stmt
            .query_map([], |r| {
                let meta: String = r.get(6)?;
                let path = serde_json::from_str::<serde_json::Value>(&meta)
                    .ok()
                    .and_then(|v| v.get("path").and_then(|p| p.as_str()).map(String::from));
                Ok(ConfigProfile {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    organization: r.get(2)?,
                    identifier: r.get(3)?,
                    profile_type: r.get(4)?,
                    installed_at: r.get(5)?,
                    path,
                })
            })
            .map_err(CommandError::from)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    })())
}

#[tauri::command]
pub fn delete_profile(state: State<AppState>, id: String) -> CommandResult<()> {
    envelope((|| {
        let conn = state.db.conn.lock().unwrap();
        if let Ok(meta) = conn.query_row(
            "SELECT metadata_json FROM configuration_profiles WHERE id = ?1",
            [&id],
            |r| r.get::<_, String>(0),
        ) {
            if let Some(p) = serde_json::from_str::<serde_json::Value>(&meta)
                .ok()
                .and_then(|v| v.get("path").and_then(|p| p.as_str()).map(String::from))
            {
                let _ = std::fs::remove_file(p);
            }
        }
        conn.execute("DELETE FROM configuration_profiles WHERE id = ?1", [&id])
            .map_err(CommandError::from)?;
        Ok(())
    })())
}

#[tauri::command]
pub fn export_profile(
    state: State<AppState>,
    id: String,
    destination: String,
) -> CommandResult<String> {
    envelope((|| {
        let dest = validate_writable_dir(&destination)?;
        let (name, meta): (Option<String>, String) = {
            let conn = state.db.conn.lock().unwrap();
            conn.query_row(
                "SELECT name, metadata_json FROM configuration_profiles WHERE id = ?1",
                [&id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .map_err(|_| CommandError::new("Profile not found."))?
        };
        let path = serde_json::from_str::<serde_json::Value>(&meta)
            .ok()
            .and_then(|v| v.get("path").and_then(|p| p.as_str()).map(String::from))
            .ok_or_else(|| CommandError::new("Profile file is missing."))?;
        let safe = name.unwrap_or_else(|| "profile".into());
        let safe: String = safe.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '_' }).collect();
        let out = dest.join(format!("{safe}.mobileconfig"));
        std::fs::copy(&path, &out).map_err(|e| {
            CommandError::new("Could not export the profile.").with_details(e.to_string())
        })?;
        Ok(out.to_string_lossy().to_string())
    })())
}

// ---------------------------------------------------------------------------
// Profile generator (templates)
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn list_profile_templates(state: State<AppState>) -> CommandResult<Vec<ProfileTemplate>> {
    envelope((|| {
        let conn = state.db.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT id, name, description, payload_type, profile_json, created_at, updated_at
                   FROM profile_templates ORDER BY updated_at DESC",
            )
            .map_err(CommandError::from)?;
        let rows = stmt
            .query_map([], |r| {
                Ok(ProfileTemplate {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    description: r.get(2)?,
                    payload_type: r.get(3)?,
                    profile_json: r.get(4)?,
                    created_at: r.get(5)?,
                    updated_at: r.get(6)?,
                })
            })
            .map_err(CommandError::from)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    })())
}

#[tauri::command]
pub fn save_profile_template(
    state: State<AppState>,
    template: ProfileTemplate,
) -> CommandResult<ProfileTemplate> {
    envelope((|| {
        let mut tpl = template;
        if tpl.id.is_empty() {
            tpl.id = Uuid::new_v4().to_string();
            tpl.created_at = now_iso();
        }
        tpl.updated_at = now_iso();
        let conn = state.db.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO profile_templates (id, name, description, payload_type, profile_json, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7)
             ON CONFLICT(id) DO UPDATE SET name=?2, description=?3, payload_type=?4, profile_json=?5, updated_at=?7",
            rusqlite::params![tpl.id, tpl.name, tpl.description, tpl.payload_type, tpl.profile_json, tpl.created_at, tpl.updated_at],
        )
        .map_err(CommandError::from)?;
        Ok(tpl)
    })())
}

#[tauri::command]
pub fn delete_profile_template(state: State<AppState>, id: String) -> CommandResult<()> {
    let conn = state.db.conn.lock().unwrap();
    envelope(
        conn.execute("DELETE FROM profile_templates WHERE id = ?1", [&id])
            .map(|_| ())
            .map_err(CommandError::from),
    )
}

fn build_mobileconfig(name: &str, org: &str, payload_type: &str, fields: &serde_json::Value) -> String {
    let prof_uuid = Uuid::new_v4().to_string().to_uppercase();
    let pay_uuid = Uuid::new_v4().to_string().to_uppercase();
    let ident = format!("com.oetools.{}", prof_uuid.split('-').next().unwrap_or("profile"));

    let get = |k: &str| fields.get(k).and_then(|v| v.as_str()).unwrap_or("").to_string();

    let payload_inner = match payload_type {
        "wifi" => {
            let ssid = xml_escape(&get("ssid"));
            let password = get("password");
            let hidden = fields.get("hidden").and_then(|v| v.as_bool()).unwrap_or(false);
            let enc = if password.is_empty() { "None" } else { "WPA" };
            let pw_kv = if password.is_empty() {
                String::new()
            } else {
                format!("\t\t\t<key>Password</key>\n\t\t\t<string>{}</string>\n", xml_escape(&password))
            };
            format!(
                "\t\t\t<key>PayloadType</key>\n\t\t\t<string>com.apple.wifi.managed</string>\n\
\t\t\t<key>SSID_STR</key>\n\t\t\t<string>{ssid}</string>\n\
\t\t\t<key>HIDDEN_NETWORK</key>\n\t\t\t<{hidden}/>\n\
\t\t\t<key>AutoJoin</key>\n\t\t\t<true/>\n\
\t\t\t<key>EncryptionType</key>\n\t\t\t<string>{enc}</string>\n{pw_kv}",
                hidden = if hidden { "true" } else { "false" },
            )
        }
        _ => {
            // web clip
            let label = xml_escape(&get("label"));
            let url = xml_escape(&get("url"));
            format!(
                "\t\t\t<key>PayloadType</key>\n\t\t\t<string>com.apple.webClip.managed</string>\n\
\t\t\t<key>Label</key>\n\t\t\t<string>{label}</string>\n\
\t\t\t<key>URL</key>\n\t\t\t<string>{url}</string>\n\
\t\t\t<key>IsRemovable</key>\n\t\t\t<true/>\n"
            )
        }
    };

    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n\
<plist version=\"1.0\">\n<dict>\n\
\t<key>PayloadContent</key>\n\t<array>\n\t\t<dict>\n{payload_inner}\
\t\t\t<key>PayloadIdentifier</key>\n\t\t\t<string>{ident}.payload</string>\n\
\t\t\t<key>PayloadUUID</key>\n\t\t\t<string>{pay_uuid}</string>\n\
\t\t\t<key>PayloadVersion</key>\n\t\t\t<integer>1</integer>\n\
\t\t\t<key>PayloadDisplayName</key>\n\t\t\t<string>{name_esc}</string>\n\
\t\t</dict>\n\t</array>\n\
\t<key>PayloadDisplayName</key>\n\t<string>{name_esc}</string>\n\
\t<key>PayloadIdentifier</key>\n\t<string>{ident}</string>\n\
\t<key>PayloadOrganization</key>\n\t<string>{org_esc}</string>\n\
\t<key>PayloadType</key>\n\t<string>Configuration</string>\n\
\t<key>PayloadUUID</key>\n\t<string>{prof_uuid}</string>\n\
\t<key>PayloadVersion</key>\n\t<integer>1</integer>\n\
</dict>\n</plist>\n",
        name_esc = xml_escape(name),
        org_esc = xml_escape(org),
    )
}

#[tauri::command]
pub fn export_profile_template(
    state: State<AppState>,
    id: String,
    destination: String,
) -> CommandResult<String> {
    envelope((|| {
        let dest = validate_writable_dir(&destination)?;
        let tpl = {
            let conn = state.db.conn.lock().unwrap();
            conn.query_row(
                "SELECT name, description, payload_type, profile_json FROM profile_templates WHERE id = ?1",
                [&id],
                |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, Option<String>>(1)?,
                        r.get::<_, String>(2)?,
                        r.get::<_, String>(3)?,
                    ))
                },
            )
            .map_err(|_| CommandError::new("Template not found."))?
        };
        let (name, org, payload_type, json) = (tpl.0, tpl.1.unwrap_or_default(), tpl.2, tpl.3);
        let fields: serde_json::Value = serde_json::from_str(&json).unwrap_or(serde_json::Value::Null);
        let xml = build_mobileconfig(&name, &org, &payload_type, &fields);
        let safe: String = name.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '_' }).collect();
        let out = dest.join(format!("{safe}.mobileconfig"));
        std::fs::write(&out, xml).map_err(|e| {
            CommandError::new("Could not write the profile.").with_details(e.to_string())
        })?;
        Ok(out.to_string_lossy().to_string())
    })())
}

// ---------------------------------------------------------------------------
// Supervision
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn list_supervision(state: State<AppState>) -> CommandResult<Vec<SupervisionInfo>> {
    envelope((|| {
        let conn = state.db.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT d.udid, d.name,
                        COALESCE(s.supervised, 0), s.organization_name, s.last_checked_at
                   FROM devices d
                   LEFT JOIN supervision_states s ON s.device_udid = d.udid
                  ORDER BY d.name",
            )
            .map_err(CommandError::from)?;
        let rows = stmt
            .query_map([], |r| {
                let sup: i64 = r.get(2)?;
                Ok(SupervisionInfo {
                    udid: r.get(0)?,
                    device_name: r.get(1)?,
                    supervised: sup != 0,
                    organization_name: r.get(3)?,
                    last_checked_at: r.get(4)?,
                })
            })
            .map_err(CommandError::from)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    })())
}

/// Refresh supervision state for a device from its live device info.
#[tauri::command]
pub fn refresh_supervision(state: State<AppState>, udid: String) -> CommandResult<SupervisionInfo> {
    envelope((|| {
        let info = state.bridge().get_device_info(&udid)?;
        let supervised = info
            .raw
            .get("IsSupervised")
            .map(|v| v == "true" || v == "1" || v.eq_ignore_ascii_case("yes"))
            .unwrap_or(false);
        let now = now_iso();
        {
            let conn = state.db.conn.lock().unwrap();
            conn.execute(
                "INSERT INTO supervision_states (id, device_udid, supervised, last_checked_at)
                 VALUES (?1,?2,?3,?4)
                 ON CONFLICT(device_udid) DO UPDATE SET supervised=?3, last_checked_at=?4",
                rusqlite::params![Uuid::new_v4().to_string(), udid, supervised as i64, now],
            )
            .map_err(CommandError::from)?;
        }
        Ok(SupervisionInfo {
            udid: udid.clone(),
            device_name: Some(info.name),
            supervised,
            organization_name: None,
            last_checked_at: Some(now),
        })
    })())
}

#[tauri::command]
pub fn set_supervision_org(
    state: State<AppState>,
    udid: String,
    organization: Option<String>,
) -> CommandResult<()> {
    envelope((|| {
        let conn = state.db.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO supervision_states (id, device_udid, supervised, organization_name, last_checked_at)
             VALUES (?1,?2,0,?3,?4)
             ON CONFLICT(device_udid) DO UPDATE SET organization_name=?3",
            rusqlite::params![Uuid::new_v4().to_string(), udid, organization, now_iso()],
        )
        .map_err(CommandError::from)?;
        Ok(())
    })())
}

// ---------------------------------------------------------------------------
// Fleet / asset inventory
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn list_assets(state: State<AppState>) -> CommandResult<Vec<DeviceAsset>> {
    envelope((|| {
        let conn = state.db.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT d.udid, d.name, d.model, d.os_version,
                        a.employee_name, a.department, a.location, a.asset_tag, a.notes, a.updated_at
                   FROM devices d
                   LEFT JOIN device_assets a ON a.device_udid = d.udid
                  ORDER BY d.name",
            )
            .map_err(CommandError::from)?;
        let rows = stmt
            .query_map([], |r| {
                Ok(DeviceAsset {
                    device_udid: r.get(0)?,
                    device_name: r.get(1)?,
                    model: r.get(2)?,
                    os_version: r.get(3)?,
                    employee_name: r.get(4)?,
                    department: r.get(5)?,
                    location: r.get(6)?,
                    asset_tag: r.get(7)?,
                    notes: r.get(8)?,
                    updated_at: r.get(9)?,
                })
            })
            .map_err(CommandError::from)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    })())
}

#[tauri::command]
pub fn save_asset(state: State<AppState>, asset: DeviceAsset) -> CommandResult<()> {
    envelope((|| {
        let conn = state.db.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO device_assets (id, device_udid, employee_name, department, location, asset_tag, notes, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8)
             ON CONFLICT(device_udid) DO UPDATE SET employee_name=?3, department=?4, location=?5, asset_tag=?6, notes=?7, updated_at=?8",
            rusqlite::params![
                Uuid::new_v4().to_string(),
                asset.device_udid,
                asset.employee_name,
                asset.department,
                asset.location,
                asset.asset_tag,
                asset.notes,
                now_iso(),
            ],
        )
        .map_err(CommandError::from)?;
        Ok(())
    })())
}
