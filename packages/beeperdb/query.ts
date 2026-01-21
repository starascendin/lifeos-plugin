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
    ORDER BY last_message_at DESC LIMIT 30
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

export async function searchText(text: string, limit = 30) {
  return query(`
    SELECT thread_id, thread_name, sender, text, timestamp_readable
    FROM conversations
    WHERE LOWER(text) LIKE '%${text.toLowerCase()}%'
    ORDER BY timestamp DESC
    LIMIT ${limit}
  `);
}

export async function getConversation(threadName: string, limit = 100) {
  return query(`
    SELECT sender, text, timestamp_readable
    FROM conversations
    WHERE thread_name = '${threadName}'
    ORDER BY timestamp ASC
    LIMIT ${limit}
  `);
}

export async function getConversationById(threadId: string, limit = 100) {
  return query(`
    SELECT sender, text, timestamp_readable
    FROM conversations
    WHERE thread_id = '${threadId}'
    ORDER BY timestamp ASC
    LIMIT ${limit}
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
  bun query.ts search <text>         - Search message text
  bun query.ts convo <thread_name>   - Get full conversation by exact thread name
  bun query.ts convo-id <thread_id>  - Get full conversation by thread ID (preferred)
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
      result = await searchText(args[0]);
      break;
    case 'convo':
      if (!args[0]) { console.error('Need thread name'); return; }
      result = await getConversation(args[0]);
      break;
    case 'convo-id':
      if (!args[0]) { console.error('Need thread_id'); return; }
      result = await getConversationById(args[0], parseInt(args[1]) || 100);
      break;
    default:
      console.error(`Unknown command: ${cmd}`);
      return;
  }

  console.log(JSON.stringify(result, null, 2));
}

main();
