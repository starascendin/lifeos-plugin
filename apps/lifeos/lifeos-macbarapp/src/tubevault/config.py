"""
Configuration Manager for TubeVault

Handles loading/saving configuration from:
~/Library/Application Support/TubeVault/
"""

import json
import os
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional


# Application Support directory
APP_SUPPORT_DIR = Path.home() / "Library" / "Application Support" / "TubeVault"
CONFIG_FILE = APP_SUPPORT_DIR / "config.json"
CLERK_AUTH_FILE = APP_SUPPORT_DIR / "clerk_auth.json"


@dataclass
class ClerkAuth:
    """Clerk authentication configuration"""
    secret_key: str = ""
    session_id: str = ""


@dataclass
class Config:
    """Main application configuration"""
    # Convex settings
    convex_url: str = ""

    # Playlist IDs to sync
    playlist_ids: list[str] = field(default_factory=list)

    # Sync interval in minutes
    sync_interval_minutes: int = 30

    # Last sync timestamp
    last_sync_timestamp: Optional[float] = None

    # Transcript language preference (e.g., "en", "es", "auto")
    preferred_language: str = "auto"


def ensure_config_dir() -> None:
    """Ensure the config directory exists with proper permissions"""
    APP_SUPPORT_DIR.mkdir(parents=True, exist_ok=True)
    # Set directory permissions to user-only (700)
    os.chmod(APP_SUPPORT_DIR, 0o700)


def load_config() -> Config:
    """Load configuration from disk"""
    ensure_config_dir()

    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r") as f:
                data = json.load(f)
            return Config(**data)
        except (json.JSONDecodeError, TypeError) as e:
            print(f"Error loading config: {e}")
            return Config()

    return Config()


def save_config(config: Config) -> None:
    """Save configuration to disk"""
    ensure_config_dir()

    with open(CONFIG_FILE, "w") as f:
        json.dump(asdict(config), f, indent=2)


def load_clerk_auth() -> ClerkAuth:
    """Load Clerk authentication from disk"""
    ensure_config_dir()

    if CLERK_AUTH_FILE.exists():
        try:
            with open(CLERK_AUTH_FILE, "r") as f:
                data = json.load(f)
            return ClerkAuth(**data)
        except (json.JSONDecodeError, TypeError) as e:
            print(f"Error loading Clerk auth: {e}")
            return ClerkAuth()

    return ClerkAuth()


def save_clerk_auth(auth: ClerkAuth) -> None:
    """Save Clerk authentication to disk with secure permissions"""
    ensure_config_dir()

    with open(CLERK_AUTH_FILE, "w") as f:
        json.dump(asdict(auth), f, indent=2)

    # Set file permissions to user-only read/write (600)
    os.chmod(CLERK_AUTH_FILE, 0o600)


def is_configured() -> bool:
    """Check if the app is properly configured"""
    config = load_config()
    auth = load_clerk_auth()

    return bool(
        config.convex_url and
        auth.secret_key and
        auth.session_id
    )


def add_playlist(playlist_id: str) -> None:
    """Add a playlist ID to sync"""
    config = load_config()
    if playlist_id not in config.playlist_ids:
        config.playlist_ids.append(playlist_id)
        save_config(config)


def remove_playlist(playlist_id: str) -> None:
    """Remove a playlist ID from sync"""
    config = load_config()
    if playlist_id in config.playlist_ids:
        config.playlist_ids.remove(playlist_id)
        save_config(config)


def update_last_sync() -> None:
    """Update the last sync timestamp"""
    import time
    config = load_config()
    config.last_sync_timestamp = time.time()
    save_config(config)


def get_last_sync_formatted() -> str:
    """Get the last sync time as a formatted string"""
    config = load_config()
    if config.last_sync_timestamp is None:
        return "Never"

    from datetime import datetime
    dt = datetime.fromtimestamp(config.last_sync_timestamp)
    return dt.strftime("%H:%M")
