//! Shared state for the Council Server.

use axum::extract::ws::Message as WsMessage;
use chrono::{DateTime, Utc};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::{mpsc, oneshot, Mutex, RwLock};

use super::types::CouncilResponse;

/// Global server state (stores Arc for sharing with handlers)
pub static SERVER_STATE: Lazy<RwLock<Option<Arc<CouncilServerState>>>> =
    Lazy::new(|| RwLock::new(None));

/// Atomic flag for server running status
pub static SERVER_RUNNING: AtomicBool = AtomicBool::new(false);

/// Shutdown signal sender (stored separately for taking)
pub static SHUTDOWN_TX: Lazy<Mutex<Option<oneshot::Sender<()>>>> = Lazy::new(|| Mutex::new(None));

/// Main server state structure
pub struct CouncilServerState {
    /// Server start time
    pub start_time: DateTime<Utc>,

    /// Extension WebSocket connection
    pub extension_ws: RwLock<Option<ExtensionConnection>>,

    /// Pending council requests (waiting for extension response)
    pub pending_requests: RwLock<HashMap<String, PendingRequest>>,

    /// Pending proxy requests (auth-status, history, etc.)
    pub pending_proxy_requests: RwLock<HashMap<String, PendingProxyRequest>>,
}

impl CouncilServerState {
    pub fn new() -> Self {
        Self {
            start_time: Utc::now(),
            extension_ws: RwLock::new(None),
            pending_requests: RwLock::new(HashMap::new()),
            pending_proxy_requests: RwLock::new(HashMap::new()),
        }
    }

    /// Get uptime in milliseconds
    pub fn uptime_ms(&self) -> u64 {
        let now = Utc::now();
        let duration = now.signed_duration_since(self.start_time);
        duration.num_milliseconds().max(0) as u64
    }

    /// Check if extension is connected
    pub async fn is_extension_connected(&self) -> bool {
        self.extension_ws.read().await.is_some()
    }

    /// Send message to extension
    pub async fn send_to_extension(&self, message: &str) -> Result<(), String> {
        let guard = self.extension_ws.read().await;
        if let Some(conn) = guard.as_ref() {
            conn.tx
                .send(WsMessage::Text(message.to_string()))
                .map_err(|e| format!("Failed to send to extension: {}", e))
        } else {
            Err("Extension not connected".to_string())
        }
    }

    /// Set extension connection
    pub async fn set_extension(&self, conn: ExtensionConnection) {
        let mut guard = self.extension_ws.write().await;
        *guard = Some(conn);
    }

    /// Clear extension connection
    pub async fn clear_extension(&self) {
        let mut guard = self.extension_ws.write().await;
        *guard = None;
    }

    /// Add a pending request
    pub async fn add_pending_request(
        &self,
        request_id: String,
        tx: oneshot::Sender<CouncilResponse>,
    ) {
        let mut guard = self.pending_requests.write().await;
        guard.insert(
            request_id.clone(),
            PendingRequest {
                request_id,
                response_tx: tx,
            },
        );
    }

    /// Remove and return a pending request
    pub async fn take_pending_request(&self, request_id: &str) -> Option<PendingRequest> {
        let mut guard = self.pending_requests.write().await;
        guard.remove(request_id)
    }

    /// Add a pending proxy request
    pub async fn add_pending_proxy_request(
        &self,
        request_id: String,
        tx: oneshot::Sender<serde_json::Value>,
    ) {
        let mut guard = self.pending_proxy_requests.write().await;
        guard.insert(request_id, PendingProxyRequest { response_tx: tx });
    }

    /// Remove and return a pending proxy request
    pub async fn take_pending_proxy_request(
        &self,
        request_id: &str,
    ) -> Option<PendingProxyRequest> {
        let mut guard = self.pending_proxy_requests.write().await;
        guard.remove(request_id)
    }

    /// Reject all pending requests (called on extension disconnect)
    pub async fn reject_all_pending(&self, reason: &str) {
        // Reject council requests
        let mut pending = self.pending_requests.write().await;
        for (_, req) in pending.drain() {
            let _ = req.response_tx.send(CouncilResponse {
                request_id: req.request_id,
                success: false,
                stage1: None,
                stage2: None,
                stage3: None,
                metadata: None,
                error: Some(reason.to_string()),
                duration: None,
            });
        }

        // Reject proxy requests
        let mut proxy_pending = self.pending_proxy_requests.write().await;
        for (_, req) in proxy_pending.drain() {
            let _ = req.response_tx.send(serde_json::json!({
                "error": reason
            }));
        }
    }
}

/// Extension WebSocket connection
pub struct ExtensionConnection {
    /// Channel to send messages to the extension
    pub tx: mpsc::UnboundedSender<WsMessage>,
}

/// Pending council request
pub struct PendingRequest {
    pub request_id: String,
    pub response_tx: oneshot::Sender<CouncilResponse>,
}

/// Pending proxy request (auth-status, history, etc.)
pub struct PendingProxyRequest {
    pub response_tx: oneshot::Sender<serde_json::Value>,
}

/// Check if server is running
pub fn is_server_running() -> bool {
    SERVER_RUNNING.load(Ordering::SeqCst)
}

/// Set server running status
pub fn set_server_running(running: bool) {
    SERVER_RUNNING.store(running, Ordering::SeqCst);
}
