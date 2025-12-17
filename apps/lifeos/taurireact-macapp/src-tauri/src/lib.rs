// LifeOS Nexus - Personal life operating system

mod notes;
mod screentime;
mod youtube;

use notes::{count_apple_notes, export_apple_notes, get_exported_folders, get_exported_notes};
use screentime::{
    check_screentime_permission, get_device_id, get_screentime_daily_stats,
    get_screentime_recent_summaries, get_screentime_sync_history, list_screentime_devices,
    read_screentime_sessions, sync_screentime_internal, sync_screentime_to_local_db,
};
use std::time::Duration;
use tokio::time::sleep;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};
use youtube::fetch_youtube_transcript;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
        .setup(|app| {
            // Create menu items for tray context menu
            let sync_jobs =
                MenuItem::with_id(app, "sync_jobs", "Background Sync Jobs", true, None::<&str>)?;
            let lifeos_app =
                MenuItem::with_id(app, "lifeos_app", "LifeOS App", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            // Build context menu
            let menu = Menu::with_items(app, &[&sync_jobs, &lifeos_app, &quit])?;

            // Build tray icon with menu
            let _tray = TrayIconBuilder::new()
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
            count_apple_notes,
            export_apple_notes,
            get_exported_notes,
            get_exported_folders,
            fetch_youtube_transcript,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
