// Granola Integration
// Syncs meeting notes from the Granola app using the Granola CLI

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;

// Paths for Granola CLI and data
const GRANOLA_CLI_PATH: &str =
    "/Users/bryanliu/Sync/99.repolibs/GRANOLA/reverse-engineering-granola-api/cli/granola";
const GRANOLA_CONFIG_PATH: &str =
    "/Users/bryanliu/Sync/99.repolibs/GRANOLA/reverse-engineering-granola-api/cli/config.json";
const GRANOLA_OUTPUT_DIR: &str =
    "/Users/bryanliu/Sync/99.repolibs/GRANOLA/reverse-engineering-granola-api/cli/output";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GranolaUtterance {
    pub source: String,
    pub text: String,
    #[serde(default)]
    pub start_timestamp: Option<String>,
    #[serde(default)]
    pub end_timestamp: Option<String>,
    #[serde(default)]
    pub confidence: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GranolaFolder {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GranolaMetadata {
    pub document_id: String,
    pub title: String,
    pub created_at: String,
    #[serde(default)]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub workspace_id: Option<String>,
    #[serde(default)]
    pub workspace_name: Option<String>,
    #[serde(default)]
    pub folders: Option<Vec<GranolaFolder>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GranolaMeeting {
    pub id: String,
    pub title: String,
    pub created_at: String,
    #[serde(default)]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub workspace_id: Option<String>,
    #[serde(default)]
    pub workspace_name: Option<String>,
    #[serde(default)]
    pub folders: Option<Vec<GranolaFolder>>,
    #[serde(default)]
    pub resume_markdown: Option<String>,
    #[serde(default)]
    pub transcript: Option<Vec<GranolaUtterance>>,
    #[serde(default)]
    pub transcript_markdown: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GranolaSyncResult {
    pub success: bool,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub meetings_count: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GranolaWorkspace {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub created_at: Option<String>,
}

/// Check if Granola CLI is available and configured
#[tauri::command]
pub fn check_granola_available() -> bool {
    let cli_exists = PathBuf::from(GRANOLA_CLI_PATH).exists();
    let config_exists = PathBuf::from(GRANOLA_CONFIG_PATH).exists();
    cli_exists && config_exists
}

/// Run the Granola CLI sync command
#[tauri::command]
pub async fn sync_granola() -> GranolaSyncResult {
    // Check availability first
    if !check_granola_available() {
        return GranolaSyncResult {
            success: false,
            error: Some("Granola CLI not found or config.json missing".to_string()),
            message: None,
            meetings_count: None,
        };
    }

    // Run the sync command
    let output = Command::new(GRANOLA_CLI_PATH)
        .args(["sync", "-o", GRANOLA_OUTPUT_DIR])
        .current_dir(
            PathBuf::from(GRANOLA_CLI_PATH)
                .parent()
                .unwrap_or(&PathBuf::from(".")),
        )
        .output();

    match output {
        Ok(result) => {
            if result.status.success() {
                // Count meetings in output directory
                let meetings = read_synced_meetings_internal().unwrap_or_default();
                let count = meetings.len();

                GranolaSyncResult {
                    success: true,
                    error: None,
                    message: Some(format!("Synced {} meetings", count)),
                    meetings_count: Some(count),
                }
            } else {
                let stderr = String::from_utf8_lossy(&result.stderr);
                GranolaSyncResult {
                    success: false,
                    error: Some(format!("Sync failed: {}", stderr)),
                    message: None,
                    meetings_count: None,
                }
            }
        }
        Err(e) => GranolaSyncResult {
            success: false,
            error: Some(format!("Failed to run Granola CLI: {}", e)),
            message: None,
            meetings_count: None,
        },
    }
}

/// Read synced meetings from the output directory
fn read_synced_meetings_internal() -> Result<Vec<GranolaMeeting>, String> {
    let output_dir = PathBuf::from(GRANOLA_OUTPUT_DIR);

    if !output_dir.exists() {
        return Ok(vec![]);
    }

    // Read workspaces.json for workspace name mapping
    let workspaces_path = output_dir.join("workspaces.json");
    let workspace_map: std::collections::HashMap<String, String> =
        if let Ok(content) = fs::read_to_string(&workspaces_path) {
            if let Ok(workspaces) = serde_json::from_str::<Vec<GranolaWorkspace>>(&content) {
                workspaces
                    .into_iter()
                    .map(|ws| (ws.id, ws.name))
                    .collect()
            } else {
                std::collections::HashMap::new()
            }
        } else {
            std::collections::HashMap::new()
        };

    let mut meetings = Vec::new();

    // Iterate through directories in output
    let entries = fs::read_dir(&output_dir).map_err(|e| format!("Failed to read output dir: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();

        // Skip non-directories and special files
        if !path.is_dir() {
            continue;
        }

        let dir_name = match path.file_name() {
            Some(name) => name.to_string_lossy().to_string(),
            None => continue,
        };

        // Skip hidden directories
        if dir_name.starts_with('.') {
            continue;
        }

        // Read metadata.json
        let metadata_path = path.join("metadata.json");
        if !metadata_path.exists() {
            continue;
        }

        let metadata_content = match fs::read_to_string(&metadata_path) {
            Ok(content) => content,
            Err(_) => continue,
        };

        let metadata: GranolaMetadata = match serde_json::from_str(&metadata_content) {
            Ok(m) => m,
            Err(_) => continue,
        };

        // Build the meeting struct
        let mut meeting = GranolaMeeting {
            id: metadata.document_id,
            title: metadata.title,
            created_at: metadata.created_at,
            updated_at: metadata.updated_at,
            workspace_id: metadata.workspace_id.clone(),
            workspace_name: metadata
                .workspace_name
                .or_else(|| metadata.workspace_id.as_ref().and_then(|id| workspace_map.get(id).cloned())),
            folders: metadata.folders,
            resume_markdown: None,
            transcript: None,
            transcript_markdown: None,
        };

        // Read resume.md if exists
        let resume_path = path.join("resume.md");
        if resume_path.exists() {
            if let Ok(content) = fs::read_to_string(&resume_path) {
                meeting.resume_markdown = Some(content);
            }
        }

        // Read transcript.json if exists
        let transcript_path = path.join("transcript.json");
        if transcript_path.exists() {
            if let Ok(content) = fs::read_to_string(&transcript_path) {
                if let Ok(utterances) = serde_json::from_str::<Vec<GranolaUtterance>>(&content) {
                    meeting.transcript = Some(utterances);
                }
            }
        }

        // Read transcript.md if exists
        let transcript_md_path = path.join("transcript.md");
        if transcript_md_path.exists() {
            if let Ok(content) = fs::read_to_string(&transcript_md_path) {
                meeting.transcript_markdown = Some(content);
            }
        }

        meetings.push(meeting);
    }

    // Sort by created_at descending
    meetings.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(meetings)
}

/// Get all synced meetings
#[tauri::command]
pub fn get_granola_meetings() -> Result<Vec<GranolaMeeting>, String> {
    read_synced_meetings_internal()
}

/// Get sync settings (stored in localStorage on frontend, but we provide defaults)
#[tauri::command]
pub fn get_granola_sync_settings() -> serde_json::Value {
    serde_json::json!({
        "autoSyncEnabled": true,
        "syncIntervalMinutes": 10
    })
}

/// Run Granola auth command to re-authenticate
#[tauri::command]
pub async fn run_granola_auth() -> GranolaSyncResult {
    // Check CLI exists
    if !PathBuf::from(GRANOLA_CLI_PATH).exists() {
        return GranolaSyncResult {
            success: false,
            error: Some("Granola CLI not found".to_string()),
            message: None,
            meetings_count: None,
        };
    }

    // Run the auth command - this will open browser for OAuth
    let output = Command::new(GRANOLA_CLI_PATH)
        .args(["auth"])
        .current_dir(
            PathBuf::from(GRANOLA_CLI_PATH)
                .parent()
                .unwrap_or(&PathBuf::from(".")),
        )
        .output();

    match output {
        Ok(result) => {
            if result.status.success() {
                GranolaSyncResult {
                    success: true,
                    error: None,
                    message: Some("Authentication successful".to_string()),
                    meetings_count: None,
                }
            } else {
                let stderr = String::from_utf8_lossy(&result.stderr);
                GranolaSyncResult {
                    success: false,
                    error: Some(format!("Auth failed: {}", stderr)),
                    message: None,
                    meetings_count: None,
                }
            }
        }
        Err(e) => GranolaSyncResult {
            success: false,
            error: Some(format!("Failed to run auth: {}", e)),
            message: None,
            meetings_count: None,
        },
    }
}
