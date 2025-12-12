// TubeVault - YouTube playlist sync to Convex

mod notes;
mod screentime;

use notes::{count_apple_notes, export_apple_notes, get_exported_folders, get_exported_notes};
use screentime::{check_screentime_permission, get_device_id, read_screentime_sessions};
use tauri::{
    tray::TrayIconEvent,
    Manager,
};

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
                .publishable_key(option_env!("VITE_CLERK_PUBLISHABLE_KEY").unwrap_or("pk_test_Y2xpbWJpbmctYmFybmFjbGUtODUuY2xlcmsuYWNjb3VudHMuZGV2JA"))
                .with_tauri_store()
                .build()
        )
        .invoke_handler(tauri::generate_handler![
            check_screentime_permission,
            read_screentime_sessions,
            get_device_id,
            count_apple_notes,
            export_apple_notes,
            get_exported_notes,
            get_exported_folders,
        ])
        .on_tray_icon_event(|tray, event| {
            match event {
                TrayIconEvent::Click {
                    button: tauri::tray::MouseButton::Left,
                    button_state: tauri::tray::MouseButtonState::Up,
                    ..
                } => {
                    let app = tray.app_handle();
                    if let Some(window) = app.get_webview_window("main") {
                        // Toggle window visibility
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
