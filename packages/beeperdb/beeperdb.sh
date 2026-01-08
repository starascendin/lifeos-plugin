#!/usr/bin/env bash
set -euo pipefail

# beeperdb.sh
#
# This script helps you:
# - clone Beeper local SQLite DBs (read-only snapshots via sqlite .backup)
# - export a normalized local dataset (accounts/threads/participants/messages)
#
# Note: This directory contains highly sensitive personal data.
# `packages/beeperdb/data/` is gitignored; avoid copying exports elsewhere.

beeperdb_script_dir() {
  local src="${BASH_SOURCE[0]}"
  while [[ -L "$src" ]]; do
    src="$(readlink "$src")"
  done
  cd -P "$(dirname "$src")" >/dev/null 2>&1
  pwd
}

beeperdb_default_data_dir() {
  printf '%s' "$(beeperdb_script_dir)/data"
}

beeperdb_usage() {
  cat <<'USAGE'
beeperdb.sh

Commands:
  clone
    Clone WhatsApp-related DB(s) from BeeperTexts into an output folder.
    (Creates read-only snapshots via sqlite .backup.)

    Flags:
      --source <dir>    BeeperTexts dir (default: $BEEPER_TEXTS_DIR or ~/Library/Application Support/BeeperTexts)
      --out <dir>       Output dir (default: ./data next to this script)
      --no-index        Don't clone index.db

  clone-all
    Like clone, but also clones account.db.

    Flags:
      --source <dir>
      --out <dir>

  export
    Build a normalized export SQLite DB from cloned DBs.

    Flags:
      --data-dir <dir>  Data dir containing index.db/megabridge.db[/account.db] (default: ./data next to this script)
      --out <path>      Output export DB path (default: <data-dir>/export.sqlite)

  sync
    clone-all into data-dir and then export.

    Flags:
      --source <dir>
      --data-dir <dir>
      --out <path>

  latest50
    Print latest WhatsApp messages (by timestamp) from an index.db as JSON.

    Flags:
      --db <path>       Path to index.db (default: <data-dir>/index.db)
      --limit <n>       Max rows (default: 50)
      --include-hidden  Include rows where type='HIDDEN'

Examples:
  ./beeperdb.sh clone
  ./beeperdb.sh clone-all
  ./beeperdb.sh export
  ./beeperdb.sh sync
  ./beeperdb.sh latest50 --limit 10
USAGE
}

beeperdb_default_source_dir() {
  if [[ -n "${BEEPER_TEXTS_DIR:-}" ]]; then
    printf '%s' "$BEEPER_TEXTS_DIR"
  else
    printf '%s' "$HOME/Library/Application Support/BeeperTexts"
  fi
}

beeperdb_require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    return 1
  fi
}

beeperdb_sql_escape_squotes() {
  # Escape single quotes for embedding inside single-quoted SQLite strings.
  # (SQLite uses '' to represent a literal '. )
  local s="$1"
  printf '%s' "${s//"'"/"''"}"
}

beeperdb_sqlite_backup() {
  local source_uri="$1"
  local dest_path="$2"

  beeperdb_require_cmd sqlite3
  mkdir -p "$(dirname "$dest_path")"

  # Use sqlite's .backup for a consistent snapshot. Source is opened read-only.
  local dest_escaped
  dest_escaped="$(beeperdb_sql_escape_squotes "$dest_path")"
  sqlite3 "$source_uri" ".backup '$dest_escaped'" >/dev/null
}

# Utility: clone WhatsApp DB(s) into outDir.
# - clones: local-whatsapp/megabridge.db -> <outDir>/megabridge.db
# - clones (optional): index.db -> <outDir>/index.db
beeperdb_clone_whatsapp_dbs() {
  local beeper_texts_dir="${1:-$(beeperdb_default_source_dir)}"
  local out_dir="${2:-$(beeperdb_default_data_dir)}"
  local clone_index="${3:-1}"

  local src_whatsapp_db="$beeper_texts_dir/local-whatsapp/megabridge.db"
  local src_index_db="$beeper_texts_dir/index.db"

  local dest_whatsapp_db="$out_dir/megabridge.db"
  local dest_index_db="$out_dir/index.db"

  if [[ ! -f "$src_whatsapp_db" ]]; then
    echo "Missing source WhatsApp DB: $src_whatsapp_db" >&2
    return 1
  fi

  beeperdb_sqlite_backup "file:$src_whatsapp_db?mode=ro" "$dest_whatsapp_db"
  echo "Cloned WhatsApp DB -> $dest_whatsapp_db" >&2

  if [[ "$clone_index" == "1" ]]; then
    if [[ ! -f "$src_index_db" ]]; then
      echo "Missing source index DB: $src_index_db" >&2
      return 1
    fi
    beeperdb_sqlite_backup "file:$src_index_db?mode=ro" "$dest_index_db"
    echo "Cloned index DB -> $dest_index_db" >&2
  fi
}

