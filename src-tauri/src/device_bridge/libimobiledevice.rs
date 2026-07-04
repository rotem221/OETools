use super::parser;
use crate::core::dependency_manager::resolve_tool;
use crate::core::errors::CommandError;
use crate::models::*;
use crate::security::command_runner::{self};
use std::time::Duration;

const TOOL_LIST: &str = "idevice_id";
const TOOL_INFO: &str = "ideviceinfo";
const TOOL_PAIR: &str = "idevicepair";
const TOOL_AFC: &str = "afcclient";
const TOOL_DIAG: &str = "idevicediagnostics";
const TOOL_BACKUP: &str = "idevicebackup2";
const TOOL_SYSLOG: &str = "idevicesyslog";

fn dep_hint() -> &'static str {
    "Install libimobiledevice (e.g. `brew install libimobiledevice` on macOS, or the Apple Mobile Device Support / usbmuxd tools on Windows)."
}

/// Resolve a tool to an absolute path or return a structured missing-dependency
/// error. Ensures the bridge works even inside a bundled app (no shell PATH).
fn tool(name: &str) -> Result<String, CommandError> {
    resolve_tool(name)
        .map(|p| p.display().to_string())
        .ok_or_else(|| CommandError::missing_dependency(name, dep_hint()))
}

/// List connected devices via `idevice_id -l`.
pub fn list_devices() -> Result<Vec<DeviceSummary>, CommandError> {
    let bin = tool(TOOL_LIST)?;
    let out = command_runner::run(&bin, &["-l"], Duration::from_secs(10))
        .map_err(|e| e.with_dependency(TOOL_LIST).with_fix(dep_hint()))?;

    if !out.success && out.stdout.trim().is_empty() {
        return Ok(vec![]);
    }

    let mut devices = Vec::new();
    for udid in out.stdout.lines().map(str::trim).filter(|l| !l.is_empty()) {
        match get_summary(udid) {
            Ok(s) => devices.push(s),
            Err(_) => continue,
        }
    }
    Ok(devices)
}

fn get_summary(udid: &str) -> Result<DeviceSummary, CommandError> {
    let info = raw_info(udid)?;
    let product_type = info
        .get("ProductType")
        .cloned()
        .unwrap_or_else(|| "unknown".into());
    Ok(DeviceSummary {
        udid: udid.to_string(),
        name: info.get("DeviceName").cloned().unwrap_or_else(|| "iPhone".into()),
        kind: parser::kind_from_product_type(&product_type).to_string(),
        model: parser::model_name(&product_type),
        product_type,
        os_version: info.get("ProductVersion").cloned().unwrap_or_default(),
        connection_state: "connected".into(),
        trust_state: trust_state(udid),
        is_mock: false,
    })
}

fn raw_info(udid: &str) -> Result<std::collections::BTreeMap<String, String>, CommandError> {
    let bin = tool(TOOL_INFO)?;
    let out = command_runner::run(&bin, &["-u", udid], Duration::from_secs(15))
        .map_err(|e| e.with_dependency(TOOL_INFO).with_fix(dep_hint()))?;
    if !out.success {
        // Distinguish trust errors from other failures.
        if out.stderr.contains("Please accept the trust dialog")
            || out.stderr.contains("pairing")
        {
            return Err(CommandError::device_not_trusted());
        }
        return Err(CommandError::device_disconnected().with_details(out.stderr));
    }
    Ok(parser::parse_key_values(&out.stdout))
}

pub fn trust_state(udid: &str) -> String {
    let bin = match tool(TOOL_PAIR) {
        Ok(b) => b,
        Err(_) => return "unknown".into(),
    };
    match command_runner::run(&bin, &["-u", udid, "validate"], Duration::from_secs(8)) {
        Ok(o) if o.success => "trusted".into(),
        Ok(_) => "not_paired".into(),
        Err(_) => "unknown".into(),
    }
}

pub fn pair(udid: &str) -> Result<(), CommandError> {
    let bin = tool(TOOL_PAIR)?;
    let out = command_runner::run(&bin, &["-u", udid, "pair"], Duration::from_secs(20))
        .map_err(|e| e.with_dependency(TOOL_PAIR).with_fix(dep_hint()))?;
    if out.success {
        Ok(())
    } else {
        Err(CommandError::device_not_trusted().with_details(out.stderr))
    }
}

