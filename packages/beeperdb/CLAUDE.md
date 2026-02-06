# beeperdb

Local WhatsApp message database from Beeper, optimized for AI consumption.

## What This Is

This package syncs WhatsApp data from the local Beeper desktop app into queryable databases:
- `export.sqlite` - Raw normalized data from Beeper's SQLite DBs
- `clean.duckdb` - Clean, AI-friendly tables for contacts, threads, and messages

## Quick Start

```bash
pnpm sync    # Clone Beeper DBs and build export.sqlite
pnpm clean   # Build clean.duckdb with AI-friendly tables
```

## Querying Messages

Use `query.ts` for simple queries:

```bash
pnpm q contacts [search]      # List contacts (optional name filter)
pnpm q threads [search]       # List threads with thread_id and message counts
pnpm q messages <name>        # Get messages by contact/thread name
pnpm q search <text>          # Search message text content
pnpm q convo "<thread_name>"  # Full conversation by exact thread name
pnpm q convo-id "<thread_id>" # Full conversation by thread ID (preferred)
```

### Important: Use thread_id for DMs

Many WhatsApp DM threads share the generic name "WhatsApp private chat". Always use `thread_id` (not `thread_name`) to uniquely identify threads:

```bash
# Get threads - note the thread_id in output
pnpm q threads

# Use thread_id to get the correct conversation
pnpm q convo-id "!abc123:local-whatsapp.localhost"
```

### Examples

```bash
pnpm q messages alex         # Messages involving "alex"
pnpm q threads family        # Threads with "family" in name
pnpm q search "meeting"      # Messages containing "meeting" (includes thread_id)
pnpm q convo "Small family"  # All messages in exact thread (works for unique names)
pnpm q convo-id "!xyz..."    # All messages by thread_id (always unique)
```

## Direct DuckDB Queries

For complex queries, use duckdb directly:

```bash
# List threads with their unique IDs
duckdb data/clean.duckdb "SELECT thread_id, name, message_count FROM threads ORDER BY message_count DESC LIMIT 10"

# Get conversation by thread_id (preferred for DMs)
duckdb data/clean.duckdb "SELECT sender, text FROM conversations WHERE thread_id = '!abc123...' ORDER BY timestamp"

# Get conversation by name (only for uniquely named threads like groups)
duckdb data/clean.duckdb "SELECT sender, text FROM conversations WHERE thread_name = 'Small family' ORDER BY timestamp"
```

### Available Tables in clean.duckdb

| Table | Description |
|-------|-------------|
| `contacts` | WhatsApp contacts (name, phone, is_business, thread_id) |
| `threads` | Threads with stats (thread_id, name, type, participant_count, message_count) |
| `messages` | All available messages per thread (thread_id, thread_name, sender_name, text, timestamp) |
| `conversations` | Same as messages but only non-empty text, good for AI |
| `thread_summaries` | Thread overview with thread_id, name, and last message preview |

### Key Fields

- `thread_id` - Unique identifier for each thread (use this for DMs)
- `thread_name` - Display name (may be duplicate, e.g., "WhatsApp private chat")
- `type` - Thread type: "dm" (direct message) or "group"

## Exporting for AI

```bash
# Export to JSON
duckdb data/clean.duckdb "COPY conversations TO 'data/conversations.json' (FORMAT JSON)"

# Export specific thread by ID
duckdb data/clean.duckdb "COPY (SELECT * FROM conversations WHERE thread_id = '!abc123...') TO 'data/thread.json' (FORMAT JSON)"

# Export specific thread by name (only for unique names)
duckdb data/clean.duckdb "COPY (SELECT * FROM conversations WHERE thread_name = 'Small family') TO 'data/family.json' (FORMAT JSON)"
```

## File Structure

```
packages/beeperdb/
├── beeperdb.sh      # Main CLI (clone, export, sync, clean)
├── clean.sql        # DuckDB schema for clean.duckdb
├── query.ts         # Simple query utility (bun)
├── data/            # [gitignored] Contains all DBs
│   ├── index.db         # Cloned from Beeper
│   ├── megabridge.db    # Cloned from Beeper (WhatsApp)
│   ├── account.db       # Cloned from Beeper
│   ├── export.sqlite    # Normalized export
│   └── clean.duckdb     # AI-friendly tables
```

## Programmatic Usage

Import query functions in other scripts:

```ts
import {
  getContacts,
  getThreads,
  getMessages,
  searchText,
  getConversation,
  getConversationById  // Preferred for DMs
} from './query.ts';

// Get threads (includes thread_id)
const threads = await getThreads();

// Get conversation by thread_id (preferred - always unique)
const msgs = await getConversationById(threads[0].thread_id);

// Get conversation by name (only for uniquely named threads)
const familyChat = await getConversation('Small family');

// Search returns thread_id for each result
const results = await searchText('meeting tomorrow');
```

## Tauri Integration

This package is used by the LifeOS Tauri app. The Rust commands in `beeper.rs` shell out to `bun query.ts`:

- `get_beeper_threads` - Returns threads with `thread_id`
- `get_beeper_conversation_by_id` - Fetches conversation by `thread_id` (preferred)
- `get_beeper_conversation` - Fetches conversation by name (legacy)
- `search_beeper_messages` - Search results include `thread_id`
