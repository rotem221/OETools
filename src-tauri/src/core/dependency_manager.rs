use crate::models::{now_iso, DependencyInfo};
use crate::security::command_runner;
use std::path::PathBuf;
use std::time::Duration;

/// Common locations where CLI tools live. Bundled GUI apps do not inherit the
/// user's shell PATH, so we probe these explicitly in addition to PATH.
fn extra_bin_dirs() -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = vec![
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/usr/bin"),
        PathBuf::from("/bin"),
    ];
    if let Some(home) = dirs::home_dir() {
        dirs.push(home.join(".local/bin"));
    }
    dirs
}

/// Resolve a tool to an absolute path: first via PATH (`which`), then via the
/// well-known install directories above. Returns `None` when not found.
pub fn resolve_tool(name: &str) -> Option<PathBuf> {
    if let Ok(p) = which::which(name) {
        return Some(p);
    }
    for dir in extra_bin_dirs() {
        let candidate = dir.join(name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

struct DepSpec {
    id: &'static str,
    name: &'static str,
    /// version probe arg, if the tool supports one
    version_arg: Option<&'static str>,
    hint: &'static str,
    /// optional dependencies do not block real-device operation
    optional: bool,
}

const DEPS: &[DepSpec] = &[
    DepSpec {
        id: "idevice_id",
        name: "idevice_id",
        version_arg: Some("--version"),
        hint: "brew install libimobiledevice",
        optional: false,
    },
    DepSpec {
        id: "ideviceinfo",
        name: "ideviceinfo",
        version_arg: Some("--version"),
        hint: "brew install libimobiledevice",
        optional: false,
    },
    DepSpec {
        id: "idevicepair",
        name: "idevicepair",
        version_arg: Some("--version"),
        hint: "brew install libimobiledevice",
        optional: false,
    },
    DepSpec {
        id: "idevicebackup2",
        name: "idevicebackup2",
        version_arg: Some("--version"),
        hint: "brew install libimobiledevice",
        optional: false,
    },
    DepSpec {
        id: "idevicesyslog",
        name: "idevicesyslog",
        version_arg: Some("--version"),
        hint: "brew install libimobiledevice",
        optional: false,
    },
    DepSpec {
        id: "idevicecrashreport",
        name: "idevicecrashreport",
        version_arg: None,
        hint: "brew install libimobiledevice",
        optional: true,
    },
    DepSpec {
        id: "afcclient",
        name: "afcclient",
        version_arg: Some("--version"),
        hint: "Ships with libimobiledevice; required to browse/export photos & videos.",
        optional: true,
    },
    DepSpec {
        id: "idevicediagnostics",
        name: "idevicediagnostics",
        version_arg: Some("--version"),
        hint: "Ships with libimobiledevice; used for battery health & cycle count.",
        optional: true,
    },
    DepSpec {
        id: "usbmuxd",
        name: "usbmuxd",
        version_arg: None,
        hint: "Built into macOS; on Windows install Apple Mobile Device Support (iTunes); on Linux `apt install usbmuxd`.",
        optional: false,
    },
    DepSpec {
        id: "ifuse",
        name: "ifuse",
        version_arg: None,
        hint: "Optional: brew install --cask macfuse && brew install ifuse (macOS/Linux only)",
        optional: true,
    },
];

/// Probe the environment for each supported tool. External binaries are found
/// via `which` (no shell). `usbmuxd` gets platform-aware detection because on
/// macOS it is Apple's built-in system daemon rather than a PATH binary.
pub fn check_all() -> Vec<DependencyInfo> {
    DEPS.iter()
        .map(|spec| {
            if spec.id == "usbmuxd" {
                return detect_usbmuxd(spec);
            }

            let resolved = resolve_tool(spec.name);
            let detected = resolved.is_some();
            let path = resolved.as_ref().map(|p| p.display().to_string());
            let version = match &resolved {
                Some(p) => probe_version(&p.display().to_string(), spec.version_arg),
                None => None,
            };

            DependencyInfo {
                id: spec.id.to_string(),
                name: spec.name.to_string(),
                detected,
                version,
                path,
                install_hint: platform_hint(spec.hint),
                optional: spec.optional,
                last_checked_at: Some(now_iso()),
            }
        })
        .collect()
}

fn probe_version(name: &str, arg: Option<&str>) -> Option<String> {
    let arg = arg?;
    command_runner::run(name, &[arg], Duration::from_secs(5))
        .ok()
        .and_then(|o| {
            let text = if o.stdout.trim().is_empty() {
                o.stderr
            } else {
                o.stdout
            };
            text.split_whitespace()
                .find(|t| t.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false))
                .map(|s| s.to_string())
        })
}

/// Detect the usbmuxd USB-multiplexing service in a platform-aware way.
fn detect_usbmuxd(spec: &DepSpec) -> DependencyInfo {
    let mut detected = false;
    let mut path: Option<String> = None;
    let mut version: Option<String> = None;

    // 1) A PATH binary (common on Linux, or the libusbmuxd `iproxy` tool).
    if let Some(p) = resolve_tool("usbmuxd") {
        detected = true;
        path = Some(p.display().to_string());
    }

    // 2) macOS: Apple ships usbmuxd as a system LaunchDaemon.
    #[cfg(target_os = "macos")]
    {
        let apple_plist =
            std::path::Path::new("/Library/Apple/System/Library/LaunchDaemons/com.apple.usbmuxd.plist");
        if apple_plist.exists() {
            detected = true;
            path.get_or_insert_with(|| "system (com.apple.usbmuxd)".to_string());
            version.get_or_insert_with(|| "system".to_string());
        }
    }

    // 3) libusbmuxd (Homebrew/scoop) provides `iproxy`; treat as support present.
    if !detected {
        if let Some(p) = resolve_tool("iproxy") {
            detected = true;
            path = Some(p.display().to_string());
        }
    }

    // 4) Windows: Apple Mobile Device Service (installed with iTunes / the
    //    Apple Devices app) provides the usbmuxd equivalent.
    #[cfg(target_os = "windows")]
    if !detected {
        let svc = std::process::Command::new("sc")
            .args(["query", "Apple Mobile Device Service"])
            .output();
        if let Ok(out) = svc {
            if out.status.success() {
                detected = true;
                path.get_or_insert_with(|| "system (Apple Mobile Device Service)".to_string());
                version.get_or_insert_with(|| "system".to_string());
            }
        }
    }

    DependencyInfo {
        id: spec.id.to_string(),
        name: spec.name.to_string(),
        detected,
        version,
        path,
        install_hint: platform_hint(spec.hint),
        optional: spec.optional,
        last_checked_at: Some(now_iso()),
    }
}

/// Rewrite the (macOS-oriented) install hint for the current platform.
fn platform_hint(hint: &str) -> String {
    let is_libimobiledevice =
        hint.contains("libimobiledevice") && !hint.contains("Apple Mobile Device");
    #[cfg(target_os = "windows")]
    if is_libimobiledevice {
        return "Install libimobiledevice (e.g. `scoop install libimobiledevice`) and the Apple Devices app / iTunes for USB drivers.".to_string();
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    if is_libimobiledevice {
        return "sudo apt install libimobiledevice-utils usbmuxd ffmpeg (or your distro's equivalent).".to_string();
    }
    let _ = is_libimobiledevice;
    hint.to_string()
}

/// Whether the minimum set of tools required for real-device operation exists.
pub fn core_tools_present(deps: &[DependencyInfo]) -> bool {
    let required = ["idevice_id", "ideviceinfo"];
    required
        .iter()
        .all(|r| deps.iter().any(|d| d.id == *r && d.detected))
}