/// Get full device info. Battery/storage read from specific domains.
pub fn get_device_info(udid: &str) -> Result<DeviceInfo, CommandError> {
    let info = raw_info(udid)?;
    let product_type = info
        .get("ProductType")
        .cloned()
        .unwrap_or_else(|| "unknown".into());

    // Battery, storage and trust each shell out to separate tools. Run them
    // concurrently so Device Info loads in ~one call's time instead of the sum
    // of all of them (this is what made the page feel stuck).
    let (battery, storage, trust) = std::thread::scope(|s| {
        let b = s.spawn(|| read_battery(udid));
        let st = s.spawn(|| read_storage(udid));
        let tr = s.spawn(|| trust_state(udid));
        (
            b.join().unwrap_or(BatteryInfo {
                level_percent: None,
                health_percent: None,
                cycle_count: None,
                is_charging: None,
                state: None,
            }),
            st.join().unwrap_or(StorageInfo {
                total_bytes: None,
                used_bytes: None,
                free_bytes: None,
            }),
            tr.join().unwrap_or_else(|_| "unknown".to_string()),
        )
    });

    Ok(DeviceInfo {
        udid: udid.to_string(),
        serial_number: info.get("SerialNumber").cloned().unwrap_or_default(),
        name: info.get("DeviceName").cloned().unwrap_or_default(),
        kind: parser::kind_from_product_type(&product_type).to_string(),
        model: parser::model_name(&product_type),
        product_type: product_type.clone(),
        os_version: info.get("ProductVersion").cloned().unwrap_or_default(),
        build_version: info.get("BuildVersion").cloned(),
        device_class: info.get("DeviceClass").cloned(),
        cpu_architecture: info.get("CPUArchitecture").cloned(),
        region_info: info.get("RegionInfo").cloned(),
        wifi_address: info.get("WiFiAddress").cloned(),
        bluetooth_address: info.get("BluetoothAddress").cloned(),
        phone_number: info.get("PhoneNumber").cloned(),
        activation_state: info.get("ActivationState").cloned(),
        battery,
        storage,
        connection_state: "connected".into(),
        trust_state: trust,
        is_mock: false,
        raw: parser::filter_safe(&info),
    })
}

fn read_battery(udid: &str) -> BatteryInfo {
    let bin = tool(TOOL_INFO).unwrap_or_else(|_| TOOL_INFO.to_string());
    let out = command_runner::run(
        &bin,
        &["-u", udid, "-q", "com.apple.mobile.battery"],
        Duration::from_secs(10),
    );
    let mut b = BatteryInfo {
        level_percent: None,
        health_percent: None,
        cycle_count: None,
        is_charging: None,
        state: None,
    };
    if let Ok(o) = out {
        let map = parser::parse_key_values(&o.stdout);
        b.level_percent = map.get("BatteryCurrentCapacity").and_then(|v| v.parse().ok());
        b.is_charging = map
            .get("BatteryIsCharging")
            .map(|v| v.eq_ignore_ascii_case("true"));
        let fully_charged = map
            .get("FullyCharged")
            .map(|v| v.eq_ignore_ascii_case("true"))
            .unwrap_or(false);
        b.state = Some(if fully_charged {
            "Charged".into()
        } else if b.is_charging == Some(true) {
            "Charging".into()
        } else {
            "Discharging".into()
        });
    }

    // Health and cycle count are not in the battery lockdown domain; they come
    // from the on-device gas-gauge diagnostics (requires an unlocked, trusted
    // device). Best-effort: leave as None when unavailable.
    let (health, cycles) = read_battery_gauge(udid);
    b.health_percent = health;
    b.cycle_count = cycles;
    b
}

