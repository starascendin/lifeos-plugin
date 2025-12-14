// Screen Time data reader for macOS
// Reads from ~/Library/Application Support/Knowledge/knowledgeC.db
// Also reads device data from ~/Library/Biome/streams/restricted/App.InFocus

use rusqlite::{Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::command;

// Mac epoch offset: seconds from Jan 1, 1970 (Unix epoch) to Jan 1, 2001 (Mac epoch)
const MAC_EPOCH_OFFSET: i64 = 978307200;

/// The ONLY bundle ID that definitively identifies an iPhone
/// com.apple.mobilesafari is iOS Safari - macOS uses com.apple.Safari
const IPHONE_BUNDLE_ID: &str = "com.apple.mobilesafari";

/// Session count threshold for "real" devices vs "misc"
/// Devices with fewer sessions are considered misc/old devices
const REAL_DEVICE_SESSION_THRESHOLD: i32 = 10000;

/// System bundle IDs/app names to exclude from screen time
/// These are system events, not actual app usage
const SYSTEM_BUNDLE_IDS: &[&str] = &[
    "SleepLockScreen",
    "Home-screen-open-folder",
    "Control-center",
    "Mobileslideshow",
    "com.apple.springboard",
    "PosterBoard",
    "com.apple.PosterBoard",
    "com.apple.SleepLockScreen",
    "com.apple.Home-screen-open-folder",
    "com.apple.Control-center",
];

/// Check if a bundle ID or app name should be excluded
fn is_system_event(bundle_id: &str, app_name: Option<&str>) -> bool {
    // Check bundle ID
    for system_id in SYSTEM_BUNDLE_IDS {
        if bundle_id.contains(system_id) || bundle_id == *system_id {
            return true;
        }
    }
    // Check app name (derived from bundle ID)
    if let Some(name) = app_name {
        for system_id in SYSTEM_BUNDLE_IDS {
            if name == *system_id {
                return true;
            }
        }
    }
    false
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScreenTimeSession {
    pub bundle_id: String,
    pub app_name: Option<String>,
    pub category: Option<String>,
    pub start_time: i64, // Unix epoch milliseconds
    pub end_time: i64,   // Unix epoch milliseconds
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
    pub device_type: String, // "mac", "iphone", "ipad", "ios", "unknown"
    pub display_name: String,
    pub session_count: i32,
}

/// Get the path to knowledgeC.db
fn get_knowledge_db_path() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join("Library/Application Support/Knowledge/knowledgeC.db"))
}

/// Get the path to our own screentime database in the app data directory
fn get_app_screentime_db_path() -> Option<PathBuf> {
    dirs::data_local_dir().map(|data_dir| {
        let app_dir = data_dir.join("com.bryanliu.tubevault").join("screentime");
        // Create directory if it doesn't exist
        let _ = fs::create_dir_all(&app_dir);
        app_dir.join("screentime.db")
    })
}

/// Initialize our screentime database with schema
fn init_screentime_database(db_path: &PathBuf) -> SqliteResult<()> {
    let conn = Connection::open(db_path)?;

    // Enable WAL mode for better concurrent access
    conn.execute_batch("PRAGMA journal_mode=WAL")?;

    // Create devices table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS devices (
            id TEXT PRIMARY KEY,
            name TEXT,
            type TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // Create sessions table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT DEFAULT 'local',
            bundle_id TEXT NOT NULL,
            app_name TEXT NOT NULL,
            category TEXT NOT NULL,
            start_time TIMESTAMP NOT NULL,
            end_time TIMESTAMP NOT NULL,
            duration_seconds REAL NOT NULL,
            timezone_offset INTEGER,
            created_at TIMESTAMP,
            exported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (device_id) REFERENCES devices(id)
        )",
        [],
    )?;

    // Create indexes
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sessions_bundle_id ON sessions(bundle_id)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON sessions(device_id)",
        [],
    )?;

    // Create daily_summary table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS daily_summary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            device_id TEXT DEFAULT 'local',
            bundle_id TEXT NOT NULL,
            app_name TEXT NOT NULL,
            category TEXT NOT NULL,
            total_duration_seconds REAL NOT NULL,
            session_count INTEGER NOT NULL,
            exported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(date, device_id, bundle_id)
        )",
        [],
    )?;

    // Create sync_metadata table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sync_metadata (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            last_sync_timestamp REAL DEFAULT 0,
            last_sync_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // Initialize sync_metadata if empty
    conn.execute(
        "INSERT OR IGNORE INTO sync_metadata (id, last_sync_timestamp) VALUES (1, 0)",
        [],
    )?;

    Ok(())
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
    dirs::home_dir().map(|home| home.join("Library/Biome/streams/restricted/App.InFocus"))
}

/// Check if device has com.apple.mobilesafari - the ONLY way to identify an iPhone
fn detect_device_type_from_apps(bundle_ids: &[String]) -> Option<&'static str> {
    for bundle_id in bundle_ids {
        if bundle_id == IPHONE_BUNDLE_ID {
            return Some("iphone");
        }
    }
    None
}