# Utility: clone account.db into outDir.
beeperdb_clone_account_db() {
  local beeper_texts_dir="${1:-$(beeperdb_default_source_dir)}"
  local out_dir="${2:-$(beeperdb_default_data_dir)}"

  local src_account_db="$beeper_texts_dir/account.db"
  local dest_account_db="$out_dir/account.db"

  if [[ ! -f "$src_account_db" ]]; then
    echo "Missing source account DB: $src_account_db" >&2
    return 1
  fi

  beeperdb_sqlite_backup "file:$src_account_db?mode=ro" "$dest_account_db"
  echo "Cloned account DB -> $dest_account_db" >&2
}

# Utility: emit latest WhatsApp messages from index.db as JSON.
# Args: <indexDbPath> [limit] [includeHidden(0/1)]
beeperdb_latest_whatsapp_messages_json() {
  local index_db_path="$1"
  local limit="${2:-50}"
  local include_hidden="${3:-0}"

  beeperdb_require_cmd sqlite3

  if [[ ! -f "$index_db_path" ]]; then
    echo "Missing index DB: $index_db_path" >&2
    return 1
  fi

  if ! [[ "$limit" =~ ^[0-9]+$ ]]; then
    echo "Invalid --limit: $limit" >&2
    return 1
  fi
  if (( limit < 1 )); then limit=1; fi
  if (( limit > 1000 )); then limit=1000; fi

  local where="json_extract(message,'$.threadID') LIKE '%local-whatsapp%'"
  if [[ "$include_hidden" != "1" ]]; then
    where+=" AND type != 'HIDDEN'"
  fi

  sqlite3 -readonly -json "$index_db_path" \
    "SELECT eventID, roomID, senderContactID, timestamp, type,\
            json_extract(message,'$.threadID') AS threadID,\
            json_extract(message,'$.senderID') AS senderID,\
            json_extract(message,'$.text') AS text,\
            message\
       FROM mx_room_messages\
      WHERE $where\
      ORDER BY timestamp DESC\
      LIMIT $limit;"
}

