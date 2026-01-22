// LifeOS Nexus - Personal life operating system

mod api_keys;
mod app_category;
mod beeper;
mod claudecode;
mod coder;
mod council_server;
mod notes;
mod screentime;
mod voicememos;
mod youtube;

use api_keys::{
    delete_groq_api_key, get_groq_api_key, open_full_disk_access_settings, save_groq_api_key,
};
use beeper::{
    check_beeper_available, check_beeper_database_exists, get_beeper_conversation,
    get_beeper_conversation_by_id, get_beeper_messages, get_beeper_threads,
    search_beeper_messages, sync_beeper_database,
};
use claudecode::{
    check_docker_available, execute_claude_prompt, get_container_status, start_container,
    stop_container,
};
use coder::{delegate_to_coder, get_coder_presets, get_coder_templates};
use council_server::{get_council_server_status, start_council_server, stop_council_server};
use notes::{
    count_apple_notes, export_apple_notes, export_notes_internal, get_exported_folders,
    get_exported_notes, should_run_notes_sync,
};
use screentime::{
    check_screentime_permission, debug_biome_raw_events, debug_screentime_devices, get_device_id,
    get_screentime_daily_stats, get_screentime_recent_summaries, get_screentime_sync_history,
    list_screentime_devices, migrate_screentime_categories, read_screentime_sessions,
    sync_screentime_internal, sync_screentime_to_local_db, wipe_screentime_database,
};
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use tokio::time::sleep;
use voicememos::{
    check_transcription_eligibility, check_voicememos_permission, get_voicememo, get_voicememos,
    sync_voicememos, transcribe_voicememo, transcribe_voicememos_batch,
};
use youtube::fetch_youtube_transcript;

// Tray title commands for Pomodoro timer display
#[tauri::command]
fn set_tray_title(app: tauri::AppHandle, title: String) {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let _ = tray.set_title(Some(&title));
    }
}

