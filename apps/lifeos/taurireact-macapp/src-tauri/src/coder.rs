use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::command;

/// Represents a Coder template
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CoderTemplate {
    pub name: String,
    pub display_name: String,
}

/// Represents a Coder workspace preset
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CoderPreset {
    pub name: String,
    pub template: String,
}

/// Result of delegating to a Coder agent
#[derive(Debug, Serialize, Deserialize)]
pub struct DelegateResult {
    pub success: bool,
    pub task_id: Option<String>,
    pub error: Option<String>,
}

/// Internal struct for parsing `coder templates list -o json` output
#[derive(Debug, Deserialize)]
struct CoderTemplateJson {
    name: String,
    display_name: Option<String>,
}

/// Get list of available Coder templates
#[command]
pub async fn get_coder_templates() -> Result<Vec<CoderTemplate>, String> {
    let output = Command::new("coder")
        .args(["templates", "list", "-o", "json"])
        .output()
        .map_err(|e| format!("Failed to run coder CLI: {}. Is coder installed and authenticated?", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Coder templates list failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let templates: Vec<CoderTemplateJson> = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse coder templates output: {}", e))?;

    Ok(templates
        .into_iter()
        .map(|t| CoderTemplate {
            display_name: t.display_name.unwrap_or_else(|| t.name.clone()),
            name: t.name,
        })
        .collect())
}

/// Get list of available presets for a template
/// Note: Presets are defined in the template's main.tf and may not be easily queryable via CLI.
/// For now, we return hardcoded presets based on known templates.
#[command]
pub async fn get_coder_presets(template: String) -> Result<Vec<CoderPreset>, String> {
    // Hardcoded presets based on the main.tf configuration
    // In the future, this could query the Coder API directly
    let presets = match template.as_str() {
        "testtaskdocker" => vec![
            CoderPreset {
                name: "hola-monorepo".to_string(),
                template: template.clone(),
            },
            CoderPreset {
                name: "hola-monorepo (Sonnet)".to_string(),
                template: template.clone(),
            },
            CoderPreset {
                name: "mindworks-kortex-monorepo".to_string(),
                template: template.clone(),
            },
            CoderPreset {
                name: "mindworks-kortex (Sonnet)".to_string(),
                template: template.clone(),
            },
        ],
        _ => {
            // For unknown templates, return a default preset
            vec![CoderPreset {
                name: "default".to_string(),
                template: template.clone(),
            }]
        }
    };

    Ok(presets)
}

/// Delegate an issue to a Coder agent by creating a new task
#[command]
pub async fn delegate_to_coder(
    template: String,
    preset: String,
    issue_identifier: String,
    issue_title: String,
    issue_description: Option<String>,
    issue_status: String,
    issue_priority: String,
) -> Result<DelegateResult, String> {
    // Format the task description
    let description = format!(
        "Issue: {} - {}\n\n{}\n\n---\nStatus: {}\nPriority: {}",
        issue_identifier,
        issue_title,
        issue_description.unwrap_or_default(),
        issue_status,
        issue_priority
    );

    // Run: coder task create --template <template> --preset "<preset>" "<description>"
    let output = Command::new("coder")
        .args([
            "task",
            "create",
            "--template",
            &template,
            "--preset",
            &preset,
            &description,
        ])
        .output()
        .map_err(|e| format!("Failed to run coder CLI: {}. Is coder installed and authenticated?", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Ok(DelegateResult {
            success: false,
            task_id: None,
            error: Some(format!("Coder task create failed: {}", stderr)),
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Try to extract task ID from output
    // The output format may vary, so we'll do a best-effort extraction
    let task_id = extract_task_id(&stdout);

    Ok(DelegateResult {
        success: true,
        task_id,
        error: None,
    })
}

/// Extract task ID from coder task create output
/// The output typically contains something like "Task ID: abc123" or similar
fn extract_task_id(output: &str) -> Option<String> {
    // Try common patterns
    // Pattern 1: "Task ID: xxx"
    if let Some(idx) = output.to_lowercase().find("task id:") {
        let after = &output[idx + 8..];
        let id: String = after
            .trim()
            .chars()
            .take_while(|c| !c.is_whitespace())
            .collect();
        if !id.is_empty() {
            return Some(id);
        }
    }

    // Pattern 2: "id: xxx" in JSON-like output
    if let Some(idx) = output.find("\"id\":") {
        let after = &output[idx + 5..];
        let id: String = after
            .trim()
            .trim_matches('"')
            .chars()
            .take_while(|c| *c != '"' && *c != ',' && *c != '}')
            .collect();
        if !id.is_empty() {
            return Some(id);
        }
    }

    // If we can't extract an ID, return None
    // The task was still created successfully
    None
}