/// Read battery health percentage and charge-cycle count from the device's
/// gas-gauge diagnostics. Returns `(health_percent, cycle_count)`.
fn read_battery_gauge(udid: &str) -> (Option<i64>, Option<i64>) {
    let bin = match tool(TOOL_DIAG) {
        Ok(b) => b,
        Err(_) => return (None, None),
    };

    let mut cycle: Option<i64> = None;
    let mut design: Option<f64> = None;
    // "Effective" full-charge capacity in mAh (used for the health ratio).
    let mut full: Option<f64> = None;

    // Prefer the detailed IORegistry battery entry: it exposes
    // NominalChargeCapacity/DesignCapacity, which is exactly what iOS uses for
    // its "Maximum Capacity" figure. Keep timeouts short so Device Info never
    // stalls on devices that don't expose the gauge.
    if let Ok(out) = command_runner::run(
        &bin,
        &["-u", udid, "ioregentry", "AppleSmartBattery"],
        Duration::from_secs(6),
    ) {
        if out.success {
            let m = parser::parse_plist_flat(&out.stdout);
            cycle = m.get("CycleCount").and_then(|v| v.parse::<i64>().ok());
            design = m.get("DesignCapacity").and_then(|v| v.parse::<f64>().ok());
            // NominalChargeCapacity matches iOS Settings; fall back to the raw
            // max capacity when the nominal value isn't reported.
            full = m
                .get("NominalChargeCapacity")
                .or_else(|| m.get("AppleRawMaxCapacity"))
                .and_then(|v| v.parse::<f64>().ok());
        }
    }

    // Fall back to the gas-gauge diagnostic for anything still missing. Its
    // CycleCount is reliable; its FullChargeCapacity is sometimes a normalized
    // 0..100 value, so only trust it when it looks like a real mAh reading.
    if cycle.is_none() || design.is_none() || full.is_none() {
        if let Ok(out) = command_runner::run(
            &bin,
            &["-u", udid, "diagnostics", "GasGauge"],
            Duration::from_secs(6),
        ) {
            if out.success {
                let m = parser::parse_plist_flat(&out.stdout);
                if cycle.is_none() {
                    cycle = m.get("CycleCount").and_then(|v| v.parse::<i64>().ok());
                }
                if design.is_none() {
                    design = m.get("DesignCapacity").and_then(|v| v.parse::<f64>().ok());
                }
                if full.is_none() {
                    let fc = m.get("FullChargeCapacity").and_then(|v| v.parse::<f64>().ok());
                    // Guard against the normalized "100" some devices report.
                    if let (Some(fc), Some(d)) = (fc, design) {
                        if fc > d * 0.4 {
                            full = Some(fc);
                        }
                    }
                }
            }
        }
    }

    let health = match (full, design) {
        (Some(f), Some(d)) if d > 0.0 => Some(((f / d * 100.0).round() as i64).clamp(1, 100)),
        _ => None,
    };
    (health, cycle)
}

/// Root of the camera roll on iOS devices, reachable over AFC.
const DCIM_ROOT: &str = "/DCIM";
/// Safety cap so devices with tens of thousands of photos stay responsive.
const MEDIA_LIMIT: usize = 1000;

/// List photos and videos from the device camera roll (`/DCIM`) over AFC.
///
/// Directory enumeration uses cheap one-shot `afcclient ls` calls (there are
/// only a handful of `NNNAPPLE` folders). File sizes and timestamps are then
/// enriched over a single interactive `afcclient` session so we do not spawn a
/// process per file.
pub fn list_media(udid: &str) -> Result<Vec<MediaItem>, CommandError> {
    let bin = tool(TOOL_AFC)?;

    let mut items: Vec<MediaItem> = Vec::new();

    // Files can live directly under /DCIM or (usually) inside NNNAPPLE folders.
    let entries = afc_ls(&bin, udid, DCIM_ROOT)?;
    let mut dirs: Vec<String> = Vec::new();
    for entry in &entries {
        if entry.starts_with('.') {
            continue;
        }
        // Heuristic: names with a media extension are files; others are dirs.
        match classify_media(entry) {
            Some(kind) => push_item(&mut items, DCIM_ROOT, entry, kind),
            None => dirs.push(entry.clone()),
        }
    }

    for dir in dirs {
        let path = format!("{DCIM_ROOT}/{dir}");
        let Ok(files) = afc_ls(&bin, udid, &path) else {
            continue;
        };
        for name in files {
            if name.starts_with('.') {
                continue;
            }
            if let Some(kind) = classify_media(&name) {
                push_item(&mut items, &path, &name, kind);
            }
        }
    }

    // Newest first (Apple's IMG_#### / capture folders sort chronologically).
    items.sort_by(|a, b| b.name.cmp(&a.name));
    if items.len() > MEDIA_LIMIT {
        items.truncate(MEDIA_LIMIT);
    }

    // NOTE: size/date and thumbnails are fetched lazily per item (see
    // `media_meta` / `media_thumbnail`). Enumeration stays instant even for
    // libraries with thousands of photos.
    Ok(items)
}

