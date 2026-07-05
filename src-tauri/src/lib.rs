pub mod commands;
pub mod core;
pub mod database;
pub mod device_bridge;
pub mod models;
pub mod security;

use crate::core::app_state::AppState;
use crate::core::filesystem;
use crate::database::repositories::settings as settings_repo;
use crate::database::Database;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Open (and migrate) the local SQLite database.
    let db_path = filesystem::database_path();
    let db = Database::open(&db_path).expect("failed to open database");
    let db = Arc::new(db);

    // Ensure configured storage directories exist on startup.
    {
        let conn = db.conn.lock().unwrap();
        let settings = settings_repo::get(&conn);
        drop(conn);
        let _ = filesystem::ensure_storage_dirs(&settings);
    }

    let state = AppState::new(db);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            // devices
            commands::devices::list_devices,
            commands::devices::get_device_info,
            commands::devices::refresh_device,
            commands::devices::pair_device,
            commands::devices::get_trust_status,
            // backups
            commands::backups::create_backup,
            commands::backups::list_backups,
            commands::backups::get_backup_details,
            commands::backups::cancel_backup,
            commands::backups::open_backup_folder,
            // media
            commands::media::list_media,
            commands::media::media_info,
            commands::media::media_thumbnail,
            commands::media::export_media,
            commands::media::cancel_media_export,
            // diagnostics
            commands::diagnostics::start_syslog,
            commands::diagnostics::stop_syslog,
            commands::diagnostics::collect_crash_reports,
            commands::diagnostics::recent_logs,
            commands::diagnostics::export_logs,
            commands::diagnostics::run_dependency_check,
            // reports
            commands::reports::generate_report,
            commands::reports::list_reports,
            commands::reports::open_report,
            commands::reports::delete_report,
            // settings
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::select_folder,
            commands::settings::select_files,
            commands::settings::open_app_data_folder,
            commands::settings::reset_settings,
            commands::settings::clear_app_history,
            commands::settings::delete_known_devices,
            // jobs
            commands::jobs::list_jobs,
            commands::jobs::get_job,
            commands::jobs::cancel_job,
            commands::jobs::clear_completed_jobs,
            // backup snapshots + retention
            commands::snapshots::list_snapshots,
            commands::snapshots::set_snapshot_protected,
            commands::snapshots::update_snapshot,
            commands::snapshots::delete_snapshot,
            commands::snapshots::get_retention_policy,
            commands::snapshots::save_retention_policy,
            commands::snapshots::cleanup_recommendations,
            commands::snapshots::export_snapshot_metadata,
            commands::snapshots::open_snapshot_folder,
            // scheduled backups
            commands::schedules::list_schedules,
            commands::schedules::save_schedule,
            commands::schedules::delete_schedule,
            commands::schedules::due_schedules,
            // privacy center
            commands::privacy::get_privacy_summary,
            commands::privacy::delete_privacy_category,
            commands::privacy::factory_reset_app,
            // battery history
            commands::battery::list_battery_history,
            // media / ringtone converter
            commands::converter::convert_media,
            commands::converter::make_ringtone,
            // device authenticity report
            commands::authenticity::authenticity_report,
            // backup browser / extractor
            commands::backup_browser::detect_backups,
            commands::backup_browser::open_backup_source,
            commands::backup_browser::list_backup_categories,
            commands::backup_browser::export_backup_category,
            // messages
            commands::messages::list_conversations,
            commands::messages::get_conversation,
            commands::messages::export_messages,
            // data export (contacts / notes / whatsapp / export-all)
            commands::data_export::list_contacts,
            commands::data_export::export_contacts,
            commands::data_export::list_notes,
            commands::data_export::get_note,
            commands::data_export::export_notes,
            commands::data_export::list_wa_chats,
            commands::data_export::get_wa_chat,
            commands::data_export::export_wa_chat,
            commands::data_export::export_all_data,
            // export history + evidence export
            commands::exports::list_export_history,
            commands::exports::open_export,
            commands::exports::delete_export,
            commands::exports::create_evidence_package,
            // device file browser + quick transfer
            commands::transfer::list_device_files,
            commands::transfer::download_device_files,
            commands::transfer::upload_to_device,
            commands::transfer::cancel_transfer,
            // business: profiles, supervision, fleet
            commands::business::import_profile,
            commands::business::list_profiles,
            commands::business::delete_profile,
            commands::business::export_profile,
            commands::business::list_profile_templates,
            commands::business::save_profile_template,
            commands::business::delete_profile_template,
            commands::business::export_profile_template,
            commands::business::list_supervision,
            commands::business::refresh_supervision,
            commands::business::set_supervision_org,
            commands::business::list_assets,
            commands::business::save_asset,
            // security analyzer
            commands::security::run_security_scan,
            commands::security::list_security_scans,
            commands::security::get_scan_findings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running OETools");
}