#[tauri::command]
fn clear_tray_title(app: tauri::AppHandle) {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let _ = tray.set_title(None::<&str>);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env file for environment variables (like GROQ_API_KEY)
    dotenvy::dotenv().ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_oauth::init())
        .plugin(
            tauri_plugin_clerk::ClerkPluginBuilder::new()
                .publishable_key(
                    option_env!("VITE_CLERK_PUBLISHABLE_KEY").unwrap_or(
                        "pk_test_Y2xpbWJpbmctYmFybmFjbGUtODUuY2xlcmsuYWNjb3VudHMuZGV2JA",
                    ),
                )
                .with_tauri_store()
                .build(),
        )
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_macos_permissions::init())
        .setup(|app| {
            // Create menu items for tray context menu
            // Shortcuts differ by build mode:
            // - Production: Ctrl+1/2
            // - Staging: Ctrl+Shift+1/2
            // - Dev: Ctrl+Shift+3/4 (to avoid conflicts with staging)
            let is_production = option_env!("TAURI_BUILD_MODE") == Some("production");
            let is_staging = app.config().identifier.contains("staging");
            let (shortcut_hint_1, shortcut_hint_2) = if is_production {
                ("⌃1", "⌃2")
            } else if is_staging {
                ("⌃⇧1", "⌃⇧2")
            } else {
                ("⌃⇧3", "⌃⇧4")
            };

            let sync_jobs = MenuItem::with_id(
                app,
                "sync_jobs",
                format!("Background Sync Jobs\t{}", shortcut_hint_1),
                true,
                None::<&str>,
            )?;
            let lifeos_app = MenuItem::with_id(
                app,
                "lifeos_app",
                format!("LifeOS App\t{}", shortcut_hint_2),
                true,
                None::<&str>,
            )?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            // Build context menu
            let menu = Menu::with_items(app, &[&sync_jobs, &lifeos_app, &quit])?;

            // Build tray icon with menu
            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .icon_as_template(true) // macOS menu bar style
                .menu(&menu)
                .show_menu_on_left_click(true) // Left-click shows menu
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "sync_jobs" => {
                            // Show/focus the main LifeOS Nexus window
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "lifeos_app" => {
                            // Show/focus the LifeOS window
                            if let Some(window) = app.get_webview_window("lifeos") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // Register global keyboard shortcuts
            // Production: Ctrl+1/2, Staging: Ctrl+Shift+1/2, Dev: Ctrl+Shift+3/4
            let (modifiers, key_1, key_2) = if is_production {
                (Some(Modifiers::CONTROL), Code::Digit1, Code::Digit2)
            } else if is_staging {
                (Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Digit1, Code::Digit2)
            } else {
                (Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Digit3, Code::Digit4)
            };
            let shortcut_1 = Shortcut::new(modifiers, key_1);
            let shortcut_2 = Shortcut::new(modifiers, key_2);

            let app_handle = app.handle().clone();
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |_app, shortcut, _event| {
                        if shortcut == &shortcut_1 {
                            // Show/focus the main LifeOS Nexus window (Background Sync Jobs)
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        } else if shortcut == &shortcut_2 {
                            // Show/focus the LifeOS window
                            if let Some(window) = app_handle.get_webview_window("lifeos") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    })
                    .build(),
            )?;

            // Register the shortcuts
            app.global_shortcut().register(shortcut_1)?;
            app.global_shortcut().register(shortcut_2)?;

            // Start background screentime sync scheduler (every 30 minutes)
            tauri::async_runtime::spawn(async {
                // Initial delay of 10 seconds before first sync
                sleep(Duration::from_secs(10)).await;

                loop {
                    println!("[Background Sync] Running scheduled screentime sync...");

                    // Run the sync in a blocking task since it uses SQLite
                    let result = tauri::async_runtime::spawn_blocking(sync_screentime_internal).await;

                    match result {
                        Ok(Ok(sync_result)) => {
                            println!(
                                "[Background Sync] Screentime sync complete: {} knowledge, {} biome, {} summaries",
                                sync_result.knowledge_sessions,
                                sync_result.biome_sessions,
                                sync_result.daily_summaries
                            );
                        }
                        Ok(Err(e)) => {
                            println!("[Background Sync] Screentime sync failed: {}", e);
                        }
                        Err(e) => {
                            println!("[Background Sync] Screentime sync task error: {}", e);
                        }
                    }

                    // Wait 30 minutes before next sync
                    sleep(Duration::from_secs(30 * 60)).await;
                }
            });

            // Start background notes export scheduler (once per day)
            tauri::async_runtime::spawn(async {
                // Initial delay of 30 seconds before first check
                sleep(Duration::from_secs(30)).await;

                loop {
                    // Check if we should run notes sync (once per day)
                    let should_sync = tauri::async_runtime::spawn_blocking(should_run_notes_sync)
                        .await
                        .unwrap_or(false);

                    if should_sync {
                        println!("[Background Sync] Running scheduled notes export (daily)...");

                        // Run the export in a blocking task since it uses SQLite and AppleScript
                        let result = tauri::async_runtime::spawn_blocking(export_notes_internal).await;

                        match result {
                            Ok(Ok(sync_result)) => {
                                println!(
                                    "[Background Sync] Notes export complete: {} exported, {} unchanged, {} total",
                                    sync_result.exported_count,
                                    sync_result.skipped_count,
                                    sync_result.total_processed
                                );
                            }
                            Ok(Err(e)) => {
                                println!("[Background Sync] Notes export failed: {}", e);
                            }
                            Err(e) => {
                                println!("[Background Sync] Notes export task error: {}", e);
                            }
                        }
                    } else {
                        println!("[Background Sync] Notes export skipped (already synced today)");
                    }

                    // Check every hour if we need to run notes sync
                    // This ensures we catch the 24-hour mark even if app was closed
                    sleep(Duration::from_secs(60 * 60)).await;
                }
            });

            // Council server auto-start disabled - can be started manually via start_council_server command
            // tauri::async_runtime::spawn(async {
            //     // Short delay to let the app fully initialize
            //     sleep(Duration::from_secs(3)).await;
            //
            //     println!(
            //         "[Council Server] Starting server automatically on port {}...",
            //         COUNCIL_PORT
            //     );
            //
            //     if let Err(e) = start_server_internal(COUNCIL_PORT).await {
            //         eprintln!("[Council Server] Failed to start: {}", e);
            //     } else {
            //         println!("[Council Server] Started successfully on port {}", COUNCIL_PORT);
            //     }
            // });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_screentime_permission,
            read_screentime_sessions,
            get_device_id,
            list_screentime_devices,
            get_screentime_daily_stats,
            get_screentime_recent_summaries,
            get_screentime_sync_history,
            sync_screentime_to_local_db,
            wipe_screentime_database,
            debug_screentime_devices,
            debug_biome_raw_events,
            migrate_screentime_categories,
            count_apple_notes,
            export_apple_notes,
            get_exported_notes,
            get_exported_folders,
            fetch_youtube_transcript,
            sync_voicememos,
            get_voicememos,
            get_voicememo,
            transcribe_voicememo,
            transcribe_voicememos_batch,
            check_transcription_eligibility,
            check_voicememos_permission,
            // Council Server
            start_council_server,
            stop_council_server,
            get_council_server_status,
            // API Keys
            save_groq_api_key,
            get_groq_api_key,
            delete_groq_api_key,
            open_full_disk_access_settings,
            // Tray
            set_tray_title,
            clear_tray_title,
            // Coder Agent Delegation
            get_coder_templates,
            get_coder_presets,
            delegate_to_coder,
            // Beeper Integration
            check_beeper_available,
            check_beeper_database_exists,
            sync_beeper_database,
            get_beeper_threads,
            get_beeper_conversation,
            get_beeper_conversation_by_id,
            get_beeper_messages,
            search_beeper_messages,
            // ClaudeCode Integration
            check_docker_available,
            get_container_status,
            start_container,
            stop_container,
            execute_claude_prompt,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