/// Cheap per-file metadata via a single one-shot `afcclient info` (JSON). No
/// file is transferred, so this is fast enough to call lazily as items scroll
/// into view.
pub fn media_meta(udid: &str, remote: &str) -> Result<MediaMeta, CommandError> {
    let bin = tool(TOOL_AFC)?;
    let out = command_runner::run(&bin, &["-u", udid, "info", remote], Duration::from_secs(15))
        .map_err(|e| e.with_dependency(TOOL_AFC).with_fix(dep_hint()))?;
    let v: serde_json::Value =
        serde_json::from_str(out.stdout.trim()).unwrap_or(serde_json::Value::Null);
    let size = v.get("st_size").and_then(|x| x.as_i64()).unwrap_or(0);
    let ns = v
        .get("st_birthtime")
        .and_then(|x| x.as_u64())
        .or_else(|| v.get("st_mtime").and_then(|x| x.as_u64()))
        .unwrap_or(0);
    Ok(MediaMeta {
        size_bytes: size,
        created_at: if ns > 0 { ns_to_rfc3339(ns) } else { String::new() },
    })
}

/// Generate a small JPEG preview for a camera-roll file, returned as a base64
/// data URI. Images are downscaled with `sips` (handles HEIC); videos use the
/// first frame via `ffmpeg` when available. Results are cached on disk so a
/// preview is produced at most once per file.
pub fn media_thumbnail(udid: &str, remote: &str, kind: &str) -> Result<MediaThumb, CommandError> {
    let meta = media_meta(udid, remote).unwrap_or(MediaMeta {
        size_bytes: 0,
        created_at: String::new(),
    });

    let thumbs = crate::core::filesystem::app_data_dir()
        .join("temp")
        .join("thumbs");
    let _ = std::fs::create_dir_all(&thumbs);
    let hash = simple_hash(remote);
    let thumb_path = thumbs.join(format!("{hash}.jpg"));

    let none = |m: &MediaMeta| MediaThumb {
        data_uri: None,
        size_bytes: m.size_bytes,
        created_at: m.created_at.clone(),
        kind: kind.to_string(),
    };

    if !thumb_path.exists() {
        // Avoid pulling very large videos just to build a preview.
        if kind == "video" && meta.size_bytes > 80 * 1024 * 1024 {
            return Ok(none(&meta));
        }

        let afc = tool(TOOL_AFC)?;
        let orig = thumbs.join(format!("{hash}.orig"));
        let orig_str = orig.to_string_lossy().to_string();
        let got = command_runner::run(
            &afc,
            &["-u", udid, "get", remote, &orig_str],
            Duration::from_secs(60),
        );
        if !matches!(got, Ok(ref o) if o.success) {
            let _ = std::fs::remove_file(&orig);
            return Ok(none(&meta));
        }

        let thumb_str = thumb_path.to_string_lossy().to_string();
        let ok = if kind == "video" {
            ffmpeg_thumbnail(&orig_str, &thumb_str)
        } else {
            image_thumbnail(&orig_str, &thumb_str)
        };
        let _ = std::fs::remove_file(&orig);
        if !ok {
            return Ok(none(&meta));
        }
    }

    let data_uri = std::fs::read(&thumb_path)
        .ok()
        .map(|bytes| format!("data:image/jpeg;base64,{}", base64_encode(&bytes)));

    Ok(MediaThumb {
        data_uri,
        size_bytes: meta.size_bytes,
        created_at: meta.created_at,
        kind: kind.to_string(),
    })
}

