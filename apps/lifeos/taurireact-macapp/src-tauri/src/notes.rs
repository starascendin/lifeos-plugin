// Apple Notes export module
// Uses AppleScript to extract notes and saves to SQLite + Markdown files

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::{command, AppHandle, Emitter};

// AppleScript to count all notes
const COUNT_SCRIPT: &str = r#"
tell application "Notes"
    set noteCount to count of notes
end tell
log noteCount
"#;

// AppleScript to extract folders
const FOLDERS_SCRIPT: &str = r#"
tell application "Notes"
    set allFolders to folders
    repeat with aFolder in allFolders
        set folderId to id of aFolder
        set folderName to name of aFolder
        set folderContainer to container of aFolder
        if class of folderContainer is folder then
            set folderContainerId to id of folderContainer
        else
            set folderContainerId to ""
        end if
        log "long_id: " & folderId
        log "name: " & folderName
        log "parent: " & folderContainerId
        log "==="
    end repeat
end tell
"#;

// AppleScript to extract all notes (full export)
const EXTRACT_SCRIPT_FULL: &str = r#"
tell application "Notes"
   repeat with eachNote in every note
      set noteId to the id of eachNote
      set noteTitle to the name of eachNote
      set noteBody to the body of eachNote
      set noteCreatedDate to the creation date of eachNote
      set noteCreated to (noteCreatedDate as «class isot» as string)
      set noteUpdatedDate to the modification date of eachNote
      set noteUpdated to (noteUpdatedDate as «class isot» as string)
      set noteContainer to container of eachNote
      set noteFolderId to the id of noteContainer
      log "{split}-id: " & noteId & "\n"
      log "{split}-created: " & noteCreated & "\n"
      log "{split}-updated: " & noteUpdated & "\n"
      log "{split}-folder: " & noteFolderId & "\n"
      log "{split}-title: " & noteTitle & "\n\n"
      log noteBody & "\n"
      log "{split}{split}" & "\n"
   end repeat
end tell
"#;