beeperdb_export_sqlite() {
  local data_dir="$1"
  local out_path="$2"

  beeperdb_require_cmd sqlite3

  local index_db="$data_dir/index.db"
  local wa_db="$data_dir/megabridge.db"
  local acct_db="$data_dir/account.db"

  if [[ ! -f "$index_db" ]]; then
    echo "Missing $index_db (run ./beeperdb.sh clone-all or point --data-dir correctly)" >&2
    return 1
  fi

  local tmp="${out_path}.tmp.$$"
  rm -f "$tmp"
  mkdir -p "$(dirname "$out_path")"

  local idx_path_sql wa_path_sql acct_path_sql
  idx_path_sql="$(beeperdb_sql_escape_squotes "$index_db")"
  wa_path_sql="$(beeperdb_sql_escape_squotes "$wa_db")"
  acct_path_sql="$(beeperdb_sql_escape_squotes "$acct_db")"

  {
    echo "PRAGMA journal_mode=WAL;"
    echo "PRAGMA synchronous=NORMAL;"
    echo "PRAGMA foreign_keys=ON;"

    echo "CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT);"
    echo "INSERT OR REPLACE INTO meta(key,value) VALUES ('exported_at', strftime('%Y-%m-%dT%H:%M:%fZ','now'));"
    echo "INSERT OR REPLACE INTO meta(key,value) VALUES ('source_index_db', '$idx_path_sql');"

    echo "ATTACH '$idx_path_sql' AS idx;"

    # Optional attachments
    if [[ -f "$wa_db" ]]; then
      echo "ATTACH '$wa_path_sql' AS wa;"
      echo "INSERT OR REPLACE INTO meta(key,value) VALUES ('source_whatsapp_db', '$wa_path_sql');"
    fi

    if [[ -f "$acct_db" ]]; then
      echo "ATTACH '$acct_path_sql' AS acct;"
      echo "INSERT OR REPLACE INTO meta(key,value) VALUES ('source_account_db', '$acct_path_sql');"
    fi

    # Normalized tables.
    cat <<'SQL'
CREATE TABLE IF NOT EXISTS accounts_index(
  accountID TEXT PRIMARY KEY,
  platformName TEXT,
  state TEXT,
  user_json TEXT,
  session_json TEXT,
  props_json TEXT
);

CREATE TABLE IF NOT EXISTS accounts_local_bridge_state(
  bridge_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  state TEXT NOT NULL,
  updated_ts INTEGER,
  errcode TEXT,
  error TEXT,
  PRIMARY KEY (bridge_id, account_id)
);

CREATE TABLE IF NOT EXISTS accounts_bridge_account_states(
  bridge_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  state_data_json TEXT NOT NULL,
  debouncing_since TEXT,
  PRIMARY KEY (bridge_id, account_id)
);

CREATE TABLE IF NOT EXISTS threads(
  threadID TEXT PRIMARY KEY,
  accountID TEXT,
  timestamp INTEGER,
  protocol TEXT,
  bridge_name TEXT,
  title TEXT,
  thread_type TEXT,
  unreadCount INTEGER,
  raw_thread_json TEXT
);

CREATE TABLE IF NOT EXISTS participants(
  threadID TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  account_id TEXT,
  full_name TEXT,
  nickname TEXT,
  img_url TEXT,
  is_self INTEGER,
  is_network_bot INTEGER,
  is_admin INTEGER,
  cannot_message INTEGER,
  is_pending INTEGER,
  has_exited INTEGER,
  added_by TEXT,
  raw_participant_json TEXT,
  PRIMARY KEY (threadID, participant_id)
);

CREATE TABLE IF NOT EXISTS participant_identifiers(
  account_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL,
  PRIMARY KEY (account_id, participant_id, identifier)
);

CREATE TABLE IF NOT EXISTS messages(
  eventID TEXT PRIMARY KEY,
  threadID TEXT,
  roomID TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  type TEXT NOT NULL,
  senderContactID TEXT NOT NULL,
  senderID TEXT,
  text TEXT,
  isSentByMe INTEGER,
  isDeleted INTEGER,
  isEncrypted INTEGER,
  raw_message_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_thread_ts ON messages(threadID, timestamp DESC);

CREATE TABLE IF NOT EXISTS whatsapp_portals(
  mxid TEXT PRIMARY KEY,
  portal_id TEXT,
  receiver TEXT,
  other_user_id TEXT,
  room_type TEXT,
  name TEXT,
  topic TEXT,
  avatar_mxc TEXT,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS whatsapp_logins(
  bridge_id TEXT NOT NULL,
  id TEXT NOT NULL,
  user_mxid TEXT NOT NULL,
  remote_name TEXT,
  remote_profile_json TEXT,
  metadata_json TEXT,
  PRIMARY KEY (bridge_id, id)
);

CREATE TABLE IF NOT EXISTS whatsapp_contacts(
  our_jid TEXT NOT NULL,
  their_jid TEXT NOT NULL,
  first_name TEXT,
  full_name TEXT,
  push_name TEXT,
  business_name TEXT,
  redacted_phone TEXT,
  PRIMARY KEY (our_jid, their_jid)
);
SQL

    # Fill from idx.
    cat <<'SQL'
INSERT OR REPLACE INTO accounts_index(accountID, platformName, state, user_json, session_json, props_json)
  SELECT accountID, platformName, state, user, session, props FROM idx.accounts;

INSERT OR REPLACE INTO threads(threadID, accountID, timestamp, protocol, bridge_name, title, thread_type, unreadCount, raw_thread_json)
  SELECT
    threadID,
    accountID,
    COALESCE(timestamp, 0),
    json_extract(thread, '$.extra.protocol') AS protocol,
    json_extract(thread, '$.extra.bridge."com.beeper.bridge_name"') AS bridge_name,
    COALESCE(
      json_extract(thread, '$.title'),
      json_extract(thread, '$.name'),
      json_extract(thread, '$.description')
    ) AS title,
    json_extract(thread, '$.type') AS thread_type,
    json_extract(thread, '$.unreadCount') AS unreadCount,
    thread
  FROM idx.threads;

INSERT OR REPLACE INTO participants(
  threadID, participant_id, account_id, full_name, nickname, img_url, is_self, is_network_bot, is_admin,
  cannot_message, is_pending, has_exited, added_by, raw_participant_json
)
  SELECT
    room_id,
    id,
    account_id,
    full_name,
    nickname,
    img_url,
    is_self,
    is_network_bot,
    is_admin,
    cannot_message,
    is_pending,
    has_exited,
    added_by,
    json_object(
      'account_id', account_id,
      'room_id', room_id,
      'id', id,
      'full_name', full_name,
      'nickname', nickname,
      'img_url', img_url,
      'is_verified', is_verified,
      'cannot_message', cannot_message,
      'is_self', is_self,
      'is_network_bot', is_network_bot,
      'added_by', added_by,
      'is_admin', is_admin,
      'is_pending', is_pending,
      'has_exited', has_exited
    )
  FROM idx.participants;

INSERT OR REPLACE INTO participant_identifiers(account_id, participant_id, identifier, identifier_type)
  SELECT account_id, participant_id, identifier, identifier_type
  FROM idx.participant_identifiers;

INSERT OR REPLACE INTO messages(
  eventID, threadID, roomID, timestamp, type, senderContactID, senderID, text,
  isSentByMe, isDeleted, isEncrypted, raw_message_json
)
  SELECT
    eventID,
    json_extract(message, '$.threadID') AS threadID,
    roomID,
    timestamp,
    type,
    senderContactID,
    json_extract(message, '$.senderID') AS senderID,
    json_extract(message, '$.text') AS text,
    isSentByMe,
    isDeleted,
    isEncrypted,
    message
  FROM idx.mx_room_messages;
SQL

    # Optional fills.
    if [[ -f "$wa_db" ]]; then
      cat <<'SQL'
INSERT OR REPLACE INTO whatsapp_portals(mxid, portal_id, receiver, other_user_id, room_type, name, topic, avatar_mxc, metadata_json)
  SELECT
    mxid,
    id,
    receiver,
    other_user_id,
    room_type,
    name,
    topic,
    avatar_mxc,
    metadata
  FROM wa.portal
  WHERE mxid IS NOT NULL AND mxid != '';

INSERT OR REPLACE INTO whatsapp_logins(bridge_id, id, user_mxid, remote_name, remote_profile_json, metadata_json)
  SELECT bridge_id, id, user_mxid, remote_name, remote_profile, metadata FROM wa.user_login;

INSERT OR REPLACE INTO whatsapp_contacts(our_jid, their_jid, first_name, full_name, push_name, business_name, redacted_phone)
  SELECT our_jid, their_jid, first_name, full_name, push_name, business_name, redacted_phone FROM wa.whatsmeow_contacts;
SQL
    fi

    if [[ -f "$acct_db" ]]; then
      cat <<'SQL'
INSERT OR REPLACE INTO accounts_local_bridge_state(bridge_id, account_id, state, updated_ts, errcode, error)
  SELECT bridge_id, account_id, state, updated_ts, errcode, error FROM acct.local_bridge_state;

INSERT OR REPLACE INTO accounts_bridge_account_states(bridge_id, account_id, state_data_json, debouncing_since)
  SELECT bridge_id, account_id, state_data, debouncing_since FROM acct.bridge_account_states;
SQL
    fi

    echo "DETACH idx;"
    if [[ -f "$wa_db" ]]; then echo "DETACH wa;"; fi
    if [[ -f "$acct_db" ]]; then echo "DETACH acct;"; fi
  } | sqlite3 "$tmp" >/dev/null

  mv -f "$tmp" "$out_path"
  echo "Exported -> $out_path" >&2

  # quick sanity stats
  sqlite3 -readonly "$out_path" \
    "SELECT 'threads' AS k, count(*) AS n FROM threads
      UNION ALL SELECT 'participants', count(*) FROM participants
      UNION ALL SELECT 'messages', count(*) FROM messages
      UNION ALL SELECT 'wa_portals', count(*) FROM whatsapp_portals
      UNION ALL SELECT 'wa_contacts', count(*) FROM whatsapp_contacts
      UNION ALL SELECT 'accounts_index', count(*) FROM accounts_index
      UNION ALL SELECT 'bridge_states', count(*) FROM accounts_local_bridge_state;" \
    | sed 's/^/[export] /' >&2
}

beeperdb_cmd_clone() {
  local source_dir=""
  local out_dir="$(beeperdb_default_data_dir)"
  local no_index=0

  while (( $# )); do
    case "$1" in
      --source) source_dir="$2"; shift 2 ;;
      --out) out_dir="$2"; shift 2 ;;
      --no-index) no_index=1; shift ;;
      -h|--help) beeperdb_usage; return 0 ;;
      *) echo "Unknown flag: $1" >&2; return 2 ;;
    esac
  done

  local clone_index=1
  if (( no_index == 1 )); then clone_index=0; fi

  beeperdb_clone_whatsapp_dbs "${source_dir:-}" "$out_dir" "$clone_index"
}

