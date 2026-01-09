# Beeper DB Notes

## What the “Beeper application dir” is

On macOS, Beeper Desktop stores its local app data (Electron/Chromium profile + local databases) under:

- `~/Library/Application Support/BeeperTexts`

This is not the app’s source code; it’s runtime state, caches, logs, media, and SQLite databases.

## Which files store what

The important SQLite databases in `~/Library/Application Support/BeeperTexts` are:

- `index.db`: the UI-facing “index” of conversations and messages (fast queries + search).
  - Conversations: `threads` table (thread JSON includes title, unread counts, protocol metadata).
  - Messages: `mx_room_messages` table (one row per message; `message` is JSON including `threadID`, `text`, etc).
  - Search: `mx_room_messages_fts*` full-text tables.
- `local-whatsapp/megabridge.db`: local WhatsApp bridge state.
  - Chat ↔ room mapping: `portal` (maps a WhatsApp chat to a Matrix room id `mxid`).
  - WhatsApp client state: `whatsmeow_*` tables.
  - History sync blobs: `whatsapp_history_sync_*` tables.
- `account.db`: Matrix client store + E2EE crypto material + sync state.
  - Contains very sensitive data (tokens/keys). Treat as secrets.

Other relevant storage:

- `local-whatsapp/attachments/`: WhatsApp-local attachment files.
- `media/`: general media cache.
- `logs/`, `worker-log.log`: useful for seeing which “bridge/platform workers” are running and what they’re doing.

Note: depending on configuration, some platforms (e.g. iMessage) may not be fully represented in `index.db` and can rely on platform-specific workers / system stores.

## What `packages/beeperdb` scripts do

This package provides a small bash utility to snapshot and normalize Beeper data locally:

- `./beeperdb.sh clone`: clone `megabridge.db` + `index.db` into `./data/` using SQLite `.backup`.
- `./beeperdb.sh clone-all`: same as `clone` plus `account.db`.
- `./beeperdb.sh export`: build `./data/export.sqlite` (normalized tables: accounts, threads, participants, messages, WhatsApp mappings).
- `./beeperdb.sh sync`: `clone-all` then `export`.
- `./beeperdb.sh latest50`: print latest WhatsApp messages as JSON from an `index.db`.

Outputs live in `./data/` (gitignored), including:

- `index.db`, `megabridge.db`, `account.db` (snapshots)
- `export.sqlite` (normalized export for downstream ingestion)
