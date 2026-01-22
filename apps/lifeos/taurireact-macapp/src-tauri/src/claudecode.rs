use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::command;
use uuid::Uuid;

/// Container status information
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContainerStatus {
    pub exists: bool,
    pub running: bool,
    pub name: String,
}

/// Conversation thread information
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConversationThread {
    pub id: String,
    pub environment: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Result from executing a Claude prompt
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClaudeCodeResult {
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
    pub json_output: Option<String>,
}

/// Check if Docker is available on the system
#[command]
pub async fn check_docker_available() -> Result<bool, String> {
    let output = Command::new("docker")
        .arg("info")
        .output()
        .map_err(|e| format!("Failed to run docker info: {}", e))?;

    Ok(output.status.success())
}

/// Get the status of a Claude agent container for a specific environment
#[command]
pub async fn get_container_status(env: String) -> Result<ContainerStatus, String> {
    let container_name = format!("claude-agent-{}", env);

    // Check if container exists and get its status
    let output = Command::new("docker")
        .args(["ps", "-a", "--filter", &format!("name={}", container_name), "--format", "{{.Status}}"])
        .output()
        .map_err(|e| format!("Failed to check container status: {}", e))?;

    let status_output = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if status_output.is_empty() {
        return Ok(ContainerStatus {
            exists: false,
            running: false,
            name: container_name,
        });
    }

    // Check if the container is running (status starts with "Up")
    let running = status_output.starts_with("Up");

    Ok(ContainerStatus {
        exists: true,
        running,
        name: container_name,
    })
}

/// Start a Claude agent container
#[command]
pub async fn start_container(env: String) -> Result<(), String> {
    let container_name = format!("claude-agent-{}", env);

    let output = Command::new("docker")
        .args(["start", &container_name])
        .output()
        .map_err(|e| format!("Failed to start container: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to start container: {}", stderr));
    }

    Ok(())
}

/// Stop a Claude agent container
#[command]
pub async fn stop_container(env: String) -> Result<(), String> {
    let container_name = format!("claude-agent-{}", env);

    let output = Command::new("docker")
        .args(["stop", &container_name])
        .output()
        .map_err(|e| format!("Failed to stop container: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to stop container: {}", stderr));
    }

    Ok(())
}

/// Create a new Claude agent container
#[command]
pub async fn create_container(env: String, mcp_config_path: String) -> Result<(), String> {
    let container_name = format!("claude-agent-{}", env);
    let sessions_volume = format!("claude-sessions-{}", env);

    // Check if container already exists
    let check = Command::new("docker")
        .args([
            "ps",
            "-a",
            "--filter",
            &format!("name={}", container_name),
            "--format",
            "{{.Names}}",
        ])
        .output()
        .map_err(|e| format!("Failed to check container: {}", e))?;

    let existing = String::from_utf8_lossy(&check.stdout).trim().to_string();
    if !existing.is_empty() {
        return Err(format!(
            "Container {} already exists. Remove it first or start it.",
            container_name
        ));
    }

    // Verify MCP config file exists
    if !std::path::Path::new(&mcp_config_path).exists() {
        return Err(format!("MCP config file not found: {}", mcp_config_path));
    }

    // Create the container with all necessary volume mounts
    let output = Command::new("docker")
        .args([
            "run",
            "-d",
            "--name",
            &container_name,
            "-v",
            "claude-credentials:/home/node/.claude",
            "-v",
            "claude-config:/home/node/.config",
            "-v",
            &format!("{}:/home/node/.claude/projects", sessions_volume),
            "-v",
            &format!("{}:/home/node/.mcp.json:ro", mcp_config_path),
            "claude-agent",
        ])
        .output()
        .map_err(|e| format!("Failed to create container: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to create container: {}", stderr));
    }

    Ok(())
}

/// Remove a Claude agent container
#[command]
pub async fn remove_container(env: String) -> Result<(), String> {
    let container_name = format!("claude-agent-{}", env);

    // Stop first if running
    let _ = Command::new("docker")
        .args(["stop", &container_name])
        .output();

    // Remove the container
    let output = Command::new("docker")
        .args(["rm", "-f", &container_name])
        .output()
        .map_err(|e| format!("Failed to remove container: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to remove container: {}", stderr));
    }

    Ok(())
}