/// Get bundle IDs for a device from Biome SEGB files
/// SEGB files contain binary data with bundle IDs embedded as strings
fn get_device_bundle_ids_from_biome(device_id: &str) -> Vec<String> {
    use std::collections::HashSet;

    let biome_path = match get_biome_path() {
        Some(path) => path,
        None => return Vec::new(),
    };

    // Determine the device directory
    let device_dir = if device_id.is_empty() || device_id == "local" {
        biome_path.join("local")
    } else {
        biome_path.join("remote").join(device_id)
    };

    if !device_dir.exists() || !device_dir.is_dir() {
        return Vec::new();
    }

    let mut bundle_ids = HashSet::new();

    // Read SEGB files and extract bundle IDs using regex
    let bundle_regex = regex::Regex::new(r"com\.apple\.[a-zA-Z0-9._-]+").unwrap();

    if let Ok(entries) = fs::read_dir(&device_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            // Skip directories and non-SEGB files
            if path.is_dir() || path.file_name().map(|n| n.to_string_lossy().starts_with('.')).unwrap_or(true) {
                continue;
            }

            // Read file content as bytes
            if let Ok(content) = fs::read(&path) {
                // Convert to string (lossy) to find bundle IDs
                let content_str = String::from_utf8_lossy(&content);
                for cap in bundle_regex.find_iter(&content_str) {
                    let bundle_id = cap.as_str().to_string();
                    // Filter out SpringBoard transition reasons, keep real app bundle IDs
                    if !bundle_id.contains("SpringBoard") && !bundle_id.contains("PosterBoard") {
                        bundle_ids.insert(bundle_id);
                    }
                }
            }

            // Limit to first few files to avoid slow startup
            if bundle_ids.len() >= 50 {
                break;
            }
        }
    }

    bundle_ids.into_iter().collect()
}

/// Infer device type using both UDID patterns and app analysis
fn infer_device_type_with_apps(device_id: &str, bundle_ids: &[String]) -> &'static str {
    // First try UDID pattern matching (if definitive)
    if device_id.is_empty() || device_id == "local" {
        return "mac";
    }
    if device_id.starts_with("00008020") {
        return "iphone";
    }
    if device_id.starts_with("00008030") {
        return "ipad";
    }

    // For ambiguous hex UUIDs, check apps to determine if iOS
    let clean_id: String = device_id.chars().filter(|c| *c != '-').collect();
    if clean_id.len() >= 32 && clean_id.chars().all(|c| c.is_ascii_hexdigit()) {
        // Check if it has iOS-specific apps
        if let Some(detected_type) = detect_device_type_from_apps(bundle_ids) {
            return detected_type;
        }
        // Default to "ios" for unidentified hex UUIDs
        return "ios";
    }

    "mac"
}

/// Infer device type from device ID pattern only (legacy, used where we don't have app data)
/// Based on Apple UDID patterns:
/// - 00008020* = iPhone
/// - 00008030* = iPad
/// - 32+ hex chars = iOS/tvOS device
/// - Otherwise = Mac
#[allow(dead_code)]
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

/// Get known device name by UUID (hard-coded mappings)
fn get_known_device_name(device_id: &str) -> Option<&'static str> {
    // Known devices - add your device mappings here
    const KNOWN_DEVICES: &[(&str, &str)] = &[
        ("local", "This Mac"),
        // iPhone - MisfitRebel 17Pro (detected by mobilesafari in Biome)
        ("0E97FD75-40EA-4726-A65C-57545C0B778D", "MisfitRebel 17Pro"),
        // iPhone - same device but different UUID in knowledgeC.db
        ("42255668-8D14-5FA1-883A-854797FDB7D3", "MisfitRebel 17Pro"),
    ];

    for (id, name) in KNOWN_DEVICES {
        if device_id == *id {
            return Some(name);
        }
    }
    None
}

