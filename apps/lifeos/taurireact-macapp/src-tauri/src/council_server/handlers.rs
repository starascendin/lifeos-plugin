//! HTTP route handlers for the Council Server.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{Html, IntoResponse, Response},
    Json,
};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::oneshot;
use uuid::Uuid;

use super::persistence;
use super::state::CouncilServerState;
use super::types::*;
use super::websocket::{send_council_request, send_proxy_request};

const DEFAULT_TIMEOUT_MS: u64 = 120_000; // 2 minutes
const MAX_TIMEOUT_MS: u64 = 300_000; // 5 minutes
const PROXY_TIMEOUT_MS: u64 = 10_000; // 10 seconds

// === Health & Index ===

/// GET / - Serve a simple status page
pub async fn index_handler(State(state): State<Arc<CouncilServerState>>) -> impl IntoResponse {
    let extension_connected = state.is_extension_connected().await;
    let uptime = state.uptime_ms();

    Html(format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <title>Council Server</title>
    <style>
        body {{ font-family: system-ui, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }}
        .status {{ padding: 10px; border-radius: 5px; margin: 10px 0; }}
        .connected {{ background: #d4edda; color: #155724; }}
        .disconnected {{ background: #f8d7da; color: #721c24; }}
        code {{ background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }}
    </style>
</head>
<body>
    <h1>Council Server (Rust)</h1>
    <div class="status {}">
        Extension: <strong>{}</strong>
    </div>
    <p>Uptime: {} seconds</p>
    <h2>API Endpoints</h2>
    <ul>
        <li><code>GET /health</code> - Health check</li>
        <li><code>POST /prompt</code> - Submit council query</li>
        <li><code>GET /auth-status</code> - Get LLM auth status</li>
        <li><code>GET /requests</code> - List recent requests</li>
        <li><code>GET /requests/:id</code> - Get request by ID</li>
        <li><code>DELETE /requests/:id</code> - Delete request</li>
        <li><code>GET /active-request</code> - Get current pending request</li>
        <li><code>GET /conversations</code> - List conversations (via extension)</li>
        <li><code>GET /conversations/:id</code> - Get conversation (via extension)</li>
        <li><code>DELETE /conversations/:id</code> - Delete conversation (via extension)</li>
        <li><code>WS /ws</code> - WebSocket for extension</li>
    </ul>
</body>
</html>"#,
        if extension_connected {
            "connected"
        } else {
            "disconnected"
        },
        if extension_connected {
            "Connected"
        } else {
            "Disconnected"
        },
        uptime / 1000
    ))
}

/// GET /health - Health check endpoint
pub async fn health_handler(State(state): State<Arc<CouncilServerState>>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        extension_connected: state.is_extension_connected().await,
        uptime: state.uptime_ms(),
    })
}

// === Council Prompt ===

/// POST /prompt - Main council query endpoint
pub async fn prompt_handler(
    State(state): State<Arc<CouncilServerState>>,
    Json(body): Json<PromptRequestBody>,
) -> Response {
    // Validate query
    let query = body.query.trim();
    if query.is_empty() {
        return error_response(
            StatusCode::BAD_REQUEST,
            "Query is required",
            ErrorCode::InvalidRequest,
            None,
        );
    }

    // Check extension connection
    if !state.is_extension_connected().await {
        return error_response(
            StatusCode::SERVICE_UNAVAILABLE,
            "Extension not connected",
            ErrorCode::NoExtension,
            None,
        );
    }

    let timeout = body
        .timeout
        .unwrap_or(DEFAULT_TIMEOUT_MS)
        .min(MAX_TIMEOUT_MS);
    let tier = body.tier.clone().unwrap_or_else(|| "normal".to_string());
    let request_id = Uuid::new_v4().to_string();

    // Save request to database
    match persistence::save_request(&request_id, query, &tier) {
        Ok(_) => println!("[Council Server] Saved request {} to database", request_id),
        Err(e) => eprintln!("[Council Server] Failed to save request: {}", e),
    }

    // Update status to processing
    if let Err(e) = persistence::update_request_processing(&request_id) {
        eprintln!("[Council Server] Failed to update request status: {}", e);
    }

    // Create oneshot channel for response
    let (tx, rx) = oneshot::channel();

    // Add to pending requests
    state.add_pending_request(request_id.clone(), tx).await;

    // Send to extension
    if let Err(e) = send_council_request(&state, &request_id, query, &tier).await {
        // Remove from pending and return error
        state.take_pending_request(&request_id).await;
        let _ = persistence::update_request_error(&request_id, &e);
        return error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            &e,
            ErrorCode::ServerError,
            Some(&request_id),
        );
    }

    // Wait for response with timeout
    let start = std::time::Instant::now();
    let result = tokio::time::timeout(Duration::from_millis(timeout), rx).await;

    match result {
        Ok(Ok(response)) => {
            let duration = start.elapsed().as_millis() as u64;

            // Update database with response
            let db_result = if response.success {
                persistence::update_request_completed(&request_id, &response)
            } else {
                let err_msg = response.error.as_deref().unwrap_or("Unknown error");
                persistence::update_request_error(&request_id, err_msg)
            };

            match db_result {
                Ok(_) => println!(
                    "[Council Server] Updated request {} in database (success={})",
                    request_id, response.success
                ),
                Err(e) => eprintln!(
                    "[Council Server] Failed to update request in database: {}",
                    e
                ),
            }

            // Cleanup old requests
            let _ = persistence::cleanup_old_requests(50);

            Json(PromptResponse {
                success: response.success,
                request_id: Some(request_id),
                stage1: response.stage1,
                stage2: response.stage2,
                stage3: response.stage3,
                metadata: response.metadata,
                error: response.error,
                error_code: if response.success {
                    None
                } else {
                    Some(ErrorCode::CouncilError.to_string())
                },
                duration: Some(duration),
            })
            .into_response()
        }
        Ok(Err(_)) => {
            // Channel closed (sender dropped)
            let _ = persistence::update_request_error(&request_id, "Request cancelled");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Request cancelled",
                ErrorCode::ServerError,
                Some(&request_id),
            )
        }
        Err(_) => {
            // Timeout
            state.take_pending_request(&request_id).await;
            let error_msg = format!("Request timed out after {}ms", timeout);
            let _ = persistence::update_request_error(&request_id, &error_msg);
            error_response(
                StatusCode::GATEWAY_TIMEOUT,
                &error_msg,
                ErrorCode::Timeout,
                Some(&request_id),
            )
        }
    }
}

