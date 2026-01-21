use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use tauri::command;

/// Represents a Beeper thread/conversation
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BeeperThread {
    pub name: String,
    #[serde(rename = "type")]
    pub thread_type: String,
    pub participant_count: i64,
    pub message_count: i64,
    pub last_message_at: String,
}

/// Represents a Beeper message
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BeeperMessage {
    #[serde(default)]
    pub thread_name: Option<String>,
    pub sender: String,
    pub text: String,
    pub timestamp_readable: String,
}

/// Result of syncing the Beeper database
#[derive(Debug, Serialize, Deserialize)]
pub struct BeeperSyncResult {
    pub success: bool,
    pub error: Option<String>,
    pub message: Option<String>,
}

/// Get the path to the beeperdb package
fn get_beeperdb_path() -> PathBuf {
    // Navigate from src-tauri to the monorepo root, then to packages/beeperdb
    let current_dir = std::env::current_dir().unwrap_or_default();

    // If we're in src-tauri during development
    if current_dir.ends_with("src-tauri") {
        return current_dir
            .parent() // taurireact-macapp
            .and_then(|p| p.parent()) // lifeos
            .and_then(|p| p.parent()) // apps
            .and_then(|p| p.parent()) // monorepo root
            .map(|p| p.join("packages").join("beeperdb"))
            .unwrap_or_else(|| PathBuf::from("packages/beeperdb"));
    }

    // If we're in the app directory during development
    if current_dir.ends_with("taurireact-macapp") {
        return current_dir
            .parent() // lifeos
            .and_then(|p| p.parent()) // apps
            .and_then(|p| p.parent()) // monorepo root
            .map(|p| p.join("packages").join("beeperdb"))
            .unwrap_or_else(|| PathBuf::from("packages/beeperdb"));
    }

    // Try to find monorepo root by looking for package.json with "hola" workspace
    let mut search_dir = current_dir.clone();
    for _ in 0..10 {
        let packages_dir = search_dir.join("packages").join("beeperdb");
        if packages_dir.exists() {
            return packages_dir;
        }
        if let Some(parent) = search_dir.parent() {
            search_dir = parent.to_path_buf();
        } else {
            break;
        }
    }

    // Fallback: assume relative to home directory
    dirs::home_dir()
        .map(|h| {
            h.join("Sync")
                .join("00.Projects")
                .join("holaai-convexo-monorepo")
                .join("packages")
                .join("beeperdb")
        })
        .unwrap_or_else(|| PathBuf::from("packages/beeperdb"))
}

/// Check if BeeperTexts folder exists (Beeper is available)
#[command]
pub async fn check_beeper_available() -> Result<bool, String> {
    let beeper_path = dirs::home_dir()
        .map(|h| {
            h.join("Library")
                .join("Application Support")
                .join("BeeperTexts")
        })
        .unwrap_or_default();

    Ok(beeper_path.exists())
}

/// Check if clean.duckdb exists (data has been synced)
#[command]
pub async fn check_beeper_database_exists() -> Result<bool, String> {
    let beeperdb_path = get_beeperdb_path();
    let db_path = beeperdb_path.join("data").join("clean.duckdb");
    Ok(db_path.exists())
}