/// Execute a Claude prompt in the Docker container
#[command]
pub async fn execute_claude_prompt(
    env: String,
    prompt: String,
    json_output: bool,
    session_id: Option<String>,
) -> Result<ClaudeCodeResult, String> {
    let container_name = format!("claude-agent-{}", env);

    // Build the claude command arguments
    let mut claude_args = vec![
        "claude".to_string(),
        "--dangerously-skip-permissions".to_string(),
        "--print".to_string(),
    ];

    // Add session resumption if provided
    if let Some(ref sid) = session_id {
        claude_args.push("--resume".to_string());
        claude_args.push(sid.clone());
    }

    if json_output {
        claude_args.push("--output-format".to_string());
        claude_args.push("json".to_string());
    }

    claude_args.push("-p".to_string());
    claude_args.push(prompt);

    // Build docker exec command
    let mut cmd = Command::new("docker");
    cmd.args(["exec", &container_name]);
    cmd.args(&claude_args);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute claude prompt: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        return Ok(ClaudeCodeResult {
            success: false,
            output: None,
            error: Some(if stderr.is_empty() { stdout.clone() } else { stderr }),
            json_output: None,
        });
    }

    // If json_output was requested, try to parse and store the JSON
    let json_result = if json_output {
        Some(stdout.clone())
    } else {
        None
    };

    Ok(ClaudeCodeResult {
        success: true,
        output: Some(stdout),
        error: if stderr.is_empty() { None } else { Some(stderr) },
        json_output: json_result,
    })
}

/// Create a new Claude session and return the session ID
#[command]
pub async fn create_claude_session(env: String) -> Result<String, String> {
    // Generate a new UUID for the session
    let session_id = Uuid::new_v4().to_string();
    let container_name = format!("claude-agent-{}", env);

    // Initialize the session by running a minimal prompt with --session-id
    // This ensures the session file is created
    let output = Command::new("docker")
        .args([
            "exec",
            &container_name,
            "claude",
            "--dangerously-skip-permissions",
            "--print",
            "--session-id",
            &session_id,
            "-p",
            "Hello, this is the start of a new conversation.",
        ])
        .output()
        .map_err(|e| format!("Failed to create session: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to create session: {}", stderr));
    }

    Ok(session_id)
}

/// List all Claude sessions in the container
#[command]
pub async fn list_claude_sessions(env: String) -> Result<Vec<ConversationThread>, String> {
    let container_name = format!("claude-agent-{}", env);

    // List session files in the Claude projects directory
    // Sessions are stored as JSONL files in /home/node/.claude/projects/-home-node/
    let output = Command::new("docker")
        .args([
            "exec",
            &container_name,
            "sh",
            "-c",
            "find /home/node/.claude/projects -name '*.jsonl' -type f 2>/dev/null | head -50",
        ])
        .output()
        .map_err(|e| format!("Failed to list sessions: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let mut threads = Vec::new();

    for line in stdout.lines() {
        if line.trim().is_empty() {
            continue;
        }

        // Extract session ID from filename (e.g., /path/to/abc123.jsonl -> abc123)
        if let Some(filename) = line.split('/').next_back() {
            if let Some(session_id) = filename.strip_suffix(".jsonl") {
                // Get file modification time
                let stat_output = Command::new("docker")
                    .args([
                        "exec",
                        &container_name,
                        "stat",
                        "-c",
                        "%Y",
                        line,
                    ])
                    .output();

                let updated_at = stat_output
                    .ok()
                    .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                    .unwrap_or_default();

                threads.push(ConversationThread {
                    id: session_id.to_string(),
                    environment: env.clone(),
                    title: format!("Thread {}", &session_id[..8.min(session_id.len())]),
                    created_at: updated_at.clone(),
                    updated_at,
                });
            }
        }
    }

    Ok(threads)
}

/// Delete a Claude session from the container
#[command]
pub async fn delete_claude_session(env: String, session_id: String) -> Result<(), String> {
    let container_name = format!("claude-agent-{}", env);

    // Find and delete the session file
    let output = Command::new("docker")
        .args([
            "exec",
            &container_name,
            "sh",
            "-c",
            &format!(
                "find /home/node/.claude/projects -name '{}.jsonl' -type f -delete 2>/dev/null",
                session_id
            ),
        ])
        .output()
        .map_err(|e| format!("Failed to delete session: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to delete session: {}", stderr));
    }

    Ok(())
}