// Generate AppleScript for extracting notes from the last N days
fn get_extract_script_days(days: i32) -> String {
    format!(
        r#"
set cutoffDate to (current date) - ({days} * days)
tell application "Notes"
   set recentNotes to every note whose modification date is greater than cutoffDate
   repeat with eachNote in recentNotes
      set noteId to the id of eachNote
      set noteTitle to the name of eachNote
      set noteBody to the body of eachNote
      set noteCreatedDate to the creation date of eachNote
      set noteCreated to (noteCreatedDate as «class isot» as string)
      set noteUpdatedDate to the modification date of eachNote
      set noteUpdated to (noteUpdatedDate as «class isot» as string)
      set noteContainer to container of eachNote
      set noteFolderId to the id of noteContainer
      log "{{split}}-id: " & noteId & "\n"
      log "{{split}}-created: " & noteCreated & "\n"
      log "{{split}}-updated: " & noteUpdated & "\n"
      log "{{split}}-folder: " & noteFolderId & "\n"
      log "{{split}}-title: " & noteTitle & "\n\n"
      log noteBody & "\n"
      log "{{split}}{{split}}" & "\n"
   end repeat
end tell
"#,
        days = days
    )
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppleNote {
    pub id: String,
    pub title: String,
    pub body: String,
    pub created: String,
    pub updated: String,
    pub folder_id: Option<i64>,
    pub folder_long_id: String,
    pub markdown_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppleFolder {
    pub id: i64,
    pub long_id: String,
    pub name: String,
    pub parent_id: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NotesExportResult {
    pub total_count: i32,
    pub exported_count: i32,
    pub skipped_count: i32,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NotesExportProgress {
    pub current: i32,
    pub total: i32,
    pub exported: i32,
    pub skipped: i32,
    pub current_title: String,
    pub status: String,
}

/// Get the bundle identifier based on build mode
/// Uses TAURI_BUILD_MODE env var to determine environment-specific paths
fn get_bundle_id() -> &'static str {
    match option_env!("TAURI_BUILD_MODE") {
        Some("production") => "com.bryanliu.lifeos-nexus",
        Some("staging") => "com.bryanliu.lifeos-nexus-staging",
        _ => "com.bryanliu.lifeos-nexus-dev", // dev (default)
    }
}

/// Get the app data directory for notes storage
fn get_notes_data_dir() -> Option<PathBuf> {
    dirs::home_dir()
        .map(|home| home.join(format!("Library/Application Support/{}/notes", get_bundle_id())))
}

/// Get the SQLite database path
fn get_notes_db_path() -> Option<PathBuf> {
    dirs::home_dir()
        .map(|home| home.join(format!("Library/Application Support/{}/notes.db", get_bundle_id())))
}

/// Initialize the SQLite database schema
fn init_database(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            long_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            parent_id INTEGER REFERENCES folders(id)
        )",
        [],
    )
    .map_err(|e| format!("Failed to create folders table: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_folders_long_id ON folders(long_id)",
        [],
    )
    .map_err(|e| format!("Failed to create folders index: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            created TEXT NOT NULL,
            updated TEXT NOT NULL,
            folder_id INTEGER REFERENCES folders(id),
            title TEXT NOT NULL,
            body TEXT,
            markdown_path TEXT
        )",
        [],
    )
    .map_err(|e| format!("Failed to create notes table: {}", e))?;

    Ok(())
}

/// Execute an AppleScript and return stdout
fn execute_applescript(script: &str) -> Result<String, String> {
    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| format!("Failed to execute osascript: {}", e))?;

    // AppleScript logs to stderr
    let result = String::from_utf8_lossy(&output.stderr).to_string();
    Ok(result)
}

/// Execute AppleScript and stream output line by line
fn execute_applescript_streaming(script: &str) -> Result<impl Iterator<Item = String>, String> {
    let mut child = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn osascript: {}", e))?;

    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
    let reader = BufReader::new(stderr);

    Ok(reader.lines().map_while(Result::ok))
}

/// Extract folders from AppleScript output
fn extract_folders() -> Result<Vec<RawFolder>, String> {
    let output = execute_applescript(FOLDERS_SCRIPT)?;
    let mut folders = Vec::new();
    let mut current_folder: HashMap<String, String> = HashMap::new();

    for line in output.lines() {
        let line = line.trim();
        if line == "===" {
            if !current_folder.is_empty() {
                folders.push(RawFolder {
                    long_id: current_folder.get("long_id").cloned().unwrap_or_default(),
                    name: current_folder.get("name").cloned().unwrap_or_default(),
                    parent: current_folder
                        .get("parent")
                        .cloned()
                        .filter(|s| !s.is_empty()),
                });
                current_folder.clear();
            }
        } else {
            for key in &["long_id", "name", "parent"] {
                let prefix = format!("{}: ", key);
                if line.starts_with(&prefix) {
                    let value = line[prefix.len()..].to_string();
                    current_folder.insert(key.to_string(), value);
                }
            }
        }
    }

    Ok(folders)
}

#[derive(Debug, Clone)]
struct RawFolder {
    long_id: String,
    name: String,
    parent: Option<String>,
}

/// Topological sort folders by parent hierarchy
fn topological_sort(nodes: Vec<RawFolder>) -> Vec<RawFolder> {
    let mut children: HashMap<String, Vec<RawFolder>> = HashMap::new();

    for node in &nodes {
        if let Some(parent_id) = &node.parent {
            children
                .entry(parent_id.clone())
                .or_default()
                .push(node.clone());
        }
    }

    fn traverse(
        node: RawFolder,
        children: &HashMap<String, Vec<RawFolder>>,
        result: &mut Vec<RawFolder>,
    ) {
        let long_id = node.long_id.clone();
        result.push(node);
        if let Some(node_children) = children.get(&long_id) {
            for child in node_children {
                traverse(child.clone(), children, result);
            }
        }
    }

    let mut sorted = Vec::new();
    for node in nodes {
        if node.parent.is_none() {
            traverse(node, &children, &mut sorted);
        }
    }

    sorted
}

/// Convert HTML to simple markdown (basic conversion)
fn convert_html_to_markdown(html: &str) -> String {
    let mut result = html.to_string();

    // Handle multiple consecutive h1 tags by combining them
    let h1_pattern = regex::Regex::new(r"(?i)(<h1[^>]*>([^<]+)</h1>\s*)+").unwrap();
    result = h1_pattern
        .replace_all(&result, |caps: &regex::Captures| {
            let h1_inner = regex::Regex::new(r"(?i)<h1[^>]*>([^<]+)</h1>").unwrap();
            let headers: Vec<String> = h1_inner
                .captures_iter(&caps[0])
                .filter_map(|c| c.get(1).map(|m| m.as_str().trim().to_string()))
                .collect();
            format!("<h1>{}</h1>", headers.join(" "))
        })
        .to_string();

    // Basic HTML to Markdown conversions
    // Headers
    result = regex::Regex::new(r"(?i)<h1[^>]*>([^<]*)</h1>")
        .unwrap()
        .replace_all(&result, "# $1\n")
        .to_string();
    result = regex::Regex::new(r"(?i)<h2[^>]*>([^<]*)</h2>")
        .unwrap()
        .replace_all(&result, "## $1\n")
        .to_string();
    result = regex::Regex::new(r"(?i)<h3[^>]*>([^<]*)</h3>")
        .unwrap()
        .replace_all(&result, "### $1\n")
        .to_string();

    // Bold and italic
    result = regex::Regex::new(r"(?i)<b>([^<]*)</b>")
        .unwrap()
        .replace_all(&result, "**$1**")
        .to_string();
    result = regex::Regex::new(r"(?i)<strong>([^<]*)</strong>")
        .unwrap()
        .replace_all(&result, "**$1**")
        .to_string();
    result = regex::Regex::new(r"(?i)<i>([^<]*)</i>")
        .unwrap()
        .replace_all(&result, "*$1*")
        .to_string();
    result = regex::Regex::new(r"(?i)<em>([^<]*)</em>")
        .unwrap()
        .replace_all(&result, "*$1*")
        .to_string();

    // Links
    result = regex::Regex::new(r#"(?i)<a[^>]*href="([^"]*)"[^>]*>([^<]*)</a>"#)
        .unwrap()
        .replace_all(&result, "[$2]($1)")
        .to_string();

    // Lists
    result = regex::Regex::new(r"(?i)<li[^>]*>([^<]*)</li>")
        .unwrap()
        .replace_all(&result, "- $1\n")
        .to_string();

    // Line breaks and paragraphs
    result = regex::Regex::new(r"(?i)<br\s*/?>")
        .unwrap()
        .replace_all(&result, "\n")
        .to_string();
    result = regex::Regex::new(r"(?i)</p>")
        .unwrap()
        .replace_all(&result, "\n\n")
        .to_string();
    result = regex::Regex::new(r"(?i)<p[^>]*>")
        .unwrap()
        .replace_all(&result, "")
        .to_string();

    // Remove images (ignore them)
    result = regex::Regex::new(r"(?i)<img[^>]*>")
        .unwrap()
        .replace_all(&result, "")
        .to_string();

    // Remove remaining HTML tags
    result = regex::Regex::new(r"<[^>]+>")
        .unwrap()
        .replace_all(&result, "")
        .to_string();

    // Decode HTML entities
    result = result.replace("&amp;", "&");
    result = result.replace("&lt;", "<");
    result = result.replace("&gt;", ">");
    result = result.replace("&quot;", "\"");
    result = result.replace("&nbsp;", " ");
    result = result.replace("&#39;", "'");

    // Clean up multiple newlines
    result = regex::Regex::new(r"\n{3,}")
        .unwrap()
        .replace_all(&result, "\n\n")
        .to_string();

    result.trim().to_string()
}

/// Create a safe filename from title
fn create_safe_filename(title: &str) -> String {
    // Normalize and keep only ASCII alphanumeric, space, dash, underscore
    let safe: String = title
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == ' ' || *c == '-' || *c == '_')
        .collect();
    let safe = safe.trim().replace(' ', "-");

    if safe.is_empty() {
        "untitled-note".to_string()
    } else {
        // Limit filename length
        if safe.len() > 50 {
            safe[..50].to_string()
        } else {
            safe
        }
    }
}

/// Create a markdown file for a note
fn create_markdown_file(
    note: &AppleNote,
    output_dir: &Path,
    folder_name: &str,
) -> Result<PathBuf, String> {
    let folder_path = output_dir.join(folder_name);
    fs::create_dir_all(&folder_path)
        .map_err(|e| format!("Failed to create folder {}: {}", folder_path.display(), e))?;

    let safe_title = create_safe_filename(&note.title);

    // Extract date prefix from created timestamp (format: YYYYMMDD)
    let date_prefix = if note.created.len() >= 10 {
        note.created[..10].replace("-", "").replace("T", "")
    } else {
        "00000000".to_string()
    };
    let date_prefix = &date_prefix[..8.min(date_prefix.len())];

    let filename = format!("{}-{}.md", date_prefix, safe_title);
    let filepath = folder_path.join(&filename);

    let markdown_content = convert_html_to_markdown(&note.body);
    fs::write(&filepath, &markdown_content)
        .map_err(|e| format!("Failed to write markdown file: {}", e))?;

    Ok(filepath)
}

/// Count total notes in Apple Notes
#[command]
pub fn count_apple_notes() -> Result<i32, String> {
    let output = execute_applescript(COUNT_SCRIPT)?;
    let count: i32 = output
        .trim()
        .parse()
        .map_err(|e| format!("Failed to parse note count: {}", e))?;
    Ok(count)
}

/// Export Apple Notes to local storage
#[command]
pub async fn export_apple_notes(
    app: AppHandle,
    days: Option<i32>,
) -> Result<NotesExportResult, String> {
    // Ensure data directory exists
    let data_dir =
        get_notes_data_dir().ok_or_else(|| "Could not determine app data directory".to_string())?;
    fs::create_dir_all(&data_dir).map_err(|e| format!("Failed to create data directory: {}", e))?;

    // Initialize database
    let db_path =
        get_notes_db_path().ok_or_else(|| "Could not determine database path".to_string())?;

    // Ensure parent directory exists
    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create database directory: {}", e))?;
    }

    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;
    init_database(&conn)?;

    // Process folders first
    let raw_folders = extract_folders()?;
    let sorted_folders = topological_sort(raw_folders);

    let mut folder_long_ids_to_id: HashMap<String, i64> = HashMap::new();
    let mut folder_ids_to_names: HashMap<i64, String> = HashMap::new();

    for folder in sorted_folders {
        let parent_id = folder
            .parent
            .as_ref()
            .and_then(|p| folder_long_ids_to_id.get(p).copied());

        // Use INSERT ... ON CONFLICT to preserve existing row IDs (prevents FOREIGN KEY errors)
        conn.execute(
            "INSERT INTO folders (long_id, name, parent_id) VALUES (?1, ?2, ?3)
             ON CONFLICT(long_id) DO UPDATE SET name = excluded.name, parent_id = excluded.parent_id",
            params![folder.long_id, folder.name, parent_id],
        )
        .map_err(|e| format!("Failed to insert folder: {}", e))?;

        // Get the actual ID (either newly inserted or existing)
        let id: i64 = conn
            .query_row(
                "SELECT id FROM folders WHERE long_id = ?1",
                params![folder.long_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to get folder id: {}", e))?;

        folder_long_ids_to_id.insert(folder.long_id.clone(), id);
        folder_ids_to_names.insert(id, folder.name.clone());
    }

    // Get existing notes for comparison
    let mut existing_notes: HashMap<String, String> = HashMap::new();
    {
        let mut stmt = conn
            .prepare("SELECT id, updated FROM notes")
            .map_err(|e| format!("Failed to prepare query: {}", e))?;
        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| format!("Failed to query existing notes: {}", e))?;

        for (id, updated) in rows.flatten() {
            existing_notes.insert(id, updated);
        }
    }

    // Generate split token
    let split: String = (0..16)
        .map(|_| format!("{:x}", rand::random::<u8>() % 16))
        .collect();

    // Choose script based on days parameter
    let script = match days {
        Some(d) => get_extract_script_days(d).replace("{split}", &split),
        None => EXTRACT_SCRIPT_FULL.replace("{split}", &split),
    };

    // Process notes
    let total_count = count_apple_notes().unwrap_or(0);
    let mut exported_count = 0;
    let mut skipped_count = 0;
    let mut processed_count = 0;

    // Emit initial progress
    let _ = app.emit(
        "notes-export-progress",
        NotesExportProgress {
            current: 0,
            total: total_count,
            exported: 0,
            skipped: 0,
            current_title: "Starting export...".to_string(),
            status: "extracting".to_string(),
        },
    );

    let lines = execute_applescript_streaming(&script)?;
    let mut current_note: HashMap<String, String> = HashMap::new();
    let mut body_lines: Vec<String> = Vec::new();

    for line in lines {
        let line_stripped = line.trim_end();

        if line_stripped == format!("{}{}", split, split) {
            // End of note
            if let Some(id) = current_note.get("id") {
                let note_updated = current_note.get("updated").cloned().unwrap_or_default();

                // Check if note needs updating
                let needs_update = match existing_notes.get(id) {
                    Some(existing_updated) => existing_updated != &note_updated,
                    None => true,
                };

                if needs_update {
                    let folder_long_id = current_note.get("folder").cloned().unwrap_or_default();
                    let folder_id = folder_long_ids_to_id.get(&folder_long_id).copied();
                    let folder_name = folder_id
                        .and_then(|id| folder_ids_to_names.get(&id))
                        .cloned()
                        .unwrap_or_else(|| "Uncategorized".to_string());

                    let note = AppleNote {
                        id: id.clone(),
                        title: current_note.get("title").cloned().unwrap_or_default(),
                        body: body_lines.join("\n"),
                        created: current_note.get("created").cloned().unwrap_or_default(),
                        updated: note_updated.clone(),
                        folder_id,
                        folder_long_id,
                        markdown_path: None,
                    };

                    // Create markdown file
                    let markdown_path = create_markdown_file(&note, &data_dir, &folder_name)?;
                    let markdown_path_str = markdown_path.to_string_lossy().to_string();

                    // Save to database
                    conn.execute(
                        "INSERT OR REPLACE INTO notes (id, created, updated, folder_id, title, body, markdown_path)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                        params![
                            note.id,
                            note.created,
                            note.updated,
                            note.folder_id,
                            note.title,
                            note.body,
                            markdown_path_str
                        ],
                    )
                    .map_err(|e| format!("Failed to insert note: {}", e))?;

                    exported_count += 1;
                } else {
                    skipped_count += 1;
                }

                processed_count += 1;

                // Emit progress update
                let title = current_note
                    .get("title")
                    .cloned()
                    .unwrap_or_else(|| "Untitled".to_string());
                let _ = app.emit(
                    "notes-export-progress",
                    NotesExportProgress {
                        current: processed_count,
                        total: total_count,
                        exported: exported_count,
                        skipped: skipped_count,
                        current_title: title,
                        status: "exporting".to_string(),
                    },
                );
            }

            current_note.clear();
            body_lines.clear();
            continue;
        }

        // Parse note fields
        let mut found_key = false;
        for key in &["id", "title", "folder", "created", "updated"] {
            let prefix = format!("{}-{}: ", split, key);
            if line_stripped.starts_with(&prefix) {
                let value = line_stripped[prefix.len()..].to_string();
                current_note.insert(key.to_string(), value);
                found_key = true;
                break;
            }
        }

        if !found_key {
            body_lines.push(line_stripped.to_string());
        }
    }

    // Emit completion
    let _ = app.emit(
        "notes-export-progress",
        NotesExportProgress {
            current: processed_count,
            total: total_count,
            exported: exported_count,
            skipped: skipped_count,
            current_title: "".to_string(),
            status: "complete".to_string(),
        },
    );

    Ok(NotesExportResult {
        total_count,
        exported_count,
        skipped_count,
        error: None,
    })
}