/// Downscale an image to a ~256px JPEG. Prefers macOS `sips` (handles HEIC),
/// falling back to `ffmpeg` on Windows/Linux.
fn image_thumbnail(src: &str, dest: &str) -> bool {
    if let Ok(bin) = which::which("sips") {
        if matches!(
            command_runner::run(
                &bin.display().to_string(),
                &["-Z", "256", "-s", "format", "jpeg", src, "--out", dest],
                Duration::from_secs(20),
            ),
            Ok(o) if o.success
        ) && std::path::Path::new(dest).exists()
        {
            return true;
        }
    }
    let Ok(bin) = which::which("ffmpeg") else {
        return false;
    };
    matches!(
        command_runner::run(
            &bin.display().to_string(),
            &["-y", "-i", src, "-vf", "scale=256:-1", "-frames:v", "1", dest],
            Duration::from_secs(20),
        ),
        Ok(o) if o.success
    ) && std::path::Path::new(dest).exists()
}

/// Extract the first video frame as a ~256px JPEG using `ffmpeg` when present.
fn ffmpeg_thumbnail(src: &str, dest: &str) -> bool {
    let Ok(bin) = which::which("ffmpeg") else {
        return false;
    };
    matches!(
        command_runner::run(
            &bin.display().to_string(),
            &[
                "-y", "-ss", "0", "-i", src, "-frames:v", "1", "-vf",
                "scale=256:-1", dest,
            ],
            Duration::from_secs(30),
        ),
        Ok(o) if o.success
    ) && std::path::Path::new(dest).exists()
}

/// Stable filesystem-safe hash for caching thumbnails by remote path.
fn simple_hash(s: &str) -> String {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    s.hash(&mut h);
    format!("{:016x}", h.finish())
}

/// Minimal standard base64 encoder (avoids adding a dependency).
fn base64_encode(data: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0];
        let b1 = *chunk.get(1).unwrap_or(&0);
        let b2 = *chunk.get(2).unwrap_or(&0);
        let n = ((b0 as u32) << 16) | ((b1 as u32) << 8) | (b2 as u32);
        out.push(T[((n >> 18) & 63) as usize] as char);
        out.push(T[((n >> 12) & 63) as usize] as char);
        out.push(if chunk.len() > 1 {
            T[((n >> 6) & 63) as usize] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            T[(n & 63) as usize] as char
        } else {
            '='
        });
    }
    out
}

fn push_item(items: &mut Vec<MediaItem>, dir: &str, name: &str, kind: &str) {
    let path = format!("{}/{}", dir.trim_end_matches('/'), name);
    items.push(MediaItem {
        id: path.clone(),
        name: name.to_string(),
        kind: kind.to_string(),
        size_bytes: 0,
        created_at: String::new(),
        relative_path: path.trim_start_matches('/').to_string(),
        thumbnail_data_uri: None,
    });
}

/// Classify a file name as `image`/`video`, or `None` when not media.
fn classify_media(name: &str) -> Option<&'static str> {
    let lower = name.to_ascii_lowercase();
    const IMAGES: &[&str] = &[
        ".jpg", ".jpeg", ".png", ".heic", ".heif", ".gif", ".webp", ".dng", ".tiff", ".bmp",
    ];
    const VIDEOS: &[&str] = &[".mov", ".mp4", ".m4v", ".avi", ".hevc"];
    if IMAGES.iter().any(|e| lower.ends_with(e)) {
        Some("image")
    } else if VIDEOS.iter().any(|e| lower.ends_with(e)) {
        Some("video")
    } else {
        None
    }
}

/// One-shot `afcclient ls PATH`, returning entry names (excluding `.`/`..`).
fn afc_ls(bin: &str, udid: &str, path: &str) -> Result<Vec<String>, CommandError> {
    let out = command_runner::run(bin, &["-u", udid, "ls", path], Duration::from_secs(30))
        .map_err(|e| e.with_dependency(TOOL_AFC).with_fix(dep_hint()))?;
    if !out.success {
        return Err(CommandError::new("Could not read device media over AFC.")
            .with_details(out.stderr));
    }
    Ok(out
        .stdout
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty() && l != "." && l != "..")
        .collect())
}

