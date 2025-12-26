// Voice Memos export and transcription module
// Reads from macOS Voice Memos database and supports Groq Whisper transcription

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{command, AppHandle, Emitter};

// Mac epoch offset (seconds between 1970-01-01 and 2001-01-01)
const MAC_EPOCH_OFFSET: i64 = 978307200;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VoiceMemo {
    pub id: i64,
    pub uuid: String,
    pub custom_label: Option<String>,
    pub date: i64,     // Unix timestamp in milliseconds
    pub duration: f64, // Duration in seconds
    pub original_path: String,
    pub local_path: Option<String>,
    pub transcription: Option<String>,
    pub transcription_language: Option<String>,
    pub transcribed_at: Option<i64>,
    pub file_size: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VoiceMemosExportResult {
    pub total_count: i32,
    pub exported_count: i32,
    pub skipped_count: i32,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VoiceMemosExportProgress {
    pub current: i32,
    pub total: i32,
    pub exported: i32,
    pub skipped: i32,
    pub current_memo: String,
    pub status: String, // "scanning", "copying", "complete", "error"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptionResult {
    pub memo_id: i64,
    pub transcription: String,
    pub language: Option<String>,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TranscriptionProgress {
    pub memo_id: i64,
    pub memo_name: String,
    pub status: String, // "uploading", "transcribing", "complete", "error"
    pub current: i32,
    pub total: i32,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptionEligibility {
    pub eligible: bool,
    pub reason: Option<String>,
    pub file_size: Option<i64>,
}

/// Groq API response structure
#[derive(Debug, Deserialize)]
struct GroqTranscriptionResponse {
    text: String,
    language: Option<String>,
}

/// Get the bundle identifier based on build mode
fn get_bundle_id() -> &'static str {
    match option_env!("TAURI_BUILD_MODE") {
        Some("production") => "com.bryanliu.lifeos-nexus",
        Some("staging") => "com.bryanliu.lifeos-nexus-staging",
        _ => "com.bryanliu.lifeos-nexus-dev",
    }
}

/// Get the macOS Voice Memos source database path
fn get_voicememos_source_db_path() -> Option<PathBuf> {
    dirs::home_dir().map(|home| {
        home.join("Library/Group Containers/group.com.apple.VoiceMemos.shared/Recordings/CloudRecordings.db")
    })
}

/// Get the macOS Voice Memos recordings directory
fn get_voicememos_source_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|home| {
        home.join("Library/Group Containers/group.com.apple.VoiceMemos.shared/Recordings")
    })
}

/// Get our app's voice memos data directory
fn get_voicememos_data_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|home| {
        home.join(format!(
            "Library/Application Support/{}/voicememos/audio",
            get_bundle_id()
        ))
    })
}

/// Get our app's voice memos database path
fn get_voicememos_db_path() -> Option<PathBuf> {
    dirs::home_dir().map(|home| {
        home.join(format!(
            "Library/Application Support/{}/voicememos.db",
            get_bundle_id()
        ))
    })
}

/// Initialize the SQLite database schema
fn init_database(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS voicememos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT UNIQUE NOT NULL,
            custom_label TEXT,
            date INTEGER NOT NULL,
            duration REAL NOT NULL,
            original_path TEXT NOT NULL,
            local_path TEXT,
            transcription TEXT,
            transcription_language TEXT,
            transcribed_at INTEGER,
            file_size INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )
    .map_err(|e| format!("Failed to create voicememos table: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_voicememos_uuid ON voicememos(uuid)",
        [],
    )
    .map_err(|e| format!("Failed to create voicememos uuid index: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_voicememos_date ON voicememos(date DESC)",
        [],
    )
    .map_err(|e| format!("Failed to create voicememos date index: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS voicememos_sync_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exported_count INTEGER NOT NULL,
            skipped_count INTEGER NOT NULL,
            total_processed INTEGER NOT NULL,
            synced_at INTEGER NOT NULL
        )",
        [],
    )
    .map_err(|e| format!("Failed to create sync_history table: {}", e))?;

    Ok(())
}

/// Open or create the local database
fn open_database() -> Result<Connection, String> {
    let db_path = get_voicememos_db_path().ok_or("Could not determine database path")?;

    // Ensure parent directory exists
    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create database directory: {}", e))?;
    }

    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    init_database(&conn)?;

    Ok(conn)
}

