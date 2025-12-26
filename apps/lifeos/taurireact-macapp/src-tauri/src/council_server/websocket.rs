//! WebSocket handling for Chrome extension connection.

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::mpsc;

use super::state::{CouncilServerState, ExtensionConnection};
use super::types::{CouncilResponse, WSMessage};

/// WebSocket upgrade handler
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<CouncilServerState>>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_extension_socket(socket, state))
}

/// Handle the extension WebSocket connection
async fn handle_extension_socket(socket: WebSocket, state: Arc<CouncilServerState>) {
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    // Store the connection
    state
        .set_extension(ExtensionConnection { tx: tx.clone() })
        .await;
    println!("[Council Server] Extension connected");

    // Spawn task to forward messages from channel to WebSocket
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Receive and handle messages from extension
    while let Some(result) = receiver.next().await {
        match result {
            Ok(Message::Text(text)) => {
                handle_ws_message(&state, &text).await;
            }
            Ok(Message::Ping(data)) => {
                // Respond to ping with pong
                let _ = tx.send(Message::Pong(data));
            }
            Ok(Message::Close(_)) => {
                println!("[Council Server] Extension sent close frame");
                break;
            }
            Err(e) => {
                eprintln!("[Council Server] WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }

    // Cleanup on disconnect
    state.clear_extension().await;
    state.reject_all_pending("Extension disconnected").await;
    send_task.abort();
    println!("[Council Server] Extension disconnected");
}

/// Handle incoming WebSocket message
async fn handle_ws_message(state: &Arc<CouncilServerState>, text: &str) {
    let msg: Result<WSMessage, _> = serde_json::from_str(text);

    match msg {
        Ok(ws_msg) => {
            match ws_msg.msg_type.as_str() {
                "extension_ready" => {
                    println!("[Council Server] Extension ready");
                }
                "ping" => {
                    let _ = state.send_to_extension(r#"{"type":"pong"}"#).await;
                }
                "pong" => {
                    // Heartbeat response, ignore
                }
                "council_response" => {
                    handle_council_response(state, ws_msg).await;
                }
                "council_progress" => {
                    // Log progress updates
                    if let Some(payload) = &ws_msg.payload {
                        println!("[Council Server] Progress: {:?}", payload);
                    }
                }
                // Proxy responses
                "auth_status" | "history_list" | "conversation_data" | "delete_result" => {
                    handle_proxy_response(state, ws_msg).await;
                }
                _ => {
                    println!("[Council Server] Unknown message type: {}", ws_msg.msg_type);
                }
            }
        }
        Err(e) => {
            eprintln!("[Council Server] Failed to parse WebSocket message: {}", e);
        }
    }
}

/// Handle council response from extension
async fn handle_council_response(state: &Arc<CouncilServerState>, ws_msg: WSMessage) {
    // The requestId is inside the payload, not at the top level
    let payload = match ws_msg.payload {
        Some(p) => p,
        None => {
            eprintln!("[Council Server] Council response missing payload");
            return;
        }
    };

    // Extract requestId from payload
    let request_id = match payload.get("requestId").and_then(|v| v.as_str()) {
        Some(id) => id.to_string(),
        None => {
            eprintln!("[Council Server] Council response payload missing requestId");
            return;
        }
    };

    // Parse the full response
    let response: CouncilResponse = match serde_json::from_value(payload) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[Council Server] Failed to parse council response: {}", e);
            CouncilResponse {
                request_id: request_id.clone(),
                success: false,
                stage1: None,
                stage2: None,
                stage3: None,
                metadata: None,
                error: Some(format!("Failed to parse response: {}", e)),
                duration: None,
            }
        }
    };

    // Find and resolve the pending request
    if let Some(pending) = state.take_pending_request(&request_id).await {
        let _ = pending.response_tx.send(response);
    } else {
        println!(
            "[Council Server] No pending request found for ID: {}",
            request_id
        );
    }
}

/// Handle proxy response (auth-status, history, etc.)
async fn handle_proxy_response(state: &Arc<CouncilServerState>, ws_msg: WSMessage) {
    let request_id = match ws_msg.request_id {
        Some(id) => id,
        None => {
            eprintln!("[Council Server] Proxy response missing requestId");
            return;
        }
    };

    let payload = ws_msg.payload.unwrap_or(serde_json::json!({}));

    // Find and resolve the pending proxy request
    if let Some(pending) = state.take_pending_proxy_request(&request_id).await {
        let _ = pending.response_tx.send(payload);
    } else {
        println!(
            "[Council Server] No pending proxy request found for ID: {}",
            request_id
        );
    }
}

/// Send a council request to the extension
pub async fn send_council_request(
    state: &Arc<CouncilServerState>,
    request_id: &str,
    query: &str,
    tier: &str,
) -> Result<(), String> {
    let timestamp = chrono::Utc::now().timestamp_millis();

    let msg = serde_json::json!({
        "type": "council_request",
        "payload": {
            "requestId": request_id,
            "query": query,
            "tier": tier,
            "timestamp": timestamp
        }
    });

    let msg_str =
        serde_json::to_string(&msg).map_err(|e| format!("Failed to serialize request: {}", e))?;

    state.send_to_extension(&msg_str).await
}

/// Send a proxy request to the extension (auth-status, history, etc.)
pub async fn send_proxy_request(
    state: &Arc<CouncilServerState>,
    msg_type: &str,
    request_id: &str,
    payload: Option<serde_json::Value>,
) -> Result<(), String> {
    let mut msg = serde_json::json!({
        "type": msg_type,
        "requestId": request_id
    });

    if let Some(p) = payload {
        msg["payload"] = p;
    }

    let msg_str = serde_json::to_string(&msg)
        .map_err(|e| format!("Failed to serialize proxy request: {}", e))?;

    state.send_to_extension(&msg_str).await
}
