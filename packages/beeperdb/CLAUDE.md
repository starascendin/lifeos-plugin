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
pnpm q contacts [search]     # List contacts (optional name filter)
pnpm q threads [search]      # List threads with message counts
pnpm q messages <name>       # Get messages by contact/thread name
pnpm q search <text>         # Search message text content
pnpm q convo "<thread_name>" # Full conversation by exact thread name
```

### Examples

```bash
pnpm q messages alex         # Messages involving "alex"
pnpm q threads family        # Threads with "family" in name
pnpm q search "meeting"      # Messages containing "meeting"
pnpm q convo "Small family"  # All messages in exact thread
```

## Direct DuckDB Queries

For complex queries, use duckdb directly:

```bash
duckdb data/clean.duckdb "SELECT * FROM threads ORDER BY message_count DESC LIMIT 10"
duckdb data/clean.duckdb "SELECT sender, text FROM conversations WHERE thread_name = 'Small family' ORDER BY timestamp"
```

### Available Tables in clean.duckdb

| Table | Description |
|-------|-------------|
| `contacts` | WhatsApp contacts (name, phone, is_business) |
| `threads` | Threads with stats (name, type, participant_count, message_count) |
| `messages` | Last 100 messages per thread (thread_name, sender_name, text, timestamp) |
| `conversations` | Same as messages but only non-empty text, good for AI |
| `thread_summaries` | Thread overview with last message preview |

## Exporting for AI

```bash
# Export to JSON
duckdb data/clean.duckdb "COPY conversations TO 'data/conversations.json' (FORMAT JSON)"

# Export specific thread
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
import { getMessages, searchText, getContacts, getThreads } from './query.ts';

const msgs = await getMessages('alex');
const results = await searchText('meeting tomorrow');
```