/// Struct to hold raw memo data from Apple's database
struct RawVoiceMemo {
    #[allow(dead_code)]
    pk: i64, // Z_PK primary key (kept for potential future use)
    unique_id: String,
    custom_label: Option<String>,
    date: f64, // Mac epoch timestamp
    duration: f64,
    path: String, // Relative path in Apple's directory
}

/// Read voice memos from Apple's database
fn read_source_voicememos() -> Result<Vec<RawVoiceMemo>, String> {
    let source_db = get_voicememos_source_db_path()
        .ok_or("Could not determine Voice Memos source database path")?;

    if !source_db.exists() {
        return Err(format!(
            "Voice Memos database not found at: {:?}. Make sure you have Voice Memos installed and have created at least one recording.",
            source_db
        ));
    }

    // Open with read-only mode and WAL
    let conn = Connection::open_with_flags(
        &source_db,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| format!("Failed to open Voice Memos database: {}. You may need to grant Full Disk Access to this app in System Settings > Privacy & Security.", e))?;

    // Enable WAL mode for better concurrent access
    conn.pragma_update(None, "journal_mode", "WAL").ok();

    // ZUNIQUEID is the UUID column, ZCUSTOMLABEL contains user-assigned name (if any)
    let mut stmt = conn
        .prepare(
            "SELECT Z_PK, ZUNIQUEID, ZCUSTOMLABEL, ZDATE, ZDURATION, ZPATH
             FROM ZCLOUDRECORDING
             WHERE ZPATH IS NOT NULL AND ZEVICTIONDATE IS NULL
             ORDER BY ZDATE DESC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let memos: Vec<RawVoiceMemo> = stmt
        .query_map([], |row| {
            Ok(RawVoiceMemo {
                pk: row.get(0)?,
                unique_id: row.get(1)?,
                custom_label: row.get(2)?,
                date: row.get(3)?,
                duration: row.get(4)?,
                path: row.get(5)?,
            })
        })
        .map_err(|e| format!("Failed to query voice memos: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(memos)
}

/// Copy a voice memo file to our local storage
fn copy_memo_file(raw_memo: &RawVoiceMemo) -> Result<(PathBuf, i64), String> {
    let source_dir = get_voicememos_source_dir().ok_or("Could not determine source directory")?;
    let dest_dir = get_voicememos_data_dir().ok_or("Could not determine destination directory")?;

    // Ensure destination directory exists
    fs::create_dir_all(&dest_dir)
        .map_err(|e| format!("Failed to create destination directory: {}", e))?;

    // Source file path
    let source_path = source_dir.join(&raw_memo.path);
    if !source_path.exists() {
        return Err(format!("Source file not found: {:?}", source_path));
    }

    // Get file size
    let metadata =
        fs::metadata(&source_path).map_err(|e| format!("Failed to get file metadata: {}", e))?;
    let file_size = metadata.len() as i64;

    // Destination path using unique_id for uniqueness
    let dest_filename = format!("{}.m4a", raw_memo.unique_id);
    let dest_path = dest_dir.join(&dest_filename);

    // Skip if file already exists with same size
    if dest_path.exists() {
        if let Ok(dest_metadata) = fs::metadata(&dest_path) {
            if dest_metadata.len() == metadata.len() {
                return Ok((dest_path, file_size));
            }
        }
    }

    // Copy file
    fs::copy(&source_path, &dest_path).map_err(|e| format!("Failed to copy file: {}", e))?;

    Ok((dest_path, file_size))
}

/// Sync voice memos from macOS to local database
#[command]
pub async fn sync_voicememos(app: AppHandle) -> Result<VoiceMemosExportResult, String> {
    // Run in blocking task since we're using SQLite
    tauri::async_runtime::spawn_blocking(move || sync_voicememos_internal(&app))
        .await
        .map_err(|e| format!("Task error: {}", e))?
}

fn sync_voicememos_internal(app: &AppHandle) -> Result<VoiceMemosExportResult, String> {
    let mut exported_count = 0;
    let mut skipped_count = 0;

    // Emit initial progress
    let _ = app.emit(
        "voicememos-sync-progress",
        VoiceMemosExportProgress {
            current: 0,
            total: 0,
            exported: 0,
            skipped: 0,
            current_memo: "Scanning Voice Memos...".to_string(),
            status: "scanning".to_string(),
        },
    );

    // Read from Apple's database
    let raw_memos = read_source_voicememos()?;
    let total_count = raw_memos.len() as i32;

    // Open our local database
    let conn = open_database()?;
    let now = chrono::Utc::now().timestamp_millis();

    for (i, raw_memo) in raw_memos.iter().enumerate() {
        let memo_name = raw_memo
            .custom_label
            .clone()
            .unwrap_or_else(|| format!("Recording {}", i + 1));

        // Emit progress
        let _ = app.emit(
            "voicememos-sync-progress",
            VoiceMemosExportProgress {
                current: (i + 1) as i32,
                total: total_count,
                exported: exported_count,
                skipped: skipped_count,
                current_memo: memo_name.clone(),
                status: "copying".to_string(),
            },
        );

        // Check if memo already exists in our database
        let existing: Option<i64> = conn
            .query_row(
                "SELECT id FROM voicememos WHERE uuid = ?1",
                params![&raw_memo.unique_id],
                |row| row.get(0),
            )
            .ok();

        if existing.is_some() {
            skipped_count += 1;
            continue;
        }

        // Copy the file
        let (local_path, file_size) = match copy_memo_file(raw_memo) {
            Ok(result) => result,
            Err(e) => {
                eprintln!("Failed to copy memo {}: {}", raw_memo.unique_id, e);
                continue;
            }
        };

        // Convert Mac epoch to Unix timestamp (milliseconds)
        let unix_timestamp_ms = ((raw_memo.date + MAC_EPOCH_OFFSET as f64) * 1000.0) as i64;

        // Insert into our database
        let result = conn.execute(
            "INSERT INTO voicememos (uuid, custom_label, date, duration, original_path, local_path, file_size, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                &raw_memo.unique_id,
                &raw_memo.custom_label,
                unix_timestamp_ms,
                raw_memo.duration,
                &raw_memo.path,
                local_path.to_string_lossy().to_string(),
                file_size,
                now,
                now,
            ],
        );

        if result.is_ok() {
            exported_count += 1;
        }
    }

    // Record sync history
    let _ = conn.execute(
        "INSERT INTO voicememos_sync_history (exported_count, skipped_count, total_processed, synced_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![exported_count, skipped_count, total_count, now],
    );

    // Emit completion
    let _ = app.emit(
        "voicememos-sync-progress",
        VoiceMemosExportProgress {
            current: total_count,
            total: total_count,
            exported: exported_count,
            skipped: skipped_count,
            current_memo: "Complete".to_string(),
            status: "complete".to_string(),
        },
    );

    Ok(VoiceMemosExportResult {
        total_count,
        exported_count,
        skipped_count,
        error: None,
    })
}

/// Get all synced voice memos from local database
#[command]
pub fn get_voicememos() -> Result<Vec<VoiceMemo>, String> {
    let conn = open_database()?;

    let mut stmt = conn
        .prepare(
            "SELECT id, uuid, custom_label, date, duration, original_path, local_path,
                    transcription, transcription_language, transcribed_at, file_size
             FROM voicememos
             ORDER BY date DESC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let memos: Vec<VoiceMemo> = stmt
        .query_map([], |row| {
            Ok(VoiceMemo {
                id: row.get(0)?,
                uuid: row.get(1)?,
                custom_label: row.get(2)?,
                date: row.get(3)?,
                duration: row.get(4)?,
                original_path: row.get(5)?,
                local_path: row.get(6)?,
                transcription: row.get(7)?,
                transcription_language: row.get(8)?,
                transcribed_at: row.get(9)?,
                file_size: row.get(10)?,
            })
        })
        .map_err(|e| format!("Failed to query voice memos: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(memos)
}

/// Get a single voice memo by ID
#[command]
pub fn get_voicememo(memo_id: i64) -> Result<Option<VoiceMemo>, String> {
    let conn = open_database()?;

    let memo = conn
        .query_row(
            "SELECT id, uuid, custom_label, date, duration, original_path, local_path,
                    transcription, transcription_language, transcribed_at, file_size
             FROM voicememos WHERE id = ?1",
            params![memo_id],
            |row| {
                Ok(VoiceMemo {
                    id: row.get(0)?,
                    uuid: row.get(1)?,
                    custom_label: row.get(2)?,
                    date: row.get(3)?,
                    duration: row.get(4)?,
                    original_path: row.get(5)?,
                    local_path: row.get(6)?,
                    transcription: row.get(7)?,
                    transcription_language: row.get(8)?,
                    transcribed_at: row.get(9)?,
                    file_size: row.get(10)?,
                })
            },
        )
        .ok();

    Ok(memo)
}

/// Check if a memo can be transcribed
#[command]
pub fn check_transcription_eligibility(memo_id: i64) -> Result<TranscriptionEligibility, String> {
    let conn = open_database()?;

    let memo: Option<(Option<String>, Option<i64>)> = conn
        .query_row(
            "SELECT local_path, file_size FROM voicememos WHERE id = ?1",
            params![memo_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .ok();

    match memo {
        None => Ok(TranscriptionEligibility {
            eligible: false,
            reason: Some("Memo not found".to_string()),
            file_size: None,
        }),
        Some((None, _)) => Ok(TranscriptionEligibility {
            eligible: false,
            reason: Some("Audio file not synced".to_string()),
            file_size: None,
        }),
        Some((Some(path), file_size)) => {
            let path = PathBuf::from(&path);
            if !path.exists() {
                return Ok(TranscriptionEligibility {
                    eligible: false,
                    reason: Some("Audio file not found on disk".to_string()),
                    file_size,
                });
            }

            // Check file size (25 MB limit for Groq)
            let max_size: i64 = 25 * 1024 * 1024; // 25 MB
            if let Some(size) = file_size {
                if size > max_size {
                    return Ok(TranscriptionEligibility {
                        eligible: false,
                        reason: Some(format!(
                            "File too large ({:.1} MB). Maximum is 25 MB.",
                            size as f64 / (1024.0 * 1024.0)
                        )),
                        file_size: Some(size),
                    });
                }
            }

            Ok(TranscriptionEligibility {
                eligible: true,
                reason: None,
                file_size,
            })
        }
    }
}

/// Transcribe a single voice memo using Groq API
#[command]
pub async fn transcribe_voicememo(
    app: AppHandle,
    memo_id: i64,
) -> Result<TranscriptionResult, String> {
    // Get API key from environment
    let api_key =
        std::env::var("GROQ_API_KEY").map_err(|_| "GROQ_API_KEY environment variable not set")?;

    // Get memo details
    let memo = get_voicememo(memo_id)?.ok_or("Memo not found")?;

    let local_path = memo.local_path.ok_or("Audio file not synced")?;

    let file_path = PathBuf::from(&local_path);
    if !file_path.exists() {
        return Err(format!("Audio file not found: {}", local_path));
    }

    // Check file size
    let metadata =
        fs::metadata(&file_path).map_err(|e| format!("Failed to read file metadata: {}", e))?;
    let file_size = metadata.len();
    let max_size: u64 = 25 * 1024 * 1024; // 25 MB
    if file_size > max_size {
        return Err(format!(
            "File too large ({:.1} MB). Maximum is 25 MB.",
            file_size as f64 / (1024.0 * 1024.0)
        ));
    }

    let memo_name = memo.custom_label.unwrap_or_else(|| "Recording".to_string());

    // Emit progress
    let _ = app.emit(
        "voicememos-transcription-progress",
        TranscriptionProgress {
            memo_id,
            memo_name: memo_name.clone(),
            status: "uploading".to_string(),
            current: 0,
            total: 1,
            error: None,
        },
    );

    // Read file bytes
    let file_bytes =
        fs::read(&file_path).map_err(|e| format!("Failed to read audio file: {}", e))?;

    // Create multipart form
    let file_part = reqwest::multipart::Part::bytes(file_bytes)
        .file_name("audio.m4a")
        .mime_str("audio/m4a")
        .map_err(|e| format!("Failed to create file part: {}", e))?;

    let form = reqwest::multipart::Form::new()
        .text("model", "whisper-large-v3-turbo")
        .text("response_format", "json")
        .part("file", file_part);

    // Emit transcribing status
    let _ = app.emit(
        "voicememos-transcription-progress",
        TranscriptionProgress {
            memo_id,
            memo_name: memo_name.clone(),
            status: "transcribing".to_string(),
            current: 0,
            total: 1,
            error: None,
        },
    );

    // Call Groq API
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.groq.com/openai/v1/audio/transcriptions")
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Failed to call Groq API: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        let _ = app.emit(
            "voicememos-transcription-progress",
            TranscriptionProgress {
                memo_id,
                memo_name,
                status: "error".to_string(),
                current: 0,
                total: 1,
                error: Some(format!("API error: {} - {}", status, error_text)),
            },
        );
        return Err(format!("Groq API error: {} - {}", status, error_text));
    }

    let result: GroqTranscriptionResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // Update database with transcription
    let now = chrono::Utc::now().timestamp_millis();
    let conn = open_database()?;
    conn.execute(
        "UPDATE voicememos SET transcription = ?1, transcription_language = ?2, transcribed_at = ?3, updated_at = ?4 WHERE id = ?5",
        params![&result.text, &result.language, now, now, memo_id],
    )
    .map_err(|e| format!("Failed to save transcription: {}", e))?;

    // Emit completion
    let _ = app.emit(
        "voicememos-transcription-progress",
        TranscriptionProgress {
            memo_id,
            memo_name,
            status: "complete".to_string(),
            current: 1,
            total: 1,
            error: None,
        },
    );

    Ok(TranscriptionResult {
        memo_id,
        transcription: result.text,
        language: result.language,
        success: true,
        error: None,
    })
}

/// Batch transcribe multiple voice memos
#[command]
pub async fn transcribe_voicememos_batch(
    app: AppHandle,
    memo_ids: Vec<i64>,
) -> Result<Vec<TranscriptionResult>, String> {
    let total = memo_ids.len();
    let mut results = Vec::new();

    for (i, memo_id) in memo_ids.iter().enumerate() {
        // Emit batch progress
        let memo = get_voicememo(*memo_id).ok().flatten();
        let memo_name = memo
            .and_then(|m| m.custom_label)
            .unwrap_or_else(|| format!("Recording {}", i + 1));

        let _ = app.emit(
            "voicememos-transcription-progress",
            TranscriptionProgress {
                memo_id: *memo_id,
                memo_name: memo_name.clone(),
                status: "transcribing".to_string(),
                current: (i + 1) as i32,
                total: total as i32,
                error: None,
            },
        );

        match transcribe_voicememo(app.clone(), *memo_id).await {
            Ok(result) => results.push(result),
            Err(e) => results.push(TranscriptionResult {
                memo_id: *memo_id,
                transcription: String::new(),
                language: None,
                success: false,
                error: Some(e),
            }),
        }
    }

    Ok(results)
}