/// Extract the last `NN%` percentage token from a line, if present. Used to
/// turn idevicebackup2's progress output into a job percentage.
fn parse_percent(line: &str) -> Option<i64> {
    let mut num = String::new();
    let mut last: Option<i64> = None;
    for ch in line.chars() {
        if ch.is_ascii_digit() {
            num.push(ch);
        } else if ch == '%' && !num.is_empty() {
            last = num.parse::<i64>().ok();
            num.clear();
        } else {
            num.clear();
        }
    }
    last.map(|v| v.clamp(0, 100))
}

/// Run a full backup via `idevicebackup2`, streaming real progress. `on_progress`
/// receives 0..=100 as the tool reports it; `on_line` receives every output line
/// (for logging). Honors the cancel flag.
pub fn backup_full(
    udid: &str,
    target_dir: &str,
    cancel: &std::sync::atomic::AtomicBool,
    mut on_progress: impl FnMut(i64),
    mut on_line: impl FnMut(&str),
) -> Result<command_runner::StreamResult, CommandError> {
    let bin = tool(TOOL_BACKUP)?;
    let args = ["-u", udid, "backup", "--full", target_dir];
    let mut last = -1i64;
    command_runner::run_streaming(
        &bin,
        &args,
        Duration::from_secs(4 * 3600),
        cancel,
        |line| {
            if let Some(p) = parse_percent(line) {
                if p != last {
                    last = p;
                    on_progress(p);
                }
            }
            on_line(line);
        },
    )
    .map_err(|e| e.with_dependency(TOOL_BACKUP).with_fix(dep_hint()))
}

/// Stream the device system log via `idevicesyslog`, invoking `on_line` for each
/// line until the cancel flag is set. Blocks the calling (worker) thread.
pub fn stream_syslog(
    udid: &str,
    cancel: &std::sync::atomic::AtomicBool,
    on_line: impl FnMut(&str),
) -> Result<command_runner::StreamResult, CommandError> {
    let bin = tool(TOOL_SYSLOG)?;
    command_runner::run_streaming(
        &bin,
        &["-u", udid],
        Duration::from_secs(12 * 3600),
        cancel,
        on_line,
    )
    .map_err(|e| e.with_dependency(TOOL_SYSLOG).with_fix(dep_hint()))
}

/// Convert AFC nanoseconds-since-epoch to an RFC3339 timestamp.
fn ns_to_rfc3339(ns: u64) -> String {
    let secs = (ns / 1_000_000_000) as i64;
    chrono::DateTime::from_timestamp(secs, 0)
        .map(|d| d.to_rfc3339())
        .unwrap_or_default()
}

/// Copy a single file from the device (`remote`, an absolute `/DCIM/...` path)
/// to a local `dest` file path, over AFC.
pub fn afc_get(udid: &str, remote: &str, dest: &str) -> Result<(), CommandError> {
    let bin = tool(TOOL_AFC)?;
    let out = command_runner::run(
        &bin,
        &["-u", udid, "get", remote, dest],
        Duration::from_secs(180),
    )
    .map_err(|e| e.with_dependency(TOOL_AFC).with_fix(dep_hint()))?;
    if out.success {
        Ok(())
    } else {
        Err(CommandError::new(format!("Failed to copy {remote} from device."))
            .with_details(out.stderr))
    }
}

fn read_storage(udid: &str) -> StorageInfo {
    let bin = tool(TOOL_INFO).unwrap_or_else(|_| TOOL_INFO.to_string());
    let out = command_runner::run(
        &bin,
        &["-u", udid, "-q", "com.apple.disk_usage"],
        Duration::from_secs(10),
    );
    let mut s = StorageInfo {
        total_bytes: None,
        used_bytes: None,
        free_bytes: None,
    };
    if let Ok(o) = out {
        let map = parser::parse_key_values(&o.stdout);
        let total = map.get("TotalDiskCapacity").and_then(|v| v.parse::<i64>().ok());
        let free = map
            .get("TotalDataAvailable")
            .and_then(|v| v.parse::<i64>().ok());
        s.total_bytes = total;
        s.free_bytes = free;
        if let (Some(t), Some(f)) = (total, free) {
            s.used_bytes = Some((t - f).max(0));
        }
    }
    s
}