/// Sync the Beeper database by running pnpm sync && pnpm clean
#[command]
pub async fn sync_beeper_database() -> Result<BeeperSyncResult, String> {
    let beeperdb_path = get_beeperdb_path();

    if !beeperdb_path.exists() {
        return Ok(BeeperSyncResult {
            success: false,
            error: Some(format!(
                "beeperdb package not found at: {}",
                beeperdb_path.display()
            )),
            message: None,
        });
    }

    // Run pnpm sync (clone DBs + build export.sqlite)
    let sync_output = Command::new("pnpm")
        .args(["sync"])
        .current_dir(&beeperdb_path)
        .output()
        .map_err(|e| format!("Failed to run pnpm sync: {}", e))?;

    if !sync_output.status.success() {
        let stderr = String::from_utf8_lossy(&sync_output.stderr);
        return Ok(BeeperSyncResult {
            success: false,
            error: Some(format!("pnpm sync failed: {}", stderr)),
            message: None,
        });
    }

    // Run pnpm clean (build clean.duckdb)
    let clean_output = Command::new("pnpm")
        .args(["clean"])
        .current_dir(&beeperdb_path)
        .output()
        .map_err(|e| format!("Failed to run pnpm clean: {}", e))?;

    if !clean_output.status.success() {
        let stderr = String::from_utf8_lossy(&clean_output.stderr);
        return Ok(BeeperSyncResult {
            success: false,
            error: Some(format!("pnpm clean failed: {}", stderr)),
            message: None,
        });
    }

    Ok(BeeperSyncResult {
        success: true,
        error: None,
        message: Some("Beeper database synced successfully".to_string()),
    })
}

/// Get list of threads/conversations
#[command]
pub async fn get_beeper_threads(search: Option<String>) -> Result<Vec<BeeperThread>, String> {
    let beeperdb_path = get_beeperdb_path();

    // Build the command: bun query.ts threads [search]
    let mut cmd = Command::new("bun");
    cmd.arg("query.ts").arg("threads");

    if let Some(ref s) = search {
        cmd.arg(s);
    }

    let output = cmd
        .current_dir(&beeperdb_path)
        .output()
        .map_err(|e| format!("Failed to run bun query.ts threads: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("bun query.ts threads failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse JSON output
    let threads: Vec<BeeperThread> =
        serde_json::from_str(&stdout).map_err(|e| format!("Failed to parse threads JSON: {}", e))?;

    Ok(threads)
}

/// Get conversation/messages for a specific thread by exact name
#[command]
pub async fn get_beeper_conversation(
    thread_name: String,
    limit: Option<i32>,
) -> Result<Vec<BeeperMessage>, String> {
    let beeperdb_path = get_beeperdb_path();

    // Build the command: bun query.ts convo "<thread_name>"
    let mut cmd = Command::new("bun");
    cmd.arg("query.ts").arg("convo").arg(&thread_name);

    if let Some(l) = limit {
        cmd.arg(l.to_string());
    }

    let output = cmd
        .current_dir(&beeperdb_path)
        .output()
        .map_err(|e| format!("Failed to run bun query.ts convo: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("bun query.ts convo failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse JSON output
    let messages: Vec<BeeperMessage> = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse conversation JSON: {}", e))?;

    Ok(messages)
}

/// Search messages by text content
#[command]
pub async fn search_beeper_messages(query: String) -> Result<Vec<BeeperMessage>, String> {
    let beeperdb_path = get_beeperdb_path();

    // Build the command: bun query.ts search "<query>"
    let output = Command::new("bun")
        .arg("query.ts")
        .arg("search")
        .arg(&query)
        .current_dir(&beeperdb_path)
        .output()
        .map_err(|e| format!("Failed to run bun query.ts search: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("bun query.ts search failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse JSON output
    let messages: Vec<BeeperMessage> = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse search results JSON: {}", e))?;

    Ok(messages)
}

/// Get messages by contact/thread name (fuzzy search)
#[command]
pub async fn get_beeper_messages(
    name: String,
    limit: Option<i32>,
) -> Result<Vec<BeeperMessage>, String> {
    let beeperdb_path = get_beeperdb_path();

    // Build the command: bun query.ts messages "<name>" [limit]
    let mut cmd = Command::new("bun");
    cmd.arg("query.ts").arg("messages").arg(&name);

    if let Some(l) = limit {
        cmd.arg(l.to_string());
    }

    let output = cmd
        .current_dir(&beeperdb_path)
        .output()
        .map_err(|e| format!("Failed to run bun query.ts messages: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("bun query.ts messages failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse JSON output
    let messages: Vec<BeeperMessage> = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse messages JSON: {}", e))?;

    Ok(messages)
}
