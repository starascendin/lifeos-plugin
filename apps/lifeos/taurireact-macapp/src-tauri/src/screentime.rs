// Screen Time data reader for macOS
// Reads from ~/Library/Application Support/Knowledge/knowledgeC.db
// Also reads device data from ~/Library/Biome/streams/restricted/App.InFocus

use rusqlite::{Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceInfo {
    pub device_id: String,
    pub device_type: String,  // "mac", "iphone", "ipad", "ios", "unknown"
    pub display_name: String,
    pub session_count: i32,
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

/// Get the path to Biome App.InFocus directory
fn get_biome_path() -> Option<PathBuf> {
    dirs::home_dir().map(|home| {
        home.join("Library/Biome/streams/restricted/App.InFocus")
    })
}

/// Infer device type from device ID pattern
/// Based on Apple UDID patterns:
/// - 00008020* = iPhone
/// - 00008030* = iPad
/// - 32+ hex chars = iOS/tvOS device
/// - Otherwise = Mac
fn infer_device_type(device_id: &str) -> &'static str {
    if device_id.is_empty() || device_id == "local" {
        return "mac";
    }
    if device_id.starts_with("00008020") {
        return "iphone";
    }
    if device_id.starts_with("00008030") {
        return "ipad";
    }
    // Hex UUIDs (with or without hyphens) are typically iOS/tvOS devices
    let clean_id: String = device_id.chars().filter(|c| *c != '-').collect();
    if clean_id.len() >= 32 && clean_id.chars().all(|c| c.is_ascii_hexdigit()) {
        return "ios";
    }
    "mac"
}

/// Generate display name for device based on type and ID
fn get_device_display_name(device_id: &str, device_type: &str) -> String {
    if device_id.is_empty() || device_id == "local" {
        return "This Mac".to_string();
    }
    match device_type {
        "iphone" => format!("iPhone ({}...)", &device_id[..8.min(device_id.len())]),
        "ipad" => format!("iPad ({}...)", &device_id[..8.min(device_id.len())]),
        "ios" => format!("iOS Device ({}...)", &device_id[..8.min(device_id.len())]),
        "mac" => format!("Mac ({}...)", &device_id[..8.min(device_id.len())]),
        _ => format!("Unknown ({}...)", &device_id[..8.min(device_id.len())]),
    }
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
    filter_device_id: Option<&str>,
) -> SqliteResult<Vec<ScreenTimeSession>> {
    let conn = Connection::open(db_path)?;

    // Build the WHERE clause for incremental sync
    let since_clause = since_mac_timestamp
        .map(|ts| format!("AND ZOBJECT.ZSTARTDATE > {}", ts))
        .unwrap_or_default();

    // Build the device filter clause
    let device_clause = filter_device_id
        .map(|id| {
            if id.is_empty() || id == "local" {
                // Filter for local/null device
                "AND (ZSOURCE.ZDEVICEID IS NULL OR ZSOURCE.ZDEVICEID = '')".to_string()
            } else {
                format!("AND ZSOURCE.ZDEVICEID = '{}'", id.replace('\'', "''"))
            }
        })
        .unwrap_or_default();

    let query = format!(
        r#"
        SELECT
            ZOBJECT.ZVALUESTRING as bundle_id,
            ZOBJECT.ZSTARTDATE as start_date,
            ZOBJECT.ZENDDATE as end_date,
            ZOBJECT.ZSECONDSFROMGMT as tz_offset,
            ZOBJECT.ZSTREAMNAME as stream_name,
            ZSOURCE.ZDEVICEID as device_id
        FROM ZOBJECT
        LEFT JOIN ZSOURCE ON ZOBJECT.ZSOURCE = ZSOURCE.Z_PK
        WHERE ZOBJECT.ZSTREAMNAME IN ('/app/usage', '/app/webUsage')
        AND ZOBJECT.ZVALUESTRING IS NOT NULL
        AND ZOBJECT.ZSTARTDATE IS NOT NULL
        AND ZOBJECT.ZENDDATE IS NOT NULL
        {}
        {}
        ORDER BY ZOBJECT.ZSTARTDATE DESC
        LIMIT 10000
        "#,
        since_clause,
        device_clause
    );

    let mut stmt = conn.prepare(&query)?;
    let session_iter = stmt.query_map([], |row| {
        let bundle_id: String = row.get(0)?;
        let start_date: f64 = row.get(1)?;
        let end_date: Option<f64> = row.get(2).ok();
        let tz_offset: Option<i32> = row.get(3).ok();
        let stream_name: String = row.get(4)?;
        let device_id: Option<String> = row.get(5).ok();

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

        // Normalize empty device_id to "local"
        let normalized_device_id = match &device_id {
            Some(id) if !id.is_empty() => Some(id.clone()),
            _ => Some("local".to_string()),
        };

        Ok(ScreenTimeSession {
            bundle_id: bundle_id.clone(),
            app_name: get_app_name(&bundle_id),
            category: get_category(&bundle_id),
            start_time: start_time_ms,
            end_time: end_time_ms,
            duration_seconds,
            timezone_offset: tz_offset,
            device_id: normalized_device_id,
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
    device_id: Option<String>,    // Optional device filter
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

    match read_sessions_from_db(&db_path, since_mac, device_id.as_deref()) {
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

/// Enumerate devices from Biome directory structure
fn enumerate_biome_devices() -> Vec<DeviceInfo> {
    let mut devices = Vec::new();

    let biome_path = match get_biome_path() {
        Some(path) => path,
        None => return devices,
    };

    // Check local device
    let local_path = biome_path.join("local");
    if local_path.exists() && local_path.is_dir() {
        // Count files as proxy for session activity
        let file_count = fs::read_dir(&local_path)
            .map(|entries| entries.filter_map(|e| e.ok()).count())
            .unwrap_or(0);

        if file_count > 0 {
            devices.push(DeviceInfo {
                device_id: "local".to_string(),
                device_type: "mac".to_string(),
                display_name: "This Mac (Biome)".to_string(),
                session_count: file_count as i32,
            });
        }
    }

    // Check remote devices
    let remote_path = biome_path.join("remote");
    if remote_path.exists() && remote_path.is_dir() {
        if let Ok(entries) = fs::read_dir(&remote_path) {
            for entry in entries.filter_map(|e| e.ok()) {
                if entry.path().is_dir() {
                    let device_id = entry.file_name().to_string_lossy().to_string();
                    let device_type = infer_device_type(&device_id);
                    let display_name = get_device_display_name(&device_id, device_type);

                    // Count files in device directory
                    let file_count = fs::read_dir(entry.path())
                        .map(|entries| entries.filter_map(|e| e.ok()).count())
                        .unwrap_or(0);

                    if file_count > 0 {
                        devices.push(DeviceInfo {
                            device_id,
                            device_type: device_type.to_string(),
                            display_name,
                            session_count: file_count as i32,
                        });
                    }
                }
            }
        }
    }

    devices
}

/// List all devices with screen time data
#[command]
pub async fn list_screentime_devices() -> Result<Vec<DeviceInfo>, String> {
    // Check permission first
    if !check_full_disk_access() {
        return Err("Full Disk Access permission required".to_string());
    }

    let db_path = get_knowledge_db_path()
        .ok_or_else(|| "Could not determine home directory".to_string())?;

    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Query unique devices from knowledgeC.db
    let query = r#"
        SELECT
            ZSOURCE.ZDEVICEID as device_id,
            COUNT(*) as session_count
        FROM ZOBJECT
        LEFT JOIN ZSOURCE ON ZOBJECT.ZSOURCE = ZSOURCE.Z_PK
        WHERE ZOBJECT.ZSTREAMNAME = '/app/usage'
        AND ZOBJECT.ZVALUESTRING IS NOT NULL
        GROUP BY ZSOURCE.ZDEVICEID
        ORDER BY session_count DESC
    "#;

    let mut stmt = conn.prepare(query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let mut devices: Vec<DeviceInfo> = stmt.query_map([], |row| {
        let device_id: Option<String> = row.get(0).ok();
        let session_count: i32 = row.get(1)?;

        // Normalize device ID
        let normalized_id = device_id.unwrap_or_default();
        let id_for_type = if normalized_id.is_empty() { "local" } else { &normalized_id };
        let device_type = infer_device_type(id_for_type);
        let display_name = get_device_display_name(id_for_type, device_type);

        Ok(DeviceInfo {
            device_id: if normalized_id.is_empty() { "local".to_string() } else { normalized_id },
            device_type: device_type.to_string(),
            display_name,
            session_count,
        })
    })
    .map_err(|e| format!("Query error: {}", e))?
    .filter_map(|r| r.ok())
    .collect();

    // Add Biome devices (may have additional remote devices)
    let biome_devices = enumerate_biome_devices();
    for biome_device in biome_devices {
        // Only add if not already in list
        if !devices.iter().any(|d| d.device_id == biome_device.device_id) {
            devices.push(biome_device);
        }
    }

    // Sort by session count descending
    devices.sort_by(|a, b| b.session_count.cmp(&a.session_count));

    Ok(devices)
}

// ============================================
// Aggregated Stats Commands (for dashboard)
// ============================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppUsageStat {
    pub bundle_id: String,
    pub app_name: String,
    pub category: String,
    pub seconds: i64,
    pub session_count: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CategoryUsageStat {
    pub category: String,
    pub seconds: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DailyStats {
    pub date: String,
    pub total_seconds: i64,
    pub app_usage: Vec<AppUsageStat>,
    pub category_usage: Vec<CategoryUsageStat>,
    pub device_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DailySummaryEntry {
    pub date: String,
    pub total_seconds: i64,
}

/// Get daily stats for a specific date with optional device filter
#[command]
pub async fn get_screentime_daily_stats(
    date: String, // YYYY-MM-DD format
    device_id: Option<String>,
) -> Result<Option<DailyStats>, String> {
    if !check_full_disk_access() {
        return Err("Full Disk Access permission required".to_string());
    }

    let db_path = get_knowledge_db_path()
        .ok_or_else(|| "Could not determine home directory".to_string())?;

    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Parse date to get Mac epoch range
    let date_start = format!("{} 00:00:00", date);
    let date_end = format!("{} 23:59:59", date);

    // Convert to Mac epoch
    let start_unix = chrono::NaiveDateTime::parse_from_str(&date_start, "%Y-%m-%d %H:%M:%S")
        .map_err(|e| format!("Invalid date format: {}", e))?
        .and_utc()
        .timestamp() as f64;
    let end_unix = chrono::NaiveDateTime::parse_from_str(&date_end, "%Y-%m-%d %H:%M:%S")
        .map_err(|e| format!("Invalid date format: {}", e))?
        .and_utc()
        .timestamp() as f64;

    let start_mac = start_unix - MAC_EPOCH_OFFSET as f64;
    let end_mac = end_unix - MAC_EPOCH_OFFSET as f64;

    // Build device filter clause
    let device_clause = device_id.as_ref()
        .map(|id| {
            if id.is_empty() || id == "local" {
                "AND (ZSOURCE.ZDEVICEID IS NULL OR ZSOURCE.ZDEVICEID = '')".to_string()
            } else {
                format!("AND ZSOURCE.ZDEVICEID = '{}'", id.replace('\'', "''"))
            }
        })
        .unwrap_or_default();

    // Query aggregated app usage
    let query = format!(
        r#"
        SELECT
            ZOBJECT.ZVALUESTRING as bundle_id,
            SUM(ZOBJECT.ZENDDATE - ZOBJECT.ZSTARTDATE) as total_seconds,
            COUNT(*) as session_count
        FROM ZOBJECT
        LEFT JOIN ZSOURCE ON ZOBJECT.ZSOURCE = ZSOURCE.Z_PK
        WHERE ZOBJECT.ZSTREAMNAME = '/app/usage'
        AND ZOBJECT.ZVALUESTRING IS NOT NULL
        AND ZOBJECT.ZSTARTDATE >= {}
        AND ZOBJECT.ZSTARTDATE <= {}
        AND (ZOBJECT.ZENDDATE - ZOBJECT.ZSTARTDATE) >= 5
        AND (ZOBJECT.ZENDDATE - ZOBJECT.ZSTARTDATE) < 86400
        {}
        GROUP BY ZOBJECT.ZVALUESTRING
        ORDER BY total_seconds DESC
        "#,
        start_mac, end_mac, device_clause
    );

    let mut stmt = conn.prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let mut app_usage: Vec<AppUsageStat> = Vec::new();
    let mut category_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    let mut total_seconds: i64 = 0;

    let rows = stmt.query_map([], |row| {
        let bundle_id: String = row.get(0)?;
        let seconds: f64 = row.get(1)?;
        let session_count: i32 = row.get(2)?;
        Ok((bundle_id, seconds as i64, session_count))
    }).map_err(|e| format!("Query error: {}", e))?;

    for row in rows.filter_map(|r| r.ok()) {
        let (bundle_id, seconds, session_count) = row;
        let app_name = get_app_name(&bundle_id).unwrap_or_else(|| bundle_id.clone());
        let category = get_category(&bundle_id).unwrap_or_else(|| "Other".to_string());

        total_seconds += seconds;
        *category_map.entry(category.clone()).or_insert(0) += seconds;

        app_usage.push(AppUsageStat {
            bundle_id,
            app_name,
            category,
            seconds,
            session_count,
        });
    }

    if app_usage.is_empty() {
        return Ok(None);
    }

    // Convert category map to sorted vec
    let mut category_usage: Vec<CategoryUsageStat> = category_map
        .into_iter()
        .map(|(category, seconds)| CategoryUsageStat { category, seconds })
        .collect();
    category_usage.sort_by(|a, b| b.seconds.cmp(&a.seconds));

    Ok(Some(DailyStats {
        date,
        total_seconds,
        app_usage,
        category_usage,
        device_id,
    }))
}

/// Get recent daily summaries with optional device filter
#[command]
pub async fn get_screentime_recent_summaries(
    days: i32,
    device_id: Option<String>,
) -> Result<Vec<DailySummaryEntry>, String> {
    if !check_full_disk_access() {
        return Err("Full Disk Access permission required".to_string());
    }

    let db_path = get_knowledge_db_path()
        .ok_or_else(|| "Could not determine home directory".to_string())?;

    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Calculate cutoff date
    let cutoff = chrono::Utc::now() - chrono::Duration::days(days as i64);
    let cutoff_mac = cutoff.timestamp() as f64 - MAC_EPOCH_OFFSET as f64;

    // Build device filter clause
    let device_clause = device_id.as_ref()
        .map(|id| {
            if id.is_empty() || id == "local" {
                "AND (ZSOURCE.ZDEVICEID IS NULL OR ZSOURCE.ZDEVICEID = '')".to_string()
            } else {
                format!("AND ZSOURCE.ZDEVICEID = '{}'", id.replace('\'', "''"))
            }
        })
        .unwrap_or_default();

    // Query daily totals
    let query = format!(
        r#"
        SELECT
            DATE(DATETIME(ZOBJECT.ZSTARTDATE + {}, 'unixepoch')) as date,
            SUM(ZOBJECT.ZENDDATE - ZOBJECT.ZSTARTDATE) as total_seconds
        FROM ZOBJECT
        LEFT JOIN ZSOURCE ON ZOBJECT.ZSOURCE = ZSOURCE.Z_PK
        WHERE ZOBJECT.ZSTREAMNAME = '/app/usage'
        AND ZOBJECT.ZVALUESTRING IS NOT NULL
        AND ZOBJECT.ZSTARTDATE >= {}
        AND (ZOBJECT.ZENDDATE - ZOBJECT.ZSTARTDATE) >= 5
        AND (ZOBJECT.ZENDDATE - ZOBJECT.ZSTARTDATE) < 86400
        {}
        GROUP BY DATE(DATETIME(ZOBJECT.ZSTARTDATE + {}, 'unixepoch'))
        ORDER BY date DESC
        "#,
        MAC_EPOCH_OFFSET, cutoff_mac, device_clause, MAC_EPOCH_OFFSET
    );

    let mut stmt = conn.prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let summaries: Vec<DailySummaryEntry> = stmt.query_map([], |row| {
        let date: String = row.get(0)?;
        let total_seconds: f64 = row.get(1)?;
        Ok(DailySummaryEntry {
            date,
            total_seconds: total_seconds as i64,
        })
    })
    .map_err(|e| format!("Query error: {}", e))?
    .filter_map(|r| r.ok())
    .collect();

    Ok(summaries)
}
