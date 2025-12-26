//! SQLite persistence layer for council requests.

use rusqlite::{params, Connection};
use std::fs;
use std::path::PathBuf;

use super::types::{ConversationSummary, CouncilResponse, PersistedRequest};

/// Get the bundle ID based on build mode
fn get_bundle_id() -> &'static str {
    match option_env!("TAURI_BUILD_MODE") {
        Some("production") => "com.bryanliu.lifeos-nexus",
        Some("staging") => "com.bryanliu.lifeos-nexus-staging",
        _ => "com.bryanliu.lifeos-nexus-dev",
    }
}

/// Get path to the council database
pub fn get_council_db_path() -> Option<PathBuf> {
    dirs::data_local_dir().map(|data_dir| {
        let app_dir = data_dir.join(get_bundle_id()).join("council");
        let _ = fs::create_dir_all(&app_dir);
        app_dir.join("council.db")
    })
}

/// Initialize the database schema
pub fn init_db() -> Result<(), String> {
    let db_path = get_council_db_path().ok_or("Could not determine database path")?;
    println!("[Council Server] Database path: {:?}", db_path);

    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    conn.execute_batch("PRAGMA journal_mode=WAL;")
        .map_err(|e| format!("Failed to set WAL mode: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS council_requests (
            id TEXT PRIMARY KEY,
            query TEXT NOT NULL,
            tier TEXT NOT NULL DEFAULT 'normal',
            status TEXT NOT NULL DEFAULT 'pending',
            stage1 TEXT,
            stage2 TEXT,
            stage3 TEXT,
            metadata TEXT,
            error TEXT,
            duration INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )
    .map_err(|e| format!("Failed to create table: {}", e))?;

    // Create indexes
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_council_requests_status ON council_requests(status)",
        [],
    )
    .map_err(|e| format!("Failed to create status index: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_council_requests_created ON council_requests(created_at DESC)",
        [],
    ).map_err(|e| format!("Failed to create created_at index: {}", e))?;

    println!("[Council Server] Database initialized successfully");
    Ok(())
}

/// Save a new request to the database
pub fn save_request(id: &str, query: &str, tier: &str) -> Result<(), String> {
    let db_path = get_council_db_path().ok_or("Could not determine database path")?;
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    let now = chrono::Utc::now().timestamp_millis();

    conn.execute(
        "INSERT INTO council_requests (id, query, tier, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'pending', ?4, ?4)",
        params![id, query, tier, now],
    )
    .map_err(|e| format!("Failed to save request: {}", e))?;

    Ok(())
}

/// Update request status to processing
pub fn update_request_processing(id: &str) -> Result<(), String> {
    let db_path = get_council_db_path().ok_or("Could not determine database path")?;
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    let now = chrono::Utc::now().timestamp_millis();

    conn.execute(
        "UPDATE council_requests SET status = 'processing', updated_at = ?1 WHERE id = ?2",
        params![now, id],
    )
    .map_err(|e| format!("Failed to update request status: {}", e))?;

    Ok(())
}

/// Update request with completed response
pub fn update_request_completed(id: &str, response: &CouncilResponse) -> Result<(), String> {
    let db_path = get_council_db_path().ok_or("Could not determine database path")?;
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    let now = chrono::Utc::now().timestamp_millis();

    let stage1_json = response
        .stage1
        .as_ref()
        .map(|s| serde_json::to_string(s).unwrap_or_default());
    let stage2_json = response
        .stage2
        .as_ref()
        .map(|s| serde_json::to_string(s).unwrap_or_default());
    let stage3_json = response
        .stage3
        .as_ref()
        .map(|s| serde_json::to_string(s).unwrap_or_default());
    let metadata_json = response
        .metadata
        .as_ref()
        .map(|m| serde_json::to_string(m).unwrap_or_default());

    conn.execute(
        "UPDATE council_requests
         SET status = 'completed', stage1 = ?1, stage2 = ?2, stage3 = ?3,
             metadata = ?4, duration = ?5, updated_at = ?6
         WHERE id = ?7",
        params![
            stage1_json,
            stage2_json,
            stage3_json,
            metadata_json,
            response.duration,
            now,
            id
        ],
    )
    .map_err(|e| format!("Failed to update completed request: {}", e))?;

    Ok(())
}

/// Update request with error
pub fn update_request_error(id: &str, error: &str) -> Result<(), String> {
    let db_path = get_council_db_path().ok_or("Could not determine database path")?;
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    let now = chrono::Utc::now().timestamp_millis();

    conn.execute(
        "UPDATE council_requests SET status = 'error', error = ?1, updated_at = ?2 WHERE id = ?3",
        params![error, now, id],
    )
    .map_err(|e| format!("Failed to update request error: {}", e))?;

    Ok(())
}

/// Get a single request by ID
pub fn get_request(id: &str) -> Result<Option<PersistedRequest>, String> {
    let db_path = get_council_db_path().ok_or("Could not determine database path")?;
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    let mut stmt = conn.prepare(
        "SELECT id, query, tier, status, stage1, stage2, stage3, metadata, error, duration, created_at, updated_at
         FROM council_requests WHERE id = ?1"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let result = stmt.query_row(params![id], |row| {
        let stage1_json: Option<String> = row.get(4)?;
        let stage2_json: Option<String> = row.get(5)?;
        let stage3_json: Option<String> = row.get(6)?;
        let metadata_json: Option<String> = row.get(7)?;

        Ok(PersistedRequest {
            id: row.get(0)?,
            query: row.get(1)?,
            tier: row.get(2)?,
            status: row.get(3)?,
            stage1: stage1_json.and_then(|s| serde_json::from_str(&s).ok()),
            stage2: stage2_json.and_then(|s| serde_json::from_str(&s).ok()),
            stage3: stage3_json.and_then(|s| serde_json::from_str(&s).ok()),
            metadata: metadata_json.and_then(|s| serde_json::from_str(&s).ok()),
            error: row.get(8)?,
            duration: row.get(9)?,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
        })
    });

    match result {
        Ok(request) => Ok(Some(request)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to get request: {}", e)),
    }
}

/// Get recent requests (sorted by created_at DESC)
pub fn get_recent_requests(limit: u32) -> Result<Vec<ConversationSummary>, String> {
    let db_path = get_council_db_path().ok_or("Could not determine database path")?;
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, query, tier, created_at, duration
         FROM council_requests
         ORDER BY created_at DESC
         LIMIT ?1",
        )
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let rows = stmt
        .query_map(params![limit], |row| {
            Ok(ConversationSummary {
                id: row.get(0)?,
                query: row.get(1)?,
                tier: row.get(2)?,
                created_at: row.get(3)?,
                duration: row.get(4)?,
            })
        })
        .map_err(|e| format!("Failed to query requests: {}", e))?;

    let mut requests = Vec::new();
    for row in rows {
        requests.push(row.map_err(|e| format!("Failed to read row: {}", e))?);
    }

    Ok(requests)
}

