//! Read-only device authenticity & health report. Aggregates data we already
//! read from the device (model, firmware, battery, activation/trust state) into
//! a set of consistency checks and an overall verdict.
//!
//! NOTE: This is a health/consistency summary, not a definitive proof of
//! genuineness. It never contacts Apple or any network, and performs no bypass.

use crate::core::app_state::AppState;
use crate::core::errors::{envelope, CommandResult};
use crate::models::{AuthenticityCheck, AuthenticityReport, DeviceInfo};
use crate::security::path_validation::sanitize_identifier;
use tauri::State;

fn check(id: &str, label: &str, status: &str, detail: impl Into<String>) -> AuthenticityCheck {
    AuthenticityCheck {
        id: id.to_string(),
        label: label.to_string(),
        status: status.to_string(),
        detail: detail.into(),
    }
}

fn build(info: &DeviceInfo) -> AuthenticityReport {
    let mut checks = Vec::new();
    let mut has_fail = false;
    let mut has_warn = false;

    // Model / marketing name consistency.
    if !info.model.is_empty() && info.model != info.product_type {
        checks.push(check(
            "model",
            "Model identifier",
            "pass",
            format!("{} ({})", info.model, info.product_type),
        ));
    } else {
        has_warn = true;
        checks.push(check(
            "model",
            "Model identifier",
            "warn",
            "Marketing name could not be resolved from the product type.",
        ));
    }

    // Serial number present + plausible length.
    if info.serial_number.len() >= 8 {
        checks.push(check("serial", "Serial number", "pass", &info.serial_number));
    } else {
        has_warn = true;
        checks.push(check(
            "serial",
            "Serial number",
            "warn",
            "Serial number is missing or unusually short.",
        ));
    }

    // Firmware.
    if !info.os_version.is_empty() {
        let build = info.build_version.clone().unwrap_or_default();
        checks.push(check(
            "firmware",
            "iOS/iPadOS version",
            "pass",
            format!("{} {}", info.os_version, build).trim().to_string(),
        ));
    } else {
        has_warn = true;
        checks.push(check("firmware", "iOS/iPadOS version", "warn", "Unknown firmware."));
    }

    // Battery health.
    match info.battery.health_percent {
        Some(h) if h >= 80 => {
            checks.push(check("battery", "Battery health", "pass", format!("{h}% of design capacity")))
        }
        Some(h) if h >= 50 => {
            has_warn = true;
            checks.push(check(
                "battery",
                "Battery health",
                "warn",
                format!("{h}% — degraded, consider a battery service."),
            ))
        }
        Some(h) => {
            has_fail = true;
            checks.push(check(
                "battery",
                "Battery health",
                "fail",
                format!("{h}% — very low; battery may be worn or non-genuine."),
            ))
        }
        None => checks.push(check("battery", "Battery health", "info", "Not reported by the device.")),
    }

    if let Some(c) = info.battery.cycle_count {
        let status = if c > 1000 { "warn" } else { "info" };
        if status == "warn" {
            has_warn = true;
        }
        checks.push(check("cycles", "Battery charge cycles", status, format!("{c} cycles")));
    }

    // Activation state.
    match info.activation_state.as_deref() {
        Some("Activated") => checks.push(check("activation", "Activation state", "pass", "Activated")),
        Some(other) => {
            has_warn = true;
            checks.push(check("activation", "Activation state", "warn", other.to_string()))
        }
        None => checks.push(check("activation", "Activation state", "info", "Unknown.")),
    }

    // Trust / pairing.
    if info.trust_state == "trusted" {
        checks.push(check("trust", "Pairing trust", "pass", "This computer is trusted."));
    } else {
        checks.push(check(
            "trust",
            "Pairing trust",
            "info",
            "Device is not paired/trusted with this computer.",
        ));
    }

    let verdict = if has_fail || has_warn {
        "review"
    } else {
        "genuine"
    };

    AuthenticityReport {
        udid: info.udid.clone(),
        name: info.name.clone(),
        model: info.model.clone(),
        product_type: info.product_type.clone(),
        os_version: info.os_version.clone(),
        serial_number: info.serial_number.clone(),
        battery_health: info.battery.health_percent,
        cycle_count: info.battery.cycle_count,
        activation_state: info.activation_state.clone(),
        trust_state: info.trust_state.clone(),
        supervised: false,
        verdict: verdict.to_string(),
        checks,
    }
}

#[tauri::command]
pub fn authenticity_report(
    state: State<AppState>,
    udid: String,
) -> CommandResult<AuthenticityReport> {
    envelope((|| {
        let udid = sanitize_identifier(&udid)?;
        let info = state.bridge().get_device_info(&udid)?;
        Ok(build(&info))
    })())
}