// === Auth Status ===

/// GET /auth-status - Get LLM authentication status
pub async fn auth_status_handler(State(state): State<Arc<CouncilServerState>>) -> Response {
    if !state.is_extension_connected().await {
        return Json(AuthStatusResponse {
            success: false,
            status: Some(LLMAuthStatus {
                chatgpt: false,
                claude: false,
                gemini: false,
                timestamp: chrono::Utc::now().timestamp_millis(),
            }),
            extension_connected: false,
            error: Some("Extension not connected".to_string()),
        })
        .into_response();
    }

    let request_id = Uuid::new_v4().to_string();
    let (tx, rx) = oneshot::channel();

    state
        .add_pending_proxy_request(request_id.clone(), tx)
        .await;

    if let Err(e) = send_proxy_request(&state, "get_auth_status", &request_id, None).await {
        state.take_pending_proxy_request(&request_id).await;
        return Json(AuthStatusResponse {
            success: false,
            status: None,
            extension_connected: true,
            error: Some(e),
        })
        .into_response();
    }

    match tokio::time::timeout(Duration::from_millis(PROXY_TIMEOUT_MS), rx).await {
        Ok(Ok(payload)) => {
            let status: Option<LLMAuthStatus> = serde_json::from_value(payload).ok();
            Json(AuthStatusResponse {
                success: status.is_some(),
                status,
                extension_connected: true,
                error: None,
            })
            .into_response()
        }
        _ => {
            state.take_pending_proxy_request(&request_id).await;
            Json(AuthStatusResponse {
                success: false,
                status: None,
                extension_connected: true,
                error: Some("Timeout waiting for auth status".to_string()),
            })
            .into_response()
        }
    }
}

// === Conversations (Proxied to Extension) ===

/// GET /conversations - List conversations
pub async fn list_conversations_handler(State(state): State<Arc<CouncilServerState>>) -> Response {
    if !state.is_extension_connected().await {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({
                "error": "Extension not connected"
            })),
        )
            .into_response();
    }

    let request_id = Uuid::new_v4().to_string();
    let (tx, rx) = oneshot::channel();

    state
        .add_pending_proxy_request(request_id.clone(), tx)
        .await;

    if let Err(e) = send_proxy_request(&state, "get_history_list", &request_id, None).await {
        state.take_pending_proxy_request(&request_id).await;
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": e
            })),
        )
            .into_response();
    }

    match tokio::time::timeout(Duration::from_millis(PROXY_TIMEOUT_MS), rx).await {
        Ok(Ok(payload)) => Json(payload).into_response(),
        _ => {
            state.take_pending_proxy_request(&request_id).await;
            (
                StatusCode::GATEWAY_TIMEOUT,
                Json(serde_json::json!({
                    "error": "Timeout waiting for conversations"
                })),
            )
                .into_response()
        }
    }
}