/// Generate display name for device based on type and ID
fn get_device_display_name(device_id: &str, device_type: &str) -> String {
    // Check for known device first
    if let Some(name) = get_known_device_name(device_id) {
        return name.to_string();
    }

    if device_id.is_empty() {
        return "This Mac".to_string();
    }

    // Fall back to type-based name (no UUID snippets)
    match device_type {
        "iphone" => "iPhone".to_string(),
        "ipad" => "iPad".to_string(),
        "ios" => "iOS Device".to_string(),
        "mac" => "Mac".to_string(),
        "misc" => "Other Device".to_string(),
        _ => "Unknown Device".to_string(),
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
        ("com.todesktop.230313mzl4w4u92", "Cursor"),
        ("dev.warp.Warp-Stable", "Warp"),
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
    bundle_id.split('.').last().map(|s| {
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
        (&["com.figma.Desktop", "com.adobe", "com.sketch"], "Design"),
        (
            &[
                "com.apple.finder",
                "com.apple.systempreferences",
                "com.apple.ActivityMonitor",
            ],
            "System",
        ),
        (&["com.anthropic.claudefordesktop", "com.openai.chat"], "AI"),
    ];

    for (ids, category) in categories {
        if ids.iter().any(|id| bundle_id.contains(id)) {
            return Some(category.to_string());
        }
    }

    Some("Other".to_string())
}

// ============================================
// SEGB File Parsing (Biome device data)
// ============================================

/// Record extracted from a SEGB file
#[derive(Debug, Clone)]
struct SegbRecord {
    device_id: String,
    bundle_id: String,
    timestamp: f64, // Mac absolute time
}

/// Parse a single SEGB file and extract records
fn parse_segb_file(file_path: &PathBuf, device_id: &str) -> Vec<SegbRecord> {
    let mut records = Vec::new();

    let data = match fs::read(file_path) {
        Ok(d) => d,
        Err(_) => return records,
    };

    // Verify SEGB magic header
    if data.len() < 32 || &data[0..4] != b"SEGB" {
        return records;
    }

    // SEGB records contain protobuf-like data
    // Each record has: timestamp (8-byte double after 0x21) and bundle_id (after 0x32 + length)
    let mut i = 32; // Skip header

    while i + 40 < data.len() {
        // Look for the pattern: 0x21 followed by 8-byte timestamp, then 0x32 + length + bundle_id
        if i + 12 < data.len() && data[i + 4] == 0x21 {
            // Extract timestamp (8 bytes after 0x21)
            let ts_start = i + 5;
            if ts_start + 8 <= data.len() {
                let ts_bytes: [u8; 8] = data[ts_start..ts_start + 8].try_into().unwrap_or([0; 8]);
                let timestamp = f64::from_le_bytes(ts_bytes);

                // Look for bundle_id after timestamp (0x32 + length byte)
                let bundle_search_start = ts_start + 8;
                if bundle_search_start + 2 < data.len() && data[bundle_search_start] == 0x32 {
                    let bundle_len = data[bundle_search_start + 1] as usize;
                    let bundle_start = bundle_search_start + 2;

                    if bundle_start + bundle_len <= data.len() {
                        if let Ok(bundle_id) = std::str::from_utf8(&data[bundle_start..bundle_start + bundle_len]) {
                            // Clean up bundle_id - remove trailing non-alphanumeric chars
                            let clean_bundle: String = bundle_id
                                .chars()
                                .take_while(|c| c.is_alphanumeric() || *c == '.' || *c == '-' || *c == '_')
                                .collect();

                            if clean_bundle.starts_with("com.") && timestamp > 700000000.0 {
                                records.push(SegbRecord {
                                    device_id: device_id.to_string(),
                                    bundle_id: clean_bundle,
                                    timestamp,
                                });
                            }
                        }
                    }

                    // Move to next record
                    i = bundle_start + bundle_len;
                    continue;
                }
            }
        }
        i += 1;
    }

    records
}

/// Parse all SEGB files for a device directory
fn parse_device_segb_files(device_dir: &PathBuf, device_id: &str, cutoff_timestamp: f64) -> Vec<SegbRecord> {
    let mut all_records = Vec::new();

    let entries = match fs::read_dir(device_dir) {
        Ok(e) => e,
        Err(_) => return all_records,
    };

    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();

        // Skip directories and hidden files
        if path.is_dir() {
            continue;
        }
        if let Some(name) = path.file_name() {
            if name.to_string_lossy().starts_with('.') {
                continue;
            }
        }

        let mut file_records = parse_segb_file(&path, device_id);

        // Filter by cutoff timestamp
        file_records.retain(|r| r.timestamp > cutoff_timestamp);
        all_records.extend(file_records);
    }

    all_records
}

/// Parse all Biome SEGB files (local + remote devices)
fn parse_all_biome_data(cutoff_timestamp: f64) -> Vec<SegbRecord> {
    let mut all_records = Vec::new();

    let biome_path = match get_biome_path() {
        Some(p) => p,
        None => return all_records,
    };

    // Parse local device
    let local_path = biome_path.join("local");
    if local_path.exists() {
        let local_records = parse_device_segb_files(&local_path, "local", cutoff_timestamp);
        all_records.extend(local_records);
    }

    // Parse remote devices
    let remote_path = biome_path.join("remote");
    if remote_path.exists() {
        if let Ok(entries) = fs::read_dir(&remote_path) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.is_dir() {
                    let device_id = path.file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| "unknown".to_string());

                    let device_records = parse_device_segb_files(&path, &device_id, cutoff_timestamp);
                    all_records.extend(device_records);
                }
            }
        }
    }

    all_records
}

