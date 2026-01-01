//! Council Server module.
//!
//! Provides HTTP + WebSocket server functionality for proxying
//! LLM council requests to the Chrome extension.

mod handlers;
mod persistence;
mod server;
mod state;
mod types;
mod websocket;

use server::{start_server, stop_server, DEFAULT_PORT};
use state::{is_server_running, SERVER_STATE};
use types::CouncilServerStatus;

// Re-export for background startup
pub use server::{start_server as start_server_internal, DEFAULT_PORT as COUNCIL_PORT};

/// Start the council HTTP+WebSocket server on port 3456
#[tauri::command]
pub async fn start_council_server() -> Result<bool, String> {
    if is_server_running() {
        return Err("Server is already running".to_string());
    }

    // Spawn the server in a background task
    tauri::async_runtime::spawn(async {
        if let Err(e) = start_server(DEFAULT_PORT).await {
            eprintln!("[Council Server] Error: {}", e);
        }
    });

    // Wait a moment for the server to start
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;

    Ok(is_server_running())
}

/// Stop the council server
#[tauri::command]
pub async fn stop_council_server() -> Result<bool, String> {
    if !is_server_running() {
        return Ok(true); // Already stopped
    }

    stop_server().await?;

    // Wait a moment for cleanup
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;

    Ok(!is_server_running())
}

/// Get the current status of the council server
#[tauri::command]
pub async fn get_council_server_status() -> CouncilServerStatus {
    let running = is_server_running();

    let (extension_connected, uptime_ms) = if running {
        let state_guard = SERVER_STATE.read().await;
        if let Some(ref state) = *state_guard {
            let connected = state.is_extension_connected().await;
            let uptime = state.uptime_ms();
            (connected, Some(uptime))
        } else {
            (false, None)
        }
    } else {
        (false, None)
    };

    CouncilServerStatus {
        running,
        port: DEFAULT_PORT,
        extension_connected,
        uptime_ms,
    }
}