/// Get all exported notes from local database
#[command]
pub async fn get_exported_notes() -> Result<Vec<AppleNote>, String> {
    let db_path =
        get_notes_db_path().ok_or_else(|| "Could not determine database path".to_string())?;

    if !db_path.exists() {
        return Ok(Vec::new());
    }

    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT n.id, n.created, n.updated, n.folder_id, n.title, n.body, n.markdown_path,
                    COALESCE(f.long_id, '') as folder_long_id
             FROM notes n
             LEFT JOIN folders f ON n.folder_id = f.id
             ORDER BY n.updated DESC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let notes = stmt
        .query_map([], |row| {
            Ok(AppleNote {
                id: row.get(0)?,
                created: row.get(1)?,
                updated: row.get(2)?,
                folder_id: row.get(3)?,
                title: row.get(4)?,
                body: row.get(5)?,
                markdown_path: row.get(6)?,
                folder_long_id: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to query notes: {}", e))?;

    let mut result = Vec::new();
    for n in notes.flatten() {
        result.push(n);
    }

    Ok(result)
}

/// Get all exported folders from local database
#[command]
pub async fn get_exported_folders() -> Result<Vec<AppleFolder>, String> {
    let db_path =
        get_notes_db_path().ok_or_else(|| "Could not determine database path".to_string())?;

    if !db_path.exists() {
        return Ok(Vec::new());
    }

    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT id, long_id, name, parent_id FROM folders ORDER BY name")
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let folders = stmt
        .query_map([], |row| {
            Ok(AppleFolder {
                id: row.get(0)?,
                long_id: row.get(1)?,
                name: row.get(2)?,
                parent_id: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to query folders: {}", e))?;

    let mut result = Vec::new();
    for f in folders.flatten() {
        result.push(f);
    }

    Ok(result)
}