/// Calculate duration for SEGB records by looking at time until next record per device
fn calculate_segb_durations(records: &mut Vec<SegbRecord>) -> Vec<(SegbRecord, f64)> {
    const CAP_SECONDS: f64 = 30.0 * 60.0; // Cap at 30 minutes

    // Sort by device_id then timestamp
    records.sort_by(|a, b| {
        (&a.device_id, a.timestamp.partial_cmp(&b.timestamp).unwrap_or(std::cmp::Ordering::Equal))
            .cmp(&(&b.device_id, std::cmp::Ordering::Equal))
    });

    let mut results = Vec::new();

    for i in 0..records.len() {
        let rec = &records[i];
        let duration = if i + 1 < records.len() && records[i + 1].device_id == rec.device_id {
            let delta = records[i + 1].timestamp - rec.timestamp;
            delta.max(0.0).min(CAP_SECONDS)
        } else {
            0.0
        };
        results.push((rec.clone(), duration));
    }

    results
}

// ============================================
// Database Sync Functions
// ============================================

/// Register a device in our database
fn register_device(conn: &Connection, device_id: &str, device_type: &str) -> SqliteResult<()> {
    conn.execute(
        "INSERT OR IGNORE INTO devices (id, name, type) VALUES (?, ?, ?)",
        [device_id, device_id, device_type],
    )?;
    Ok(())
}

/// Export sessions from knowledgeC.db to our database
fn export_knowledge_db_sessions(
    our_conn: &Connection,
    since_timestamp: f64,
) -> Result<(i32, f64), String> {
    let knowledge_db = get_knowledge_db_path()
        .ok_or_else(|| "Could not find knowledgeC.db".to_string())?;

    let source_conn = Connection::open(&knowledge_db)
        .map_err(|e| format!("Failed to open knowledgeC.db: {}", e))?;

    let query = r#"
        SELECT
            ZOBJECT.ZVALUESTRING as bundle_id,
            ZOBJECT.ZSTARTDATE as start_time,
            ZOBJECT.ZENDDATE as end_time,
            (ZOBJECT.ZENDDATE - ZOBJECT.ZSTARTDATE) as duration_seconds,
            ZOBJECT.ZSECONDSFROMGMT as timezone_offset,
            ZOBJECT.ZCREATIONDATE as created_at,
            ZSOURCE.ZDEVICEID as device_id
        FROM ZOBJECT
        LEFT JOIN ZSOURCE ON ZOBJECT.ZSOURCE = ZSOURCE.Z_PK
        WHERE ZOBJECT.ZSTREAMNAME = '/app/usage'
            AND ZOBJECT.ZVALUESTRING IS NOT NULL
            AND ZOBJECT.ZSTARTDATE IS NOT NULL
            AND ZOBJECT.ZENDDATE IS NOT NULL
            AND ZOBJECT.ZSTARTDATE > ?
        ORDER BY ZOBJECT.ZSTARTDATE ASC
    "#;

    let mut stmt = source_conn
        .prepare(query)
        .map_err(|e| format!("Query prepare error: {}", e))?;

    let rows = stmt
        .query_map([since_timestamp], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, f64>(1)?,
                row.get::<_, f64>(2)?,
                row.get::<_, f64>(3)?,
                row.get::<_, Option<i32>>(4)?,
                row.get::<_, Option<f64>>(5)?,
                row.get::<_, Option<String>>(6)?,
            ))
        })
        .map_err(|e| format!("Query error: {}", e))?;

    let mut inserted = 0;
    let mut new_last_timestamp = since_timestamp;

    for row in rows.filter_map(|r| r.ok()) {
        let (bundle_id, start_mac, end_mac, duration, tz_offset, created_mac, device_id) = row;

        // Skip invalid durations
        if duration <= 0.0 || duration > 86400.0 {
            continue;
        }

        let app_name = get_app_name(&bundle_id).unwrap_or_else(|| bundle_id.clone());

        // Skip system events (SleepLockScreen, Home-screen-open-folder, etc.)
        if is_system_event(&bundle_id, Some(&app_name)) {
            continue;
        }

        let device_id = device_id.unwrap_or_else(|| "local".to_string());
        let device_id = if device_id.is_empty() { "local".to_string() } else { device_id };

        let device_type = infer_device_type(&device_id);
        register_device(our_conn, &device_id, device_type).ok();

        let category = get_category(&bundle_id).unwrap_or_else(|| "Other".to_string());

        // Convert Mac timestamps to ISO datetime strings
        let start_datetime = mac_timestamp_to_datetime(start_mac);
        let end_datetime = mac_timestamp_to_datetime(end_mac);
        let created_datetime = created_mac.map(mac_timestamp_to_datetime);

        our_conn.execute(
            "INSERT INTO sessions (device_id, bundle_id, app_name, category, start_time, end_time, duration_seconds, timezone_offset, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            rusqlite::params![
                device_id,
                bundle_id,
                app_name,
                category,
                start_datetime,
                end_datetime,
                duration,
                tz_offset,
                created_datetime,
            ],
        ).ok();

        inserted += 1;
        new_last_timestamp = new_last_timestamp.max(end_mac);
    }

    Ok((inserted, new_last_timestamp))
}

