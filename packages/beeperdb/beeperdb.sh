#!/usr/bin/env bash
set -euo pipefail

# Usage (CLI):
#   ./beeperdb.sh clone [--source <BeeperTextsDir>] [--out <outDir>] [--no-index]
#   ./beeperdb.sh latest50 [--db <indexDbPath>] [--limit N] [--include-hidden]
#
# Usage (as utilities):
#   source ./beeperdb.sh
#   beeperdb_clone_whatsapp_dbs "/path/to/BeeperTexts" "./data"
#   beeperdb_latest_whatsapp_messages_json "./data/index.db" 50

beeperdb_usage() {
  cat <<'USAGE'
beeperdb.sh

Commands:
  clone
    Clone WhatsApp-related SQLite DB(s) from BeeperTexts into an output folder.

    Flags:
      --source <dir>    BeeperTexts dir (default: $BEEPER_TEXTS_DIR or ~/Library/Application Support/BeeperTexts)
      --out <dir>       Output dir (default: ./data)
      --no-index        Don't clone index.db

  latest50
    Print latest WhatsApp messages (by timestamp) as JSON.

    Flags:
      --db <path>       Path to index.db (default: ./data/index.db)
      --limit <n>       Max rows (default: 50)
      --include-hidden  Include rows where type='HIDDEN'

Examples:
  ./beeperdb.sh clone
  ./beeperdb.sh latest50 --db "/Users/$USER/Library/Application Support/BeeperTexts/index.db" --limit 10
USAGE
}

beeperdb_default_source_dir() {
  if [[ -n "${BEEPER_TEXTS_DIR:-}" ]]; then
    printf '%s' "$BEEPER_TEXTS_DIR"
  else
    printf '%s' "$HOME/Library/Application Support/BeeperTexts"
  fi
}

beeperdb_sqlite_backup() {
  local source_uri="$1"
  local dest_path="$2"

  mkdir -p "$(dirname "$dest_path")"

  # Use sqlite's .backup for a consistent snapshot. Source is opened read-only.
  # Note: sqlite3 expects single quotes inside the command; escape any single quotes in paths.
  local dest_escaped=${dest_path//"'"/"''"}
  sqlite3 "$source_uri" ".backup '$dest_escaped'" >/dev/null
}

# Utility: clone WhatsApp DB(s) into outDir.
# - clones: local-whatsapp/megabridge.db
# - clones (optional, recommended): index.db (needed for plaintext message queries)
beeperdb_clone_whatsapp_dbs() {
  local beeper_texts_dir="${1:-$(beeperdb_default_source_dir)}"
  local out_dir="${2:-./data}"
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

# Utility: emit latest WhatsApp messages from index.db as JSON.
# Args: <indexDbPath> [limit] [includeHidden(0/1)]
beeperdb_latest_whatsapp_messages_json() {
  local index_db_path="$1"
  local limit="${2:-50}"
  local include_hidden="${3:-0}"

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

beeperdb_cmd_clone() {
  local source_dir=""
  local out_dir="./data"
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

beeperdb_cmd_latest50() {
  local db_path="./data/index.db"
  local limit=50
  local include_hidden=0

  while (( $# )); do
    case "$1" in
      --db) db_path="$2"; shift 2 ;;
      --limit) limit="$2"; shift 2 ;;
      --include-hidden) include_hidden=1; shift ;;
      -h|--help) beeperdb_usage; return 0 ;;
      *) echo "Unknown flag: $1" >&2; return 2 ;;
    esac
  done

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
  latest50) beeperdb_cmd_latest50 "$@" ;;
  -h|--help|help|"") beeperdb_usage ;;
  *) echo "Unknown command: $cmd" >&2; beeperdb_usage; exit 2 ;;
esac
