//! Axum server setup and lifecycle management.

use axum::{
    routing::{delete, get, post},
    Router,
};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::oneshot;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};

use super::handlers::*;
use super::persistence;
use super::state::{
    is_server_running, set_server_running, CouncilServerState, SERVER_STATE, SHUTDOWN_TX,
};
use super::websocket::ws_handler;

/// Get the path to the dist-server directory
fn get_static_dir() -> Option<PathBuf> {
    // Try multiple possible locations for the dist-server directory
    let possible_paths = [
        // Development: relative to the monorepo root
        std::env::current_dir().ok()?.join("../../packages/chatgptwrapper_ext/dist-server"),
        // From Tauri app directory
        std::env::current_dir().ok()?.join("../../../packages/chatgptwrapper_ext/dist-server"),
        // Absolute path for development
        PathBuf::from("/Volumes/SandiskSSD/MacMini/Documents/01.codes/00.Projects/hola-monorepo/packages/chatgptwrapper_ext/dist-server"),
    ];

    for path in possible_paths {
        if path.exists() && path.is_dir() {
            println!("[Council Server] Found static dir at: {:?}", path);
            return Some(path);
        }
    }

    println!("[Council Server] Static dir not found, will use fallback handler");
    None
}

/// Default server port
pub const DEFAULT_PORT: u16 = 3456;

/// Start the council server
pub async fn start_server(port: u16) -> Result<(), String> {
    // Check if already running
    if is_server_running() {
        return Err("Server is already running".to_string());
    }

    // Initialize database
    persistence::init_db()?;

    // Create shutdown channel
    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    // Store shutdown sender
    {
        let mut tx_guard = SHUTDOWN_TX.lock().await;
        *tx_guard = Some(shutdown_tx);
    }

    // Create server state
    let state = Arc::new(CouncilServerState::new());

    // Store state globally
    {
        let mut state_guard = SERVER_STATE.write().await;
        *state_guard = Some(state.clone());
    }

    // Build CORS layer
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Check if we have a static directory for the React UI
    let static_dir = get_static_dir();

    // Build router with API routes
    let mut app = Router::new()
        // Health endpoint
        .route("/health", get(health_handler))
        // Main prompt endpoint
        .route("/prompt", post(prompt_handler))
        // Auth status
        .route("/auth-status", get(auth_status_handler))
        // Conversations (proxied to extension)
        .route("/conversations", get(list_conversations_handler))
        .route("/conversations/:id", get(get_conversation_handler))
        .route("/conversations/:id", delete(delete_conversation_handler))
        // Persisted requests
        .route("/requests", get(list_requests_handler))
        .route("/requests/:id", get(get_request_handler))
        .route("/requests/:id", delete(delete_request_handler))
        .route("/active-request", get(get_active_request_handler))
        // WebSocket endpoint
        .route("/ws", get(ws_handler));

    // Add index route or static file serving
    app = if static_dir.is_none() {
        app.route("/", get(index_handler))
    } else {
        app
    };

    // Apply state
    let app = app.with_state(state);

    // Add static file fallback if available
    let app: Router = if let Some(dir) = static_dir {
        let index_file = dir.join("index.html");
        let serve_dir = ServeDir::new(&dir).not_found_service(ServeFile::new(&index_file));
        app.fallback_service(serve_dir).layer(cors)
    } else {
        app.layer(cors)
    };

    // Bind to address
    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| format!("Failed to bind to {}: {}", addr, e))?;

    println!("[Council Server] Starting on http://{}", addr);
    set_server_running(true);

    // Run server with graceful shutdown
    let result = axum::serve(listener, app)
        .with_graceful_shutdown(async {
            shutdown_rx.await.ok();
            println!("[Council Server] Shutdown signal received");
        })
        .await;

    // Cleanup
    set_server_running(false);
    {
        let mut state_guard = SERVER_STATE.write().await;
        *state_guard = None;
    }
    println!("[Council Server] Stopped");

    result.map_err(|e| format!("Server error: {}", e))
}

/// Stop the council server
pub async fn stop_server() -> Result<(), String> {
    if !is_server_running() {
        return Ok(()); // Already stopped
    }

    // Take the shutdown sender
    let shutdown_tx = {
        let mut tx_guard = SHUTDOWN_TX.lock().await;
        tx_guard.take()
    };

    // Send shutdown signal
    if let Some(tx) = shutdown_tx {
        let _ = tx.send(());
    }

    Ok(())
}