beeperdb_cmd_clone_all() {
  local source_dir=""
  local out_dir="$(beeperdb_default_data_dir)"

  while (( $# )); do
    case "$1" in
      --source) source_dir="$2"; shift 2 ;;
      --out) out_dir="$2"; shift 2 ;;
      -h|--help) beeperdb_usage; return 0 ;;
      *) echo "Unknown flag: $1" >&2; return 2 ;;
    esac
  done

  beeperdb_clone_whatsapp_dbs "${source_dir:-}" "$out_dir" 1
  beeperdb_clone_account_db "${source_dir:-}" "$out_dir"
}

beeperdb_cmd_export() {
  local data_dir="$(beeperdb_default_data_dir)"
  local out_path=""

  while (( $# )); do
    case "$1" in
      --data-dir) data_dir="$2"; shift 2 ;;
      --out) out_path="$2"; shift 2 ;;
      -h|--help) beeperdb_usage; return 0 ;;
      *) echo "Unknown flag: $1" >&2; return 2 ;;
    esac
  done

  if [[ -z "$out_path" ]]; then
    out_path="$data_dir/export.sqlite"
  fi

  beeperdb_export_sqlite "$data_dir" "$out_path"
}

beeperdb_cmd_sync() {
  local source_dir=""
  local data_dir="$(beeperdb_default_data_dir)"
  local out_path=""

  while (( $# )); do
    case "$1" in
      --source) source_dir="$2"; shift 2 ;;
      --data-dir) data_dir="$2"; shift 2 ;;
      --out) out_path="$2"; shift 2 ;;
      -h|--help) beeperdb_usage; return 0 ;;
      *) echo "Unknown flag: $1" >&2; return 2 ;;
    esac
  done

  mkdir -p "$data_dir"
  beeperdb_clone_whatsapp_dbs "${source_dir:-}" "$data_dir" 1
  beeperdb_clone_account_db "${source_dir:-}" "$data_dir"

  if [[ -z "$out_path" ]]; then
    out_path="$data_dir/export.sqlite"
  fi
  beeperdb_export_sqlite "$data_dir" "$out_path"
}

