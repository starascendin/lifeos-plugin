// Screen Time data reader for macOS
// Reads from ~/Library/Application Support/Knowledge/knowledgeC.db

use rusqlite::{Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::command;

// Mac epoch offset: seconds from Jan 1, 1970 (Unix epoch) to Jan 1, 2001 (Mac epoch)
const MAC_EPOCH_OFFSET: i64 = 978307200;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScreenTimeSession {
    pub bundle_id: String,
    pub app_name: Option<String>,
    pub category: Option<String>,
    pub start_time: i64,      // Unix epoch milliseconds
    pub end_time: i64,        // Unix epoch milliseconds
    pub duration_seconds: i64,
    pub timezone_offset: Option<i32>,
    pub device_id: Option<String>,
    pub is_web_usage: bool,
    pub domain: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScreenTimeResult {
    pub sessions: Vec<ScreenTimeSession>,
    pub has_permission: bool,
    pub error: Option<String>,
}

/// Get the path to knowledgeC.db
fn get_knowledge_db_path() -> Option<PathBuf> {
    dirs::home_dir().map(|home| {
        home.join("Library/Application Support/Knowledge/knowledgeC.db")
    })
}

/// Check if Full Disk Access permission is granted by attempting to read the DB
fn check_full_disk_access() -> bool {
    let db_path = match get_knowledge_db_path() {
        Some(path) => path,
        None => return false,
    };

    // Try to open the database - this will fail without Full Disk Access
    match Connection::open(&db_path) {
        Ok(conn) => {
            // Try a simple query to verify we can actually read
            match conn.query_row("SELECT COUNT(*) FROM ZOBJECT LIMIT 1", [], |_| Ok(())) {
                Ok(_) => true,
                Err(_) => false,
            }
        }
        Err(_) => false,
    }
}

/// Convert Mac epoch timestamp to Unix epoch milliseconds
fn mac_to_unix_ms(mac_timestamp: f64) -> i64 {
    ((mac_timestamp + MAC_EPOCH_OFFSET as f64) * 1000.0) as i64
}

/// Map bundle ID to human-readable app name
fn get_app_name(bundle_id: &str) -> Option<String> {
    let mappings: &[(&str, &str)] = &[
        ("com.apple.Safari", "Safari"),
        ("com.google.Chrome", "Chrome"),
        ("org.mozilla.firefox", "Firefox"),
        ("com.brave.Browser", "Brave"),
        ("com.apple.mail", "Mail"),
        ("com.apple.MobileSMS", "Messages"),
        ("com.slack.Slack", "Slack"),
        ("com.tinyspeck.slackmacgap", "Slack"),
        ("com.microsoft.teams", "Microsoft Teams"),
        ("com.hnc.Discord", "Discord"),
        ("com.spotify.client", "Spotify"),
        ("com.apple.Music", "Music"),
        ("com.apple.TV", "Apple TV"),
        ("com.netflix.Netflix", "Netflix"),
        ("com.microsoft.VSCode", "VS Code"),
        ("com.apple.dt.Xcode", "Xcode"),
        ("com.apple.Terminal", "Terminal"),
        ("com.googlecode.iterm2", "iTerm2"),
        ("com.apple.finder", "Finder"),
        ("com.apple.Notes", "Notes"),
        ("com.apple.reminders", "Reminders"),
        ("com.apple.iCal", "Calendar"),
        ("com.apple.Preview", "Preview"),
        ("com.apple.Photos", "Photos"),
        ("com.apple.ActivityMonitor", "Activity Monitor"),
        ("com.apple.systempreferences", "System Settings"),
        ("notion.id", "Notion"),
        ("com.figma.Desktop", "Figma"),
        ("com.linear", "Linear"),
        ("com.github.GitHubClient", "GitHub Desktop"),
        ("com.postmanlabs.mac", "Postman"),
        ("com.docker.docker", "Docker"),
        ("com.1password.1password", "1Password"),
        ("com.anthropic.claudefordesktop", "Claude"),
        ("com.openai.chat", "ChatGPT"),
        ("md.obsidian", "Obsidian"),
        ("com.culturedcode.ThingsMac", "Things"),
        ("com.todoist.mac.Todoist", "Todoist"),
        ("com.flexibits.fantastical2.mac", "Fantastical"),
        ("com.raycast.macos", "Raycast"),
        ("com.alfredapp.Alfred", "Alfred"),
    ];

    for (id, name) in mappings {
        if bundle_id == *id {
            return Some(name.to_string());
        }
    }

    // Extract app name from bundle ID as fallback (last component)
    bundle_id
        .split('.')
        .last()
        .map(|s| {
            // Capitalize first letter
            let mut chars = s.chars();
            match chars.next() {
                None => String::new(),
                Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
            }
        })
}

/// Get category for app bundle ID
fn get_category(bundle_id: &str) -> Option<String> {
    let categories: &[(&[&str], &str)] = &[
        (
            &[
                "com.apple.Safari",
                "com.google.Chrome",
                "org.mozilla.firefox",
                "com.brave.Browser",
                "com.microsoft.edgemac",
            ],
            "Browsers",
        ),
        (
            &[
                "com.slack.Slack",
                "com.tinyspeck.slackmacgap",
                "com.microsoft.teams",
                "com.hnc.Discord",
                "com.apple.MobileSMS",
                "us.zoom.xos",
            ],
            "Communication",
        ),
        (
            &[
                "com.apple.mail",
                "com.microsoft.Outlook",
                "com.google.Gmail",
            ],
            "Email",
        ),
        (
            &[
                "com.spotify.client",
                "com.apple.Music",
                "com.apple.TV",
                "com.netflix.Netflix",
                "com.apple.podcasts",
            ],
            "Entertainment",
        ),
        (
            &[
                "com.microsoft.VSCode",
                "com.apple.dt.Xcode",
                "com.apple.Terminal",
                "com.googlecode.iterm2",
                "com.jetbrains",
                "com.github.GitHubClient",
                "com.postmanlabs.mac",
                "com.docker.docker",
            ],
            "Development",
        ),
        (
            &[
                "com.apple.Notes",
                "com.apple.reminders",
                "notion.id",
                "md.obsidian",
                "com.culturedcode.ThingsMac",
                "com.todoist.mac.Todoist",
                "com.linear",
            ],
            "Productivity",
        ),
        (
            &["com.figma.Desktop", "com.adobe", "com.sketch"],
            "Design",
        ),
        (
            &[
                "com.apple.finder",
                "com.apple.systempreferences",
                "com.apple.ActivityMonitor",
            ],
            "System",
        ),
        (
            &[
                "com.anthropic.claudefordesktop",
                "com.openai.chat",
            ],
            "AI",
        ),
    ];

    for (ids, category) in categories {
        if ids.iter().any(|id| bundle_id.contains(id)) {
            return Some(category.to_string());
        }
    }

    Some("Other".to_string())
}

/// Read Screen Time sessions from knowledgeC.db
fn read_sessions_from_db(
    db_path: &PathBuf,
    since_mac_timestamp: Option<f64>,
) -> SqliteResult<Vec<ScreenTimeSession>> {
    let conn = Connection::open(db_path)?;

    // Build the WHERE clause for incremental sync
    let since_clause = since_mac_timestamp
        .map(|ts| format!("AND ZSTARTDATE > {}", ts))
        .unwrap_or_default();

    let query = format!(
        r#"
        SELECT
            ZVALUESTRING as bundle_id,
            ZSTARTDATE as start_date,
            ZENDDATE as end_date,
            ZSECONDSFROMGMT as tz_offset,
            ZSTREAMNAME as stream_name
        FROM ZOBJECT
        WHERE ZSTREAMNAME IN ('/app/usage', '/app/webUsage')
        AND ZVALUESTRING IS NOT NULL
        AND ZSTARTDATE IS NOT NULL
        AND ZENDDATE IS NOT NULL
        {}
        ORDER BY ZSTARTDATE DESC
        LIMIT 10000
        "#,
        since_clause
    );

    let mut stmt = conn.prepare(&query)?;
    let session_iter = stmt.query_map([], |row| {
        let bundle_id: String = row.get(0)?;
        let start_date: f64 = row.get(1)?;
        let end_date: Option<f64> = row.get(2).ok();
        let tz_offset: Option<i32> = row.get(3).ok();
        let stream_name: String = row.get(4)?;

        let start_time_ms = mac_to_unix_ms(start_date);
        let end_time_ms = end_date.map(mac_to_unix_ms).unwrap_or(start_time_ms);
        let duration_seconds = (end_time_ms - start_time_ms) / 1000;

        let is_web_usage = stream_name == "/app/webUsage";

        // Extract domain for web usage (bundle_id might contain URL)
        let domain = if is_web_usage && bundle_id.contains('.') && !bundle_id.starts_with("com.") {
            Some(bundle_id.clone())
        } else {
            None
        };

        Ok(ScreenTimeSession {
            bundle_id: bundle_id.clone(),
            app_name: get_app_name(&bundle_id),
            category: get_category(&bundle_id),
            start_time: start_time_ms,
            end_time: end_time_ms,
            duration_seconds,
            timezone_offset: tz_offset,
            device_id: None, // Could extract from ZSOURCE.ZDEVICEID if needed
            is_web_usage,
            domain,
        })
    })?;

    let mut result = Vec::new();
    for session in session_iter {
        if let Ok(s) = session {
            // Filter out very short sessions (< 5 seconds) and invalid durations
            if s.duration_seconds >= 5 && s.duration_seconds < 86400 {
                result.push(s);
            }
        }
    }

    Ok(result)
}

/// Check if Full Disk Access is granted (callable from frontend)
#[command]
pub fn check_screentime_permission() -> bool {
    check_full_disk_access()
}

/// Read Screen Time sessions from knowledgeC.db
#[command]
pub async fn read_screentime_sessions(
    since_timestamp: Option<i64>, // Unix epoch ms, for incremental sync
) -> Result<ScreenTimeResult, String> {
    // Check permission first
    if !check_full_disk_access() {
        return Ok(ScreenTimeResult {
            sessions: vec![],
            has_permission: false,
            error: Some("Full Disk Access permission required. Please grant access in System Settings > Privacy & Security > Full Disk Access.".to_string()),
        });
    }

    let db_path = get_knowledge_db_path()
        .ok_or_else(|| "Could not determine home directory".to_string())?;

    // Convert since_timestamp back to Mac epoch for SQL query
    let since_mac = since_timestamp.map(|ts| (ts as f64 / 1000.0) - MAC_EPOCH_OFFSET as f64);

    match read_sessions_from_db(&db_path, since_mac) {
        Ok(sessions) => Ok(ScreenTimeResult {
            sessions,
            has_permission: true,
            error: None,
        }),
        Err(e) => Ok(ScreenTimeResult {
            sessions: vec![],
            has_permission: true,
            error: Some(format!("Database error: {}", e)),
        }),
    }
}

/// Get device identifier
#[command]
pub fn get_device_id() -> Option<String> {
    gethostname::gethostname()
        .to_str()
        .map(|s| s.to_string())
}
