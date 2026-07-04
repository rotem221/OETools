use std::collections::BTreeMap;

/// Parse `ideviceinfo` style `Key: Value` output into a normalized map.
/// Only well-known, non-sensitive keys are retained downstream.
pub fn parse_key_values(output: &str) -> BTreeMap<String, String> {
    let mut map = BTreeMap::new();
    for line in output.lines() {
        if let Some((k, v)) = line.split_once(':') {
            let key = k.trim().to_string();
            let value = v.trim().to_string();
            if !key.is_empty() {
                map.insert(key, value);
            }
        }
    }
    map
}

/// Extract flat key/value pairs from an XML property list.
///
/// `idevicediagnostics` prints results as an XML plist (often nested). We scan
/// for `<key>NAME</key>` immediately followed by a scalar value tag
/// (`<integer>`, `<real>`, `<string>`, `<date>`, or `<true/>`/`<false/>`).
/// Because each new `<key>` overwrites the pending key, values inside nested
/// dicts are still captured by their own key name — which is all we need for
/// well-known leaf fields like `CycleCount` and `DesignCapacity`.
pub fn parse_plist_flat(xml: &str) -> BTreeMap<String, String> {
    let mut map = BTreeMap::new();
    let mut pending_key: Option<String> = None;

    for chunk in xml.split('<') {
        let Some((tag, rest)) = chunk.split_once('>') else {
            continue;
        };
        let tag = tag.trim();
        let text = rest.trim();
        match tag {
            "key" => pending_key = Some(text.to_string()),
            "integer" | "real" | "string" | "date" => {
                if let Some(k) = pending_key.take() {
                    map.insert(k, text.to_string());
                }
            }
            "true/" => {
                if let Some(k) = pending_key.take() {
                    map.insert(k, "true".to_string());
                }
            }
            "false/" => {
                if let Some(k) = pending_key.take() {
                    map.insert(k, "false".to_string());
                }
            }
            _ => {}
        }
    }
    map
}

/// Keys considered safe to surface in the raw viewer. We deliberately exclude
/// anything that could be sensitive (keys, tokens, certificates, IMEI, etc.).
const SAFE_RAW_KEYS: &[&str] = &[
    "DeviceName",
    "ProductType",
    "ProductVersion",
    "BuildVersion",
    "DeviceClass",
    "HardwareModel",
    "ModelNumber",
    "RegionInfo",
    "CPUArchitecture",
    "TimeZone",
    "TelephonyCapability",
    "WiFiAddress",
    "DeviceColor",
    "DeviceEnclosureColor",
    "PasswordProtected",
    "TrustedHostAttached",
];

pub fn filter_safe(map: &BTreeMap<String, String>) -> BTreeMap<String, String> {
    map.iter()
        .filter(|(k, _)| SAFE_RAW_KEYS.contains(&k.as_str()))
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect()
}

/// Derive a device kind from the product type string.
pub fn kind_from_product_type(product_type: &str) -> &'static str {
    if product_type.starts_with("iPhone") {
        "iphone"
    } else if product_type.starts_with("iPad") {
        "ipad"
    } else if product_type.starts_with("iPod") {
        "ipod"
    } else {
        "unknown"
    }
}

/// Best-effort marketing model name from a product type identifier.
pub fn model_name(product_type: &str) -> String {
    // A small lookup covering common recent models; falls back to the raw id.
    let name = match product_type {
        "iPhone15,3" => "iPhone 14 Pro Max",
        "iPhone15,2" => "iPhone 14 Pro",
        "iPhone14,7" => "iPhone 14",
        "iPhone16,2" => "iPhone 15 Pro Max",
        "iPad14,5" => "iPad Pro 12.9 (6th gen)",
        "iPad13,4" => "iPad Pro 11 (3rd gen)",
        _ => product_type,
    };
    name.to_string()
}