beeperdb_cmd_latest50() {
  local data_dir="$(beeperdb_default_data_dir)"
  local db_path=""
  local limit=50
  local include_hidden=0

  while (( $# )); do
    case "$1" in
      --data-dir) data_dir="$2"; shift 2 ;;
      --db) db_path="$2"; shift 2 ;;
      --limit) limit="$2"; shift 2 ;;
      --include-hidden) include_hidden=1; shift ;;
      -h|--help) beeperdb_usage; return 0 ;;
      *) echo "Unknown flag: $1" >&2; return 2 ;;
    esac
  done

  if [[ -z "$db_path" ]]; then
    db_path="$data_dir/index.db"
  fi

  beeperdb_latest_whatsapp_messages_json "$db_path" "$limit" "$include_hidden"
}

# If sourced, don't run the CLI.
if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
  return 0
fi

cmd="${1:-}"
shift || true
case "$cmd" in
  clone) beeperdb_cmd_clone "$@" ;;
  clone-all) beeperdb_cmd_clone_all "$@" ;;
  export) beeperdb_cmd_export "$@" ;;
  sync) beeperdb_cmd_sync "$@" ;;
  latest50) beeperdb_cmd_latest50 "$@" ;;
  -h|--help|help|"") beeperdb_usage ;;
  *) echo "Unknown command: $cmd" >&2; beeperdb_usage; exit 2 ;;
esac
