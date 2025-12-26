//! Type definitions for the Council Server.
//! These mirror the TypeScript types in the Node.js server.

use serde::{Deserialize, Serialize};

// === WebSocket Message Types ===

/// WebSocket message structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WSMessage {
    #[serde(rename = "type")]
    pub msg_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload: Option<serde_json::Value>,
    #[serde(rename = "requestId", skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
}

/// Stage 1 result from LLM
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stage1Result {
    pub model: String,
    #[serde(rename = "llmType")]
    pub llm_type: String,
    pub response: String,
}

/// Stage 2 ranking result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stage2Result {
    pub model: String,
    #[serde(rename = "llmType")]
    pub llm_type: String,
    pub ranking: String,
    #[serde(rename = "parsedRanking")]
    pub parsed_ranking: Vec<String>,
    pub evaluations: Vec<serde_json::Value>,
}

/// Stage 3 synthesis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stage3Result {
    pub model: String,
    #[serde(rename = "llmType")]
    pub llm_type: String,
    pub response: String,
}

/// Aggregate ranking for a model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AggregateRanking {
    pub model: String,
    #[serde(rename = "llmType")]
    pub llm_type: String,
    #[serde(rename = "averageRank")]
    pub average_rank: f64,
    #[serde(rename = "rankingsCount")]
    pub rankings_count: i32,
}

/// Council metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CouncilMetadata {
    #[serde(rename = "labelToModel")]
    pub label_to_model: serde_json::Value,
    #[serde(rename = "aggregateRankings")]
    pub aggregate_rankings: Vec<AggregateRanking>,
}

/// Full council response from extension
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CouncilResponse {
    #[serde(rename = "requestId")]
    pub request_id: String,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stage1: Option<Vec<Stage1Result>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stage2: Option<Vec<Stage2Result>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stage3: Option<Vec<Stage3Result>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<CouncilMetadata>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<u64>,
}

// === HTTP Request/Response Types ===

/// POST /prompt request body
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptRequestBody {
    pub query: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout: Option<u64>,
}

/// Response for /prompt endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptResponse {
    pub success: bool,
    #[serde(rename = "requestId", skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stage1: Option<Vec<Stage1Result>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stage2: Option<Vec<Stage2Result>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stage3: Option<Vec<Stage3Result>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<CouncilMetadata>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(rename = "errorCode", skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<u64>,
}

/// Health check response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    #[serde(rename = "extensionConnected")]
    pub extension_connected: bool,
    pub uptime: u64,
}

/// LLM authentication status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMAuthStatus {
    pub chatgpt: bool,
    pub claude: bool,
    pub gemini: bool,
    pub timestamp: i64,
}

/// Auth status response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthStatusResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<LLMAuthStatus>,
    #[serde(rename = "extensionConnected")]
    pub extension_connected: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// === Persistence Types ===

/// Persisted council request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedRequest {
    pub id: String,
    pub query: String,
    pub tier: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stage1: Option<Vec<Stage1Result>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stage2: Option<Vec<Stage2Result>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stage3: Option<Vec<Stage3Result>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<CouncilMetadata>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<u64>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

/// Conversation summary (for list endpoint)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationSummary {
    pub id: String,
    pub query: String,
    pub tier: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<u64>,
}

// === Server Status Types ===

/// Council server status for Tauri command
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CouncilServerStatus {
    pub running: bool,
    pub port: u16,
    #[serde(rename = "extensionConnected")]
    pub extension_connected: bool,
    #[serde(rename = "uptimeMs", skip_serializing_if = "Option::is_none")]
    pub uptime_ms: Option<u64>,
}

// === Error Types ===

/// Error codes matching Node.js server
#[derive(Debug, Clone, Copy)]
pub enum ErrorCode {
    InvalidRequest,
    NoExtension,
    Timeout,
    CouncilError,
    ServerError,
}

impl std::fmt::Display for ErrorCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ErrorCode::InvalidRequest => write!(f, "INVALID_REQUEST"),
            ErrorCode::NoExtension => write!(f, "NO_EXTENSION"),
            ErrorCode::Timeout => write!(f, "TIMEOUT"),
            ErrorCode::CouncilError => write!(f, "COUNCIL_ERROR"),
            ErrorCode::ServerError => write!(f, "SERVER_ERROR"),
        }
    }
}
