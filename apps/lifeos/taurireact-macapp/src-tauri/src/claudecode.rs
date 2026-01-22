use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::command;

/// Container status information
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContainerStatus {
    pub exists: bool,
    pub running: bool,
    pub name: String,
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

/// Execute a Claude prompt in the Docker container
#[command]
pub async fn execute_claude_prompt(
    env: String,
    prompt: String,
    json_output: bool,
) -> Result<ClaudeCodeResult, String> {
    let container_name = format!("claude-agent-{}", env);

    // Build the claude command arguments
    let mut claude_args = vec![
        "claude".to_string(),
        "--dangerously-skip-permissions".to_string(),
        "--print".to_string(),
    ];

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