/// Convert Mac timestamp to ISO datetime string
fn mac_timestamp_to_datetime(mac_ts: f64) -> String {
    let unix_ts = mac_ts + MAC_EPOCH_OFFSET as f64;
    chrono::DateTime::from_timestamp(unix_ts as i64, 0)
        .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
        .unwrap_or_default()
}

/// Export Biome SEGB records to our database
fn export_biome_records(
    our_conn: &Connection,
    since_timestamp: f64,
) -> Result<i32, String> {
    let mut records = parse_all_biome_data(since_timestamp);
    let records_with_duration = calculate_segb_durations(&mut records);

    // Get local timezone offset in seconds (e.g., -10800 for UTC-3)
    let local_tz_offset = chrono::Local::now().offset().local_minus_utc();

    let mut inserted = 0;

    for (record, duration) in records_with_duration {
        let app_name = get_app_name(&record.bundle_id).unwrap_or_else(|| record.bundle_id.clone());

        // Skip system events (SleepLockScreen, Home-screen-open-folder, etc.)
        if is_system_event(&record.bundle_id, Some(&app_name)) {
            continue;
        }

        let device_type = if record.device_id == "local" {
            "current_mac"
        } else {
            infer_device_type(&record.device_id)
        };

        register_device(our_conn, &record.device_id, device_type).ok();

        let category = get_category(&record.bundle_id).unwrap_or_else(|| "Other".to_string());

        let datetime = mac_timestamp_to_datetime(record.timestamp);

        our_conn.execute(
            "INSERT INTO sessions (device_id, bundle_id, app_name, category, start_time, end_time, duration_seconds, timezone_offset, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            rusqlite::params![
                record.device_id,
                record.bundle_id,
                app_name,
                category,
                &datetime,
                &datetime,
                duration,
                local_tz_offset,
                &datetime,
            ],
        ).ok();

        inserted += 1;
    }

    Ok(inserted)
}

/// Generate daily summary from sessions
/// Uses timezone_offset to calculate local dates (not UTC dates)
fn generate_daily_summary(conn: &Connection) -> Result<i32, String> {
    // Clear existing summary
    conn.execute("DELETE FROM daily_summary", [])
        .map_err(|e| format!("Failed to clear daily_summary: {}", e))?;

    // Generate aggregated data per date & device
    // IMPORTANT: Use timezone_offset to convert UTC to local date
    // timezone_offset is seconds from GMT (e.g., -10800 for UTC-3 Buenos Aires)
    // To get local time: local = UTC + offset_seconds
    conn.execute(
        r#"
        INSERT INTO daily_summary (date, device_id, bundle_id, app_name, category, total_duration_seconds, session_count)
        SELECT
            DATE(DATETIME(start_time, printf('%+d seconds', COALESCE(timezone_offset, 0)))) as date,
            device_id,
            bundle_id,
            app_name,
            category,
            SUM(duration_seconds) as total_duration_seconds,
            COUNT(*) as session_count
        FROM sessions
        GROUP BY DATE(DATETIME(start_time, printf('%+d seconds', COALESCE(timezone_offset, 0)))), device_id, bundle_id, app_name, category
        ORDER BY date DESC, total_duration_seconds DESC
        "#,
        [],
    )
    .map_err(|e| format!("Failed to generate daily_summary: {}", e))?;

    let count: i32 = conn
        .query_row("SELECT COUNT(*) FROM daily_summary", [], |row| row.get(0))
        .unwrap_or(0);

    Ok(count)
}