/// Get active (pending or processing) request
pub fn get_active_request() -> Result<Option<PersistedRequest>, String> {
    let db_path = get_council_db_path().ok_or("Could not determine database path")?;
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    let mut stmt = conn.prepare(
        "SELECT id, query, tier, status, stage1, stage2, stage3, metadata, error, duration, created_at, updated_at
         FROM council_requests
         WHERE status IN ('pending', 'processing')
         ORDER BY created_at DESC
         LIMIT 1"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let result = stmt.query_row([], |row| {
        let stage1_json: Option<String> = row.get(4)?;
        let stage2_json: Option<String> = row.get(5)?;
        let stage3_json: Option<String> = row.get(6)?;
        let metadata_json: Option<String> = row.get(7)?;

        Ok(PersistedRequest {
            id: row.get(0)?,
            query: row.get(1)?,
            tier: row.get(2)?,
            status: row.get(3)?,
            stage1: stage1_json.and_then(|s| serde_json::from_str(&s).ok()),
            stage2: stage2_json.and_then(|s| serde_json::from_str(&s).ok()),
            stage3: stage3_json.and_then(|s| serde_json::from_str(&s).ok()),
            metadata: metadata_json.and_then(|s| serde_json::from_str(&s).ok()),
            error: row.get(8)?,
            duration: row.get(9)?,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
        })
    });

    match result {
        Ok(request) => Ok(Some(request)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to get active request: {}", e)),
    }
}

/// Delete a request by ID
pub fn delete_request(id: &str) -> Result<bool, String> {
    let db_path = get_council_db_path().ok_or("Could not determine database path")?;
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    let rows_affected = conn
        .execute("DELETE FROM council_requests WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete request: {}", e))?;

    Ok(rows_affected > 0)
}

/// Cleanup old requests, keeping only the most recent N
pub fn cleanup_old_requests(keep_count: u32) -> Result<u32, String> {
    let db_path = get_council_db_path().ok_or("Could not determine database path")?;
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    let rows_affected = conn
        .execute(
            "DELETE FROM council_requests
         WHERE id NOT IN (
             SELECT id FROM council_requests
             ORDER BY created_at DESC
             LIMIT ?1
         )",
            params![keep_count],
        )
        .map_err(|e| format!("Failed to cleanup requests: {}", e))?;

    Ok(rows_affected as u32)
}
