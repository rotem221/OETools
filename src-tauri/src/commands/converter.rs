//! Local media conversion: HEIC/image transcoding, audio/video conversion, and
//! ringtone (`.m4r`) creation. Uses macOS `sips` for images when available and
//! falls back to `ffmpeg` (Windows/Linux) for images, audio and video.
//! Fully local — no network, no device required.

use crate::core::app_state::AppState;
use crate::core::errors::{envelope, CommandError, CommandResult};
use crate::core::job_queue;
use crate::models::{ConvertResult, Job};
use crate::security::command_runner;
use crate::security::path_validation::{validate_existing_path, validate_writable_dir};
use std::path::Path;
use std::time::Duration;
use tauri::{AppHandle, State};

fn which_bin(name: &str) -> Option<String> {
    which::which(name).ok().map(|p| p.display().to_string())
}

fn is_image_target(t: &str) -> bool {
    matches!(t, "jpg" | "jpeg" | "png" | "tiff" | "gif" | "bmp")
}

fn is_audio_target(t: &str) -> bool {
    matches!(t, "m4a" | "mp3" | "wav" | "aac" | "flac" | "m4r")
}

fn sips_format(t: &str) -> &str {
    match t {
        "jpg" | "jpeg" => "jpeg",
        "png" => "png",
        "tiff" => "tiff",
        "gif" => "gif",
        "bmp" => "bmp",
        other => other,
    }
}

/// Whitelist of supported output extensions.
fn sanitize_target(target: &str) -> Result<String, CommandError> {
    let t = target.trim().to_ascii_lowercase();
    let ok = is_image_target(&t)
        || is_audio_target(&t)
        || matches!(t.as_str(), "mp4" | "mov" | "mkv" | "webm");
    if ok {
        Ok(t)
    } else {
        Err(CommandError::new(format!("Unsupported output format \"{target}\".")))
    }
}

fn output_path(output_dir: &Path, input: &Path, target: &str) -> std::path::PathBuf {
    let stem = input
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "converted".into());
    output_dir.join(format!("{stem}.{target}"))
}

/// Convert one file. Returns true on success.
fn convert_one(input: &Path, out: &Path, target: &str) -> bool {
    let input_s = input.to_string_lossy().to_string();
    let out_s = out.to_string_lossy().to_string();

    if is_image_target(target) {
        // Prefer macOS `sips` (handles HEIC natively); fall back to `ffmpeg`
        // on Windows/Linux where sips is unavailable.
        if let Some(sips) = which_bin("sips") {
            return matches!(
                command_runner::run(
                    &sips,
                    &["-s", "format", sips_format(target), &input_s, "--out", &out_s],
                    Duration::from_secs(45),
                ),
                Ok(o) if o.success
            );
        }
        if let Some(ff) = which_bin("ffmpeg") {
            return matches!(
                command_runner::run(ff.as_str(), &["-y", "-i", &input_s, &out_s], Duration::from_secs(120)),
                Ok(o) if o.success
            );
        }
        return false;
    }

    // Audio + video handled by ffmpeg.
    let Some(ff) = which_bin("ffmpeg") else {
        return false;
    };
    let mut args: Vec<&str> = vec!["-y", "-i", &input_s];
    // `.m4r` = AAC in an MP4 container; force the ipod muxer so the extension
    // isn't rejected.
    if target == "m4r" {
        args.extend_from_slice(&["-c:a", "aac", "-b:a", "192k", "-f", "ipod"]);
    }
    args.push(&out_s);
    matches!(
        command_runner::run(ff.as_str(), &args, Duration::from_secs(300)),
        Ok(o) if o.success
    )
}

/// Batch-convert files to a target format as a background job.
#[tauri::command]
pub fn convert_media(
    app: AppHandle,
    state: State<AppState>,
    inputs: Vec<String>,
    output_dir: String,
    target: String,
) -> CommandResult<Job> {
    envelope((|| {
        if inputs.is_empty() {
            return Err(CommandError::new("Select at least one file to convert."));
        }
        let target = sanitize_target(&target)?;
        let out_dir = validate_writable_dir(&output_dir)?;

        let mut valid_inputs = Vec::new();
        for i in &inputs {
            valid_inputs.push(validate_existing_path(i)?);
        }

        // Ensure the right tool exists before we start.
        let needs_ffmpeg = !is_image_target(&target);
        if needs_ffmpeg && which_bin("ffmpeg").is_none() {
            return Err(CommandError::missing_dependency(
                "ffmpeg",
                "brew install ffmpeg",
            ));
        }
        if is_image_target(&target) && which_bin("sips").is_none() && which_bin("ffmpeg").is_none() {
            return Err(CommandError::missing_dependency("ffmpeg", "brew install ffmpeg"));
        }

        let job = job_queue::create(
            &state.db,
            &app,
            "media_convert",
            &format!("Convert {} file(s) → {}", valid_inputs.len(), target),
            Some("Local media conversion"),
            None,
            false,
        );

        let db = state.db.clone();
        let out_dir_c = out_dir;
        let target_c = target;
        let mut worker = job.clone();

        std::thread::spawn(move || {
            let total = valid_inputs.len();
            let mut converted = 0i64;
            let mut failed = 0i64;
            for (idx, input) in valid_inputs.iter().enumerate() {
                let out = output_path(&out_dir_c, input, &target_c);
                if convert_one(input, &out, &target_c) {
                    converted += 1;
                } else {
                    failed += 1;
                }
                let pct = (((idx + 1) as f64 / total as f64) * 100.0) as i64;
                job_queue::progress(&db, &app, &mut worker, pct);
            }
            if failed > 0 && converted == 0 {
                job_queue::fail(
                    &db,
                    &app,
                    &mut worker,
                    "No files could be converted. Check that ffmpeg/sips are installed.",
                );
            } else {
                job_queue::complete(&db, &app, &mut worker);
            }
        });

        Ok(job)
    })())
}

/// Create a single ringtone (`.m4r`) from an audio/video file, trimmed to a
/// start offset and duration (Apple limits ringtones to ~40s).
#[tauri::command]
pub fn make_ringtone(
    input: String,
    output_dir: String,
    start_sec: f64,
    duration_sec: f64,
) -> CommandResult<ConvertResult> {
    envelope((|| {
        let input_path = validate_existing_path(&input)?;
        let out_dir = validate_writable_dir(&output_dir)?;
        let ff = which_bin("ffmpeg")
            .ok_or_else(|| CommandError::missing_dependency("ffmpeg", "brew install ffmpeg"))?;

        let start = start_sec.max(0.0);
        let dur = duration_sec.clamp(1.0, 40.0);
        let start_s = format!("{start:.2}");
        let dur_s = format!("{dur:.2}");

        let out = output_path(&out_dir, &input_path, "m4r");
        let input_s = input_path.to_string_lossy().to_string();
        let out_s = out.to_string_lossy().to_string();

        let result = command_runner::run(
            &ff,
            &[
                "-y", "-ss", &start_s, "-t", &dur_s, "-i", &input_s, "-c:a", "aac", "-b:a", "192k",
                "-f", "ipod", &out_s,
            ],
            Duration::from_secs(120),
        )?;

        if !result.success {
            return Err(CommandError::new("Ringtone creation failed.")
                .with_details(result.stderr)
                .with_fix("Make sure the input is a valid audio/video file."));
        }

        Ok(ConvertResult {
            output_paths: vec![out_s],
            converted: 1,
            failed: 0,
            output_dir: out_dir.to_string_lossy().to_string(),
        })
    })())
}