/// Main sync command - exports data from system DBs to our DB
#[command]
pub async fn sync_screentime_to_local_db() -> Result<SyncResult, String> {
    if !check_full_disk_access() {
        return Err("Full Disk Access permission required".to_string());
    }

    let db_path = get_app_screentime_db_path()
        .ok_or_else(|| "Could not determine app data directory".to_string())?;

    // Initialize database schema
    init_screentime_database(&db_path)
        .map_err(|e| format!("Failed to initialize database: {}", e))?;

    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Get last sync timestamp
    let last_timestamp: f64 = conn
        .query_row(
            "SELECT last_sync_timestamp FROM sync_metadata WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    // Calculate cutoff (default to 30 days ago if first sync)
    let cutoff = if last_timestamp > 0.0 {
        last_timestamp
    } else {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs_f64();
        let thirty_days_ago = now - (30.0 * 24.0 * 60.0 * 60.0);
        thirty_days_ago - MAC_EPOCH_OFFSET as f64
    };

    // Export from knowledgeC.db
    let (knowledge_count, new_timestamp) = export_knowledge_db_sessions(&conn, cutoff)?;

    // Export from Biome SEGB files
    let biome_count = export_biome_records(&conn, cutoff)?;

    // Generate daily summary
    let summary_count = generate_daily_summary(&conn)?;

    // Update sync timestamp
    if new_timestamp > last_timestamp {
        conn.execute(
            "UPDATE sync_metadata SET last_sync_timestamp = ?, last_sync_at = CURRENT_TIMESTAMP WHERE id = 1",
            [new_timestamp],
        ).ok();
    }

    Ok(SyncResult {
        knowledge_sessions: knowledge_count,
        biome_sessions: biome_count,
        daily_summaries: summary_count,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncResult {
    pub knowledge_sessions: i32,
    pub biome_sessions: i32,
    pub daily_summaries: i32,
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
        since_clause, device_clause
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
                // Skip system events (SleepLockScreen, Home-screen-open-folder, etc.)
                if is_system_event(&s.bundle_id, s.app_name.as_deref()) {
                    continue;
                }
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

    let db_path =
        get_knowledge_db_path().ok_or_else(|| "Could not determine home directory".to_string())?;

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
    gethostname::gethostname().to_str().map(|s| s.to_string())
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
                display_name: get_device_display_name("local", "mac"),
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

                    // Only include devices with known names
                    if get_known_device_name(&device_id).is_none() {
                        continue;
                    }

                    // Get bundle IDs from Biome files to determine device type
                    let bundle_ids = get_device_bundle_ids_from_biome(&device_id);
                    let device_type = infer_device_type_with_apps(&device_id, &bundle_ids);
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

/// List all devices with screen time data from screentime-viewer's database
#[command]
pub async fn list_screentime_devices() -> Result<Vec<DeviceInfo>, String> {
    // Check permission first (still needed for other operations)
    if !check_full_disk_access() {
        return Err("Full Disk Access permission required".to_string());
    }

    // Try to use screentime-viewer's database first (has device-specific data)
    if let Some(stv_db_path) = get_app_screentime_db_path() {
        if let Ok(conn) = Connection::open(&stv_db_path) {
            // Query devices with their bundle IDs for type detection
            let query = r#"
                SELECT
                    d.id as device_id,
                    d.type as device_type,
                    COUNT(DISTINCT s.id) as session_count,
                    GROUP_CONCAT(DISTINCT s.bundle_id) as bundle_ids
                FROM devices d
                LEFT JOIN sessions s ON s.device_id = d.id
                GROUP BY d.id
                ORDER BY session_count DESC
            "#;

            if let Ok(mut stmt) = conn.prepare(query) {
                let mut devices: Vec<DeviceInfo> = Vec::new();

                let rows = stmt.query_map([], |row| {
                    let device_id: String = row.get(0)?;
                    let raw_type: String = row.get::<_, String>(1).unwrap_or_default();
                    let session_count: i32 = row.get(2)?;
                    let bundle_ids_str: Option<String> = row.get(3).ok();
                    Ok((device_id, raw_type, session_count, bundle_ids_str))
                });

                if let Ok(rows) = rows {
                    for row in rows.filter_map(|r| r.ok()) {
                        let (device_id, raw_type, session_count, bundle_ids_str) = row;

                        // Parse bundle IDs and detect device type
                        let bundle_ids: Vec<String> = bundle_ids_str
                            .unwrap_or_default()
                            .split(',')
                            .map(|s| s.to_string())
                            .collect();

                        // Infer type using bundle IDs (more accurate than UDID patterns)
                        // But only for devices with enough sessions to be "real"
                        let device_type = if session_count < REAL_DEVICE_SESSION_THRESHOLD
                            && device_id != "local"
                            && raw_type != "current_mac"
                        {
                            // Low session count = misc device (old phone, temp device, etc.)
                            "misc"
                        } else if raw_type == "current_mac" || device_id == "local" {
                            "mac"
                        } else if let Some(detected) = detect_device_type_from_apps(&bundle_ids) {
                            detected
                        } else {
                            infer_device_type(&device_id)
                        };

                        // Skip "unknown" device - it's merged with "local" (This Mac)
                        if device_id == "unknown" {
                            continue;
                        }

                        // Skip "misc" devices unless they have a known name
                        if device_type == "misc" && get_known_device_name(&device_id).is_none() {
                            continue;
                        }

                        let display_name = get_device_display_name(&device_id, device_type);

                        devices.push(DeviceInfo {
                            device_id,
                            device_type: device_type.to_string(),
                            display_name,
                            session_count,
                        });
                    }
                }

                // Merge "unknown" session count into "local" device
                if let Ok(unknown_count) = conn.query_row::<i32, _, _>(
                    "SELECT COUNT(*) FROM sessions WHERE device_id = 'unknown'",
                    [],
                    |row| row.get(0),
                ) {
                    if let Some(local_device) = devices.iter_mut().find(|d| d.device_id == "local")
                    {
                        local_device.session_count += unknown_count;
                    }
                }

                if !devices.is_empty() {
                    // Sort by session count descending
                    devices.sort_by(|a, b| b.session_count.cmp(&a.session_count));
                    return Ok(devices);
                }
            }
        }
    }

    // Fallback: enumerate from Biome directories if screentime.db not available
    let biome_devices = enumerate_biome_devices();
    if !biome_devices.is_empty() {
        return Ok(biome_devices);
    }

    // Last resort: return local device from knowledgeC.db
    let mut devices = Vec::new();
    if let Some(db_path) = get_knowledge_db_path() {
        if let Ok(conn) = Connection::open(&db_path) {
            if let Ok(count) = conn.query_row::<i32, _, _>(
                "SELECT COUNT(*) FROM ZOBJECT WHERE ZSTREAMNAME = '/app/usage'",
                [],
                |row| row.get(0),
            ) {
                devices.push(DeviceInfo {
                    device_id: "local".to_string(),
                    device_type: "mac".to_string(),
                    display_name: "This Mac".to_string(),
                    session_count: count,
                });
            }
        }
    }

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
/// Uses screentime-viewer's database for device-specific data
#[command]
pub async fn get_screentime_daily_stats(
    date: String, // YYYY-MM-DD format
    device_id: Option<String>,
) -> Result<Option<DailyStats>, String> {
    if !check_full_disk_access() {
        return Err("Full Disk Access permission required".to_string());
    }

    // Try screentime-viewer's database first (has device-specific data)
    if let Some(stv_db_path) = get_app_screentime_db_path() {
        if let Ok(conn) = Connection::open(&stv_db_path) {
            // Build device filter - merge Mac devices (local + unknown) when querying for This Mac
            let is_mac_query = device_id.is_none()
                || device_id.as_ref().map(|id| id == "local").unwrap_or(false);

            // Query from daily_summary table
            // For Mac, merge 'local' and 'unknown' devices together
            let query = if is_mac_query {
                r#"
                SELECT
                    bundle_id,
                    app_name,
                    category,
                    SUM(total_duration_seconds) as total_duration_seconds,
                    SUM(session_count) as session_count
                FROM daily_summary
                WHERE date = ?
                AND device_id IN ('local', 'unknown')
                GROUP BY bundle_id
                ORDER BY total_duration_seconds DESC
                "#
            } else {
                r#"
                SELECT
                    bundle_id,
                    app_name,
                    category,
                    total_duration_seconds,
                    session_count
                FROM daily_summary
                WHERE date = ?
                AND device_id = ?
                ORDER BY total_duration_seconds DESC
                "#
            };

            if let Ok(mut stmt) = conn.prepare(query) {
                let mut app_usage: Vec<AppUsageStat> = Vec::new();
                let mut category_map: std::collections::HashMap<String, i64> =
                    std::collections::HashMap::new();
                let mut total_seconds: i64 = 0;

                // Different query execution based on Mac vs specific device
                let rows: Result<Vec<_>, _> = if is_mac_query {
                    stmt.query_map([&date], |row| {
                        let bundle_id: String = row.get(0)?;
                        let app_name: String = row.get(1)?;
                        let category: String = row.get(2)?;
                        let seconds: f64 = row.get(3)?;
                        let session_count: i32 = row.get(4)?;
                        Ok((bundle_id, app_name, category, seconds as i64, session_count))
                    })
                    .map(|iter| iter.filter_map(|r| r.ok()).collect())
                } else {
                    let device_filter = device_id.as_ref().map(|id| id.as_str()).unwrap_or("local");
                    stmt.query_map([&date, device_filter], |row| {
                        let bundle_id: String = row.get(0)?;
                        let app_name: String = row.get(1)?;
                        let category: String = row.get(2)?;
                        let seconds: f64 = row.get(3)?;
                        let session_count: i32 = row.get(4)?;
                        Ok((bundle_id, app_name, category, seconds as i64, session_count))
                    })
                    .map(|iter| iter.filter_map(|r| r.ok()).collect())
                };

                let rows = rows.unwrap_or_default();

                for (bundle_id, app_name, category, seconds, session_count) in rows {
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

                if !app_usage.is_empty() {
                    let mut category_usage: Vec<CategoryUsageStat> = category_map
                        .into_iter()
                        .map(|(category, seconds)| CategoryUsageStat { category, seconds })
                        .collect();
                    category_usage.sort_by(|a, b| b.seconds.cmp(&a.seconds));

                    return Ok(Some(DailyStats {
                        date,
                        total_seconds,
                        app_usage,
                        category_usage,
                        device_id,
                    }));
                }
            }
        }
    }

    // Fallback to knowledgeC.db (no device filtering - all data is local)
    let db_path =
        get_knowledge_db_path().ok_or_else(|| "Could not determine home directory".to_string())?;

    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    // Parse date to get Mac epoch range
    let date_start = format!("{} 00:00:00", date);
    let date_end = format!("{} 23:59:59", date);

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

    let query = format!(
        r#"
        SELECT
            ZOBJECT.ZVALUESTRING as bundle_id,
            SUM(ZOBJECT.ZENDDATE - ZOBJECT.ZSTARTDATE) as total_seconds,
            COUNT(*) as session_count
        FROM ZOBJECT
        WHERE ZOBJECT.ZSTREAMNAME = '/app/usage'
        AND ZOBJECT.ZVALUESTRING IS NOT NULL
        AND ZOBJECT.ZSTARTDATE >= {}
        AND ZOBJECT.ZSTARTDATE <= {}
        AND (ZOBJECT.ZENDDATE - ZOBJECT.ZSTARTDATE) >= 5
        AND (ZOBJECT.ZENDDATE - ZOBJECT.ZSTARTDATE) < 86400
        GROUP BY ZOBJECT.ZVALUESTRING
        ORDER BY total_seconds DESC
        "#,
        start_mac, end_mac
    );

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let mut app_usage: Vec<AppUsageStat> = Vec::new();
    let mut category_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    let mut total_seconds: i64 = 0;

    let rows = stmt
        .query_map([], |row| {
            let bundle_id: String = row.get(0)?;
            let seconds: f64 = row.get(1)?;
            let session_count: i32 = row.get(2)?;
            Ok((bundle_id, seconds as i64, session_count))
        })
        .map_err(|e| format!("Query error: {}", e))?;

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
/// Uses screentime-viewer's database for device-specific data
#[command]
pub async fn get_screentime_recent_summaries(
    days: i32,
    device_id: Option<String>,
) -> Result<Vec<DailySummaryEntry>, String> {
    if !check_full_disk_access() {
        return Err("Full Disk Access permission required".to_string());
    }

    // Calculate cutoff date
    let cutoff_date = (chrono::Utc::now() - chrono::Duration::days(days as i64))
        .format("%Y-%m-%d")
        .to_string();

    // Try screentime-viewer's database first (has device-specific data)
    if let Some(stv_db_path) = get_app_screentime_db_path() {
        if let Ok(conn) = Connection::open(&stv_db_path) {
            // Merge Mac devices (local + unknown) when querying for This Mac
            let is_mac_query = device_id.is_none()
                || device_id.as_ref().map(|id| id == "local").unwrap_or(false);

            // Query aggregated daily totals from daily_summary
            let query = if is_mac_query {
                r#"
                SELECT
                    date,
                    SUM(total_duration_seconds) as total_seconds
                FROM daily_summary
                WHERE device_id IN ('local', 'unknown')
                AND date >= ?
                GROUP BY date
                ORDER BY date DESC
                "#
            } else {
                r#"
                SELECT
                    date,
                    SUM(total_duration_seconds) as total_seconds
                FROM daily_summary
                WHERE device_id = ?
                AND date >= ?
                GROUP BY date
                ORDER BY date DESC
                "#
            };

            if let Ok(mut stmt) = conn.prepare(query) {
                let summaries: Vec<DailySummaryEntry> = if is_mac_query {
                    stmt.query_map([&cutoff_date], |row| {
                        let date: String = row.get(0)?;
                        let total_seconds: f64 = row.get(1)?;
                        Ok(DailySummaryEntry {
                            date,
                            total_seconds: total_seconds as i64,
                        })
                    })
                    .map(|iter| iter.filter_map(|r| r.ok()).collect())
                    .unwrap_or_default()
                } else {
                    let device_filter = device_id.as_ref().map(|id| id.as_str()).unwrap_or("local");
                    stmt.query_map([device_filter, &cutoff_date], |row| {
                        let date: String = row.get(0)?;
                        let total_seconds: f64 = row.get(1)?;
                        Ok(DailySummaryEntry {
                            date,
                            total_seconds: total_seconds as i64,
                        })
                    })
                    .map(|iter| iter.filter_map(|r| r.ok()).collect())
                    .unwrap_or_default()
                };

                if !summaries.is_empty() {
                    return Ok(summaries);
                }
            }
        }
    }

    // Fallback to knowledgeC.db (no device filtering)
    let db_path =
        get_knowledge_db_path().ok_or_else(|| "Could not determine home directory".to_string())?;

    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    let cutoff = chrono::Utc::now() - chrono::Duration::days(days as i64);
    let cutoff_mac = cutoff.timestamp() as f64 - MAC_EPOCH_OFFSET as f64;

    let query = format!(
        r#"
        SELECT
            DATE(DATETIME(ZOBJECT.ZSTARTDATE + {}, 'unixepoch')) as date,
            SUM(ZOBJECT.ZENDDATE - ZOBJECT.ZSTARTDATE) as total_seconds
        FROM ZOBJECT
        WHERE ZOBJECT.ZSTREAMNAME = '/app/usage'
        AND ZOBJECT.ZVALUESTRING IS NOT NULL
        AND ZOBJECT.ZSTARTDATE >= {}
        AND (ZOBJECT.ZENDDATE - ZOBJECT.ZSTARTDATE) >= 5
        AND (ZOBJECT.ZENDDATE - ZOBJECT.ZSTARTDATE) < 86400
        GROUP BY DATE(DATETIME(ZOBJECT.ZSTARTDATE + {}, 'unixepoch'))
        ORDER BY date DESC
        "#,
        MAC_EPOCH_OFFSET, cutoff_mac, MAC_EPOCH_OFFSET
    );

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let summaries: Vec<DailySummaryEntry> = stmt
        .query_map([], |row| {
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
