#!/usr/bin/env python3
"""
TubeVault - YouTube Transcripts Menu Bar App

Main entry point for Platypus Status Menu integration.

Platypus Status Menu Protocol:
- Print menu items to stdout, one per line
- Items starting with "DISABLED|" are grayed out
- Empty lines create separators
- Script is re-run when user clicks a menu item, with item text as argument
- "STATUSTITLE|text" sets the menu bar title
- "NOTIFICATION|text" shows a macOS notification
"""

import sys
import subprocess
import threading
import time
from datetime import datetime

from .config import (
    load_config,
    is_configured,
    get_last_sync_formatted,
    update_last_sync,
)


# Global flag for sync in progress
_sync_in_progress = False


def show_notification(title: str, message: str) -> None:
    """Show a macOS notification"""
    script = f'''
    display notification "{message}" with title "{title}"
    '''
    subprocess.run(["osascript", "-e", script], capture_output=True)


def print_menu() -> None:
    """Print the menu items for Platypus"""
    config = load_config()
    configured = is_configured()
    last_sync = get_last_sync_formatted()

    # Status title (icon in menu bar)
    # Using a simple text indicator - Platypus will use the app icon
    print("STATUSTITLE|▶")

    # Sync Now
    if configured and not _sync_in_progress:
        print("Sync Now")
    elif _sync_in_progress:
        print("DISABLED|Syncing...")
    else:
        print("DISABLED|Sync Now (not configured)")

    # Last sync time
    print(f"DISABLED|Last sync: {last_sync}")

    # Separator
    print("")

    # Playlist count
    playlist_count = len(config.playlist_ids)
    print(f"DISABLED|Playlists: {playlist_count}")

    # Separator
    print("")

    # Settings
    print("Settings...")

    # Separator
    print("")

    # Quit
    print("Quit")


def handle_menu_action(action: str) -> None:
    """Handle a menu action selected by the user"""
    global _sync_in_progress

    if action == "Sync Now":
        run_sync()

    elif action == "Settings...":
        open_settings()

    elif action == "Quit":
        sys.exit(0)


def run_sync() -> None:
    """Run the sync process"""
    global _sync_in_progress

    if _sync_in_progress:
        return

    _sync_in_progress = True
    print("STATUSTITLE|⟳")  # Spinning indicator

    try:
        from .convex_sync import full_sync, AuthenticationError

        def progress_callback(msg: str):
            # Log to stderr so it doesn't interfere with Platypus menu
            print(msg, file=sys.stderr)

        stats = full_sync(progress_callback=progress_callback)

        # Show completion notification
        if stats["errors"]:
            show_notification(
                "TubeVault Sync",
                f"Completed with {len(stats['errors'])} errors. "
                f"{stats['transcripts_synced']} transcripts synced."
            )
        else:
            show_notification(
                "TubeVault Sync",
                f"Synced {stats['transcripts_synced']} transcripts from "
                f"{stats['playlists_synced']} playlists."
            )

    except Exception as e:
        show_notification("TubeVault Error", str(e))
        print(f"Sync error: {e}", file=sys.stderr)

    finally:
        _sync_in_progress = False
        print("STATUSTITLE|▶")


def open_settings() -> None:
    """Open the settings window"""
    # Import here to avoid circular imports and loading tkinter until needed
    from .settings_ui import open_settings_window
    open_settings_window()


def run_background_timer() -> None:
    """
    Run background timer for automatic syncing.

    This runs in a separate thread and triggers syncs at the configured interval.
    """
    while True:
        config = load_config()
        interval_seconds = config.sync_interval_minutes * 60

        # Wait for the interval
        time.sleep(interval_seconds)

        # Check if configured and not already syncing
        if is_configured() and not _sync_in_progress:
            print("Starting automatic sync...", file=sys.stderr)
            run_sync()


def main() -> None:
    """Main entry point"""
    # Check if we're being called with an action (menu item clicked)
    if len(sys.argv) > 1:
        action = " ".join(sys.argv[1:])
        handle_menu_action(action)
    else:
        # First run - print menu and start background timer
        print_menu()

        # Start background sync timer in a daemon thread
        timer_thread = threading.Thread(target=run_background_timer, daemon=True)
        timer_thread.start()

        # Keep the script running (Platypus "Remain running" mode)
        # The menu will be updated by Platypus calling us again
        try:
            while True:
                time.sleep(60)  # Check every minute
                # Refresh menu periodically
                print_menu()
        except KeyboardInterrupt:
            sys.exit(0)


if __name__ == "__main__":
    main()