/// GET /conversations/:id - Get single conversation
pub async fn get_conversation_handler(
    State(state): State<Arc<CouncilServerState>>,
    Path(id): Path<String>,
) -> Response {
    if !state.is_extension_connected().await {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({
                "error": "Extension not connected"
            })),
        )
            .into_response();
    }

    let request_id = Uuid::new_v4().to_string();
    let (tx, rx) = oneshot::channel();

    state
        .add_pending_proxy_request(request_id.clone(), tx)
        .await;

    let payload = serde_json::json!({ "id": id });
    if let Err(e) = send_proxy_request(&state, "get_conversation", &request_id, Some(payload)).await
    {
        state.take_pending_proxy_request(&request_id).await;
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": e
            })),
        )
            .into_response();
    }

    match tokio::time::timeout(Duration::from_millis(PROXY_TIMEOUT_MS), rx).await {
        Ok(Ok(payload)) => Json(payload).into_response(),
        _ => {
            state.take_pending_proxy_request(&request_id).await;
            (
                StatusCode::GATEWAY_TIMEOUT,
                Json(serde_json::json!({
                    "error": "Timeout waiting for conversation"
                })),
            )
                .into_response()
        }
    }
}

/// DELETE /conversations/:id - Delete conversation
pub async fn delete_conversation_handler(
    State(state): State<Arc<CouncilServerState>>,
    Path(id): Path<String>,
) -> Response {
    if !state.is_extension_connected().await {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({
                "error": "Extension not connected"
            })),
        )
            .into_response();
    }

    let request_id = Uuid::new_v4().to_string();
    let (tx, rx) = oneshot::channel();

    state
        .add_pending_proxy_request(request_id.clone(), tx)
        .await;

    let payload = serde_json::json!({ "id": id });
    if let Err(e) =
        send_proxy_request(&state, "delete_conversation", &request_id, Some(payload)).await
    {
        state.take_pending_proxy_request(&request_id).await;
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": e
            })),
        )
            .into_response();
    }

    match tokio::time::timeout(Duration::from_millis(PROXY_TIMEOUT_MS), rx).await {
        Ok(Ok(payload)) => Json(payload).into_response(),
        _ => {
            state.take_pending_proxy_request(&request_id).await;
            (
                StatusCode::GATEWAY_TIMEOUT,
                Json(serde_json::json!({
                    "error": "Timeout waiting for delete result"
                })),
            )
                .into_response()
        }
    }
}

// === Persisted Requests ===

/// GET /requests - List recent requests
pub async fn list_requests_handler() -> Response {
    match persistence::get_recent_requests(50) {
        Ok(requests) => Json(requests).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": e
            })),
        )
            .into_response(),
    }
}

/// GET /requests/:id - Get single request
pub async fn get_request_handler(Path(id): Path<String>) -> Response {
    match persistence::get_request(&id) {
        Ok(Some(request)) => Json(request).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "error": "Request not found"
            })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": e
            })),
        )
            .into_response(),
    }
}

/// DELETE /requests/:id - Delete request
pub async fn delete_request_handler(Path(id): Path<String>) -> Response {
    match persistence::delete_request(&id) {
        Ok(true) => Json(serde_json::json!({ "success": true })).into_response(),
        Ok(false) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "error": "Request not found"
            })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": e
            })),
        )
            .into_response(),
    }
}

/// GET /active-request - Get current pending/processing request
pub async fn get_active_request_handler() -> Response {
    match persistence::get_active_request() {
        Ok(Some(request)) => Json(request).into_response(),
        Ok(None) => Json(serde_json::Value::Null).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": e
            })),
        )
            .into_response(),
    }
}

// === Helpers ===

fn error_response(
    status: StatusCode,
    message: &str,
    code: ErrorCode,
    request_id: Option<&str>,
) -> Response {
    (
        status,
        Json(PromptResponse {
            success: false,
            request_id: request_id.map(|s| s.to_string()),
            stage1: None,
            stage2: None,
            stage3: None,
            metadata: None,
            error: Some(message.to_string()),
            error_code: Some(code.to_string()),
            duration: None,
        }),
    )
        .into_response()
}
