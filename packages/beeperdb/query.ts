#!/usr/bin/env bun
/**
 * Simple WhatsApp message query utility
 * Usage:
 *   bun query.ts contacts [search]
 *   bun query.ts threads [search]
 *   bun query.ts messages <name>
 *   bun query.ts search <text>
 */

import { $ } from "bun";

const DB_PATH = `${import.meta.dir}/data/clean.duckdb`;

async function query(sql: string): Promise<any[]> {
  const result = await $`duckdb ${DB_PATH} -json -c ${sql}`.text();
  return result.trim() ? JSON.parse(result) : [];
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function escapeLikePattern(value: string): string {
  return escapeSqlLiteral(value).replace(/[\\%_]/g, "\\$&");
}

// ============================================================================
// Query Methods
// ============================================================================

export async function getContacts(search?: string) {
  const where = search
    ? `WHERE LOWER(name) LIKE '%${search.toLowerCase()}%'`
    : '';
  return query(`SELECT name, phone, is_business, thread_id FROM contacts ${where} ORDER BY name LIMIT 50`);
}

export async function getThreads(search?: string) {
  const where = search
    ? `WHERE LOWER(name) LIKE '%${search.toLowerCase()}%'`
    : '';
  return query(`
    SELECT thread_id, name, type, participant_count, message_count, last_message_at
    FROM thread_summaries ${where}
    ORDER BY last_message_at DESC
  `);
}

export async function getMessages(nameOrThread: string, limit = 50) {
  const search = nameOrThread.toLowerCase();
  return query(`
    SELECT thread_name, sender, text, timestamp_readable
    FROM conversations
    WHERE LOWER(thread_name) LIKE '%${search}%'
       OR LOWER(sender) LIKE '%${search}%'
    ORDER BY timestamp DESC
    LIMIT ${limit}
  `);
}

export async function searchText(text: string, limit = 150) {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return [];

  const phrasePattern = escapeLikePattern(normalized);
  const exactMatchLiteral = escapeSqlLiteral(normalized);
  const safeLimit = Math.max(1, Math.min(limit, 500));

  const tokenClauses = normalized
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .map((token) => {
      const pattern = escapeLikePattern(token);
      return `LOWER(COALESCE(thread_name, '') || ' ' || COALESCE(sender, '') || ' ' || COALESCE(text, '')) LIKE '%${pattern}%' ESCAPE '\\'`;
    });

  const tokenWhereClause = tokenClauses.length > 0
    ? tokenClauses.join("\n      AND ")
    : "TRUE";

  return query(`
    WITH ranked_matches AS (
      SELECT
        message_id,
        thread_id,
        thread_name,
        sender,
        text,
        timestamp_readable,
        timestamp,
        CASE
          WHEN LOWER(COALESCE(thread_name, '')) = '${exactMatchLiteral}' THEN 0
          WHEN LOWER(COALESCE(sender, '')) = '${exactMatchLiteral}' THEN 1
          WHEN LOWER(COALESCE(text, '')) LIKE '%${phrasePattern}%' ESCAPE '\\' THEN 2
          WHEN LOWER(COALESCE(thread_name, '')) LIKE '%${phrasePattern}%' ESCAPE '\\' THEN 3
          WHEN LOWER(COALESCE(sender, '')) LIKE '%${phrasePattern}%' ESCAPE '\\' THEN 4
          ELSE 5
        END AS match_rank,
        ROW_NUMBER() OVER (
          PARTITION BY thread_id
          ORDER BY timestamp DESC
        ) AS per_thread_rank
      FROM conversations
      WHERE ${tokenWhereClause}
    )
    SELECT
      message_id,
      thread_id,
      thread_name,
      sender,
      text,
      timestamp_readable,
      timestamp
    FROM ranked_matches
    WHERE per_thread_rank <= 25
    ORDER BY match_rank ASC, timestamp DESC
    LIMIT ${safeLimit}
  `);
}

export async function getConversation(threadName: string, limit = 100) {
  return query(`
    WITH latest_messages AS (
      SELECT sender, text, timestamp_readable, timestamp
      FROM conversations
      WHERE thread_name = '${threadName}'
      ORDER BY timestamp DESC
      LIMIT ${limit}
    )
    SELECT sender, text, timestamp_readable
    FROM latest_messages
    ORDER BY timestamp ASC
  `);
}

export async function getConversationById(threadId: string, limit = 5000) {
  return query(`
    WITH latest_messages AS (
      SELECT message_id, sender, text, timestamp_readable, timestamp
      FROM conversations
      WHERE thread_id = '${threadId}'
      ORDER BY timestamp DESC
      LIMIT ${limit}
    )
    SELECT message_id, sender, text, timestamp_readable, timestamp
    FROM latest_messages
    ORDER BY timestamp ASC
  `);
}

/**
 * Get all messages for syncing a thread to Convex (includes all fields needed for sync)
 */
export async function getMessagesForSync(
  threadId: string,
  sinceTimestamp?: number
) {
  const sinceClause =
    typeof sinceTimestamp === "number" && Number.isFinite(sinceTimestamp)
      ? ` AND timestamp >= ${Math.floor(sinceTimestamp)}`
      : "";

  return query(`
    SELECT message_id, thread_id, sender, text, timestamp
    FROM conversations
    WHERE thread_id = '${threadId}'
    ${sinceClause}
    ORDER BY timestamp ASC
  `);
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const [cmd, ...args] = Bun.argv.slice(2);

  if (!cmd) {
    console.log(`
Usage:
  bun query.ts contacts [search]     - List contacts
  bun query.ts threads [search]      - List threads (includes thread_id)
  bun query.ts messages <name>       - Get messages by contact/thread name
  bun query.ts search <text> [limit] - Search thread name, sender, and message text
  bun query.ts convo <thread_name>   - Get full conversation by exact thread name
  bun query.ts convo-id <thread_id>  - Get full conversation by thread ID (preferred)
  bun query.ts sync-msgs <thread_id> [since_timestamp] - Get messages for syncing, optional timestamp filter
    `);
    return;
  }

  let result: any[];

  switch (cmd) {
    case 'contacts':
      result = await getContacts(args[0]);
      break;
    case 'threads':
      result = await getThreads(args[0]);
      break;
    case 'messages':
      if (!args[0]) { console.error('Need a name'); return; }
      result = await getMessages(args[0], parseInt(args[1]) || 50);
      break;
    case 'search':
      if (!args[0]) { console.error('Need search text'); return; }
      result = await searchText(args[0], parseInt(args[1]) || 150);
      break;
    case 'convo':
      if (!args[0]) { console.error('Need thread name'); return; }
      result = await getConversation(args[0]);
      break;
    case 'convo-id':
      if (!args[0]) { console.error('Need thread_id'); return; }
      result = await getConversationById(args[0], parseInt(args[1]) || 5000);
      break;
    case 'sync-msgs':
      if (!args[0]) { console.error('Need thread_id'); return; }
      result = await getMessagesForSync(args[0], Number.isFinite(Number(args[1])) ? Number(args[1]) : undefined);
      break;
    default:
      console.error(`Unknown command: ${cmd}`);
      return;
  }

  console.log(JSON.stringify(result, null, 2));
}

main();
