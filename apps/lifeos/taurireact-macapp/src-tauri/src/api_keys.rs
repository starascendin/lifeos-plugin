use std::process::Command;
use tauri::{command, AppHandle};
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "api-keys.json";
const GROQ_API_KEY: &str = "groq_api_key";

/// Open macOS System Settings to Full Disk Access page
#[command]
pub fn open_full_disk_access_settings() -> Result<(), String> {
    Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles")
        .spawn()
        .map_err(|e| format!("Failed to open settings: {}", e))?;
    Ok(())
}

/// Save Groq API key to the store
#[command]
pub async fn save_groq_api_key(app: AppHandle, api_key: String) -> Result<(), String> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    store.set(GROQ_API_KEY, api_key);

    store
        .save()
        .map_err(|e| format!("Failed to persist store: {}", e))?;

    Ok(())
}

/// Get Groq API key from the store
#[command]
pub async fn get_groq_api_key(app: AppHandle) -> Result<Option<String>, String> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    let api_key: Option<String> = store
        .get(GROQ_API_KEY)
        .and_then(|v| serde_json::from_value(v.clone()).ok());

    Ok(api_key)
}

/// Delete Groq API key from the store
#[command]
pub async fn delete_groq_api_key(app: AppHandle) -> Result<(), String> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    store.delete(GROQ_API_KEY);

    store
        .save()
        .map_err(|e| format!("Failed to persist store: {}", e))?;

    Ok(())
}

/// Internal function to get API key (for use by other modules)
/// Falls back to environment variable if store key is not set
pub fn get_groq_api_key_internal(app: &AppHandle) -> Result<String, String> {
    // First try the store
    if let Ok(store) = app.store(STORE_FILE) {
        if let Some(api_key) = store.get(GROQ_API_KEY) {
            if let Ok(key) = serde_json::from_value::<String>(api_key.clone()) {
                if !key.is_empty() {
                    return Ok(key);
                }
            }
        }
    }

    // Fall back to environment variable (for development)
    std::env::var("GROQ_API_KEY").map_err(|_| {
        "GROQ_API_KEY not configured. Please set it in Settings > API Keys.".to_string()
    })
}
