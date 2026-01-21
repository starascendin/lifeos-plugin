-- clean.sql
-- DuckDB script that creates clean tables for AI-friendly access to WhatsApp data
--
-- Usage:
--   duckdb data/clean.duckdb < clean.sql
--
-- Prerequisites:
--   - Run `pnpm sync` first to create export.sqlite

-- Install and load SQLite extension
INSTALL sqlite;
LOAD sqlite;

-- Attach SQLite database (relative path - run from data directory)
ATTACH 'export.sqlite' AS src (TYPE SQLITE, READ_ONLY);

-- ============================================================================
-- Table 1: contacts - Clean contact list from WhatsApp
-- ============================================================================
CREATE OR REPLACE TABLE contacts AS
SELECT
    COALESCE(wc.full_name, wc.push_name, wc.redacted_phone) AS name,
    wc.redacted_phone AS phone,
    CASE WHEN wc.business_name IS NOT NULL AND wc.business_name != '' THEN TRUE ELSE FALSE END AS is_business,
    wc.business_name,
    wc.their_jid,
    -- Find the thread for this contact (DM thread with this user)
    (
        SELECT t.threadID
        FROM src.threads t
        WHERE t.bridge_name = 'local-whatsapp'
          AND t.thread_type = 'SINGLE'
          AND t.threadID LIKE '%' || REPLACE(wc.their_jid, '@s.whatsapp.net', '') || '%'
        LIMIT 1
    ) AS thread_id
FROM src.whatsapp_contacts wc
WHERE wc.their_jid NOT LIKE '%@g.us'  -- Exclude group JIDs
  AND wc.their_jid NOT LIKE '%@broadcast'  -- Exclude broadcast
ORDER BY name;

-- ============================================================================
-- Table 2: threads - WhatsApp threads with stats
-- ============================================================================
CREATE OR REPLACE TABLE threads AS
SELECT
    t.threadID AS thread_id,
    COALESCE(
        t.title,
        -- For DMs, try to get contact name
        (SELECT COALESCE(wc.full_name, wc.push_name, wc.redacted_phone)
         FROM src.whatsapp_contacts wc
         WHERE t.threadID LIKE '%' || REPLACE(wc.their_jid, '@s.whatsapp.net', '') || '%'
         LIMIT 1),
        -- Fallback to first non-self participant
        (SELECT p.full_name
         FROM src.participants p
         WHERE p.threadID = t.threadID AND p.is_self = 0
         LIMIT 1),
        'Unknown'
    ) AS name,
    CASE
        WHEN t.thread_type = 'SINGLE' THEN 'dm'
        WHEN t.thread_type = 'GROUP' THEN 'group'
        ELSE LOWER(COALESCE(t.thread_type, 'unknown'))
    END AS type,
    (SELECT COUNT(*) FROM src.participants p WHERE p.threadID = t.threadID) AS participant_count,
    (SELECT COUNT(*) FROM src.messages m WHERE m.threadID = t.threadID) AS message_count,
    t.timestamp AS last_message_at,
    t.unreadCount AS unread_count
FROM src.threads t
WHERE t.bridge_name = 'local-whatsapp'
ORDER BY t.timestamp DESC;

-- ============================================================================
-- Table 3: messages - Last 100 messages per thread
-- ============================================================================
CREATE OR REPLACE TABLE messages AS
WITH ranked_messages AS (
    SELECT
        m.eventID,
        m.threadID,
        m.timestamp,
        m.type AS msg_type,
        m.text,
        m.isSentByMe AS sent_by_me,
        m.senderID,
        ROW_NUMBER() OVER (PARTITION BY m.threadID ORDER BY m.timestamp DESC) AS rn
    FROM src.messages m
    WHERE m.threadID LIKE '%local-whatsapp%'
      AND m.type != 'HIDDEN'
),
thread_info AS (
    SELECT thread_id, name, type FROM threads
)
SELECT
    rm.eventID AS message_id,
    -- Thread info
    th.name AS thread_name,
    th.type AS thread_type,
    rm.threadID AS thread_id,
    -- Sender info
    CASE
        WHEN rm.sent_by_me = 1 THEN 'Me'
        ELSE COALESCE(
            (SELECT COALESCE(wc.full_name, wc.push_name, wc.redacted_phone)
             FROM src.whatsapp_contacts wc
             WHERE rm.senderID LIKE '%' || REPLACE(wc.their_jid, '@s.whatsapp.net', '') || '%'
             LIMIT 1),
            (SELECT p.full_name
             FROM src.participants p
             WHERE p.threadID = rm.threadID
               AND rm.senderID LIKE '%' || p.participant_id || '%'
             LIMIT 1),
            rm.senderID
        )
    END AS sender_name,
    rm.text,
    CAST(rm.sent_by_me AS BOOLEAN) AS sent_by_me,
    rm.timestamp,
    -- Human-readable timestamp
    strftime(to_timestamp(rm.timestamp / 1000), '%Y-%m-%d %H:%M:%S') AS timestamp_readable
FROM ranked_messages rm
LEFT JOIN thread_info th ON rm.threadID = th.thread_id
WHERE rm.rn <= 100
ORDER BY rm.threadID, rm.timestamp ASC;

-- ============================================================================
-- Table 4: conversations - AI-ready conversation view
-- Groups messages by thread with context (only non-empty text)
-- ============================================================================
CREATE OR REPLACE TABLE conversations AS
SELECT
    thread_name,
    thread_type,
    thread_id,
    sender_name AS sender,
    text,
    sent_by_me,
    timestamp,
    timestamp_readable
FROM messages
WHERE text IS NOT NULL AND text != ''
ORDER BY thread_id, timestamp ASC;

-- ============================================================================
-- Table 5: thread_summaries - Quick thread overview for AI context
-- ============================================================================
CREATE OR REPLACE TABLE thread_summaries AS
SELECT
    th.thread_id,
    th.name,
    th.type,
    th.participant_count,
    th.message_count,
    strftime(to_timestamp(th.last_message_at / 1000), '%Y-%m-%d %H:%M:%S') AS last_message_at,
    -- Get preview of last message
    (SELECT m.text
     FROM messages m
     WHERE m.thread_id = th.thread_id
     ORDER BY m.timestamp DESC
     LIMIT 1) AS last_message_preview
FROM threads th
WHERE th.message_count > 0
ORDER BY th.last_message_at DESC;

-- ============================================================================
-- Metadata table
-- ============================================================================
CREATE OR REPLACE TABLE clean_meta AS
SELECT
    'created_at' AS key,
    strftime(current_timestamp, '%Y-%m-%dT%H:%M:%SZ') AS value
UNION ALL
SELECT 'source_db', 'export.sqlite';

-- Detach source database (data is now copied)
DETACH src;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_conversations_thread ON conversations(thread_id);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
CREATE INDEX IF NOT EXISTS idx_threads_name ON threads(name);

-- Show summary
SELECT '=== Clean DB Summary ===' AS info;
SELECT 'Contacts: ' || COUNT(*) AS info FROM contacts;
SELECT 'Threads: ' || COUNT(*) AS info FROM threads;
SELECT 'Messages (last 100/thread): ' || COUNT(*) AS info FROM messages;
SELECT 'Conversations (non-empty): ' || COUNT(*) AS info FROM conversations;
