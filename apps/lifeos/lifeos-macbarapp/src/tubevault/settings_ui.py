"""
Settings UI for TubeVault

Simple tkinter-based settings window for configuration.
"""

import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import threading
import webbrowser

from .config import (
    load_config,
    save_config,
    load_clerk_auth,
    save_clerk_auth,
    Config,
    ClerkAuth,
)


class SettingsWindow:
    """Settings window for TubeVault configuration"""

    def __init__(self):
        self.root = tk.Tk()
        self.root.title("TubeVault Settings")
        self.root.geometry("500x600")
        self.root.resizable(True, True)

        # Load current config
        self.config = load_config()
        self.clerk_auth = load_clerk_auth()

        # Create UI
        self._create_ui()

        # Center window on screen
        self.root.update_idletasks()
        width = self.root.winfo_width()
        height = self.root.winfo_height()
        x = (self.root.winfo_screenwidth() // 2) - (width // 2)
        y = (self.root.winfo_screenheight() // 2) - (height // 2)
        self.root.geometry(f"{width}x{height}+{x}+{y}")

    def _create_ui(self):
        """Create the settings UI"""
        # Main frame with padding
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Create notebook for tabs
        notebook = ttk.Notebook(main_frame)
        notebook.pack(fill=tk.BOTH, expand=True, pady=(0, 10))

        # Connection tab
        conn_frame = ttk.Frame(notebook, padding="10")
        notebook.add(conn_frame, text="Connection")
        self._create_connection_tab(conn_frame)

        # Playlists tab
        playlist_frame = ttk.Frame(notebook, padding="10")
        notebook.add(playlist_frame, text="Playlists")
        self._create_playlists_tab(playlist_frame)

        # Settings tab
        settings_frame = ttk.Frame(notebook, padding="10")
        notebook.add(settings_frame, text="Settings")
        self._create_settings_tab(settings_frame)

        # Log tab
        log_frame = ttk.Frame(notebook, padding="10")
        notebook.add(log_frame, text="Sync Log")
        self._create_log_tab(log_frame)

        # Buttons at bottom
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill=tk.X)

        ttk.Button(button_frame, text="Save", command=self._save).pack(side=tk.RIGHT, padx=5)
        ttk.Button(button_frame, text="Cancel", command=self.root.destroy).pack(side=tk.RIGHT)
        ttk.Button(button_frame, text="Test Connection", command=self._test_connection).pack(side=tk.LEFT)

    def _create_connection_tab(self, parent):
        """Create the connection settings tab"""
        # Convex URL
        ttk.Label(parent, text="Convex URL:").pack(anchor=tk.W)
        self.convex_url_var = tk.StringVar(value=self.config.convex_url)
        convex_entry = ttk.Entry(parent, textvariable=self.convex_url_var, width=50)
        convex_entry.pack(fill=tk.X, pady=(0, 10))
        ttk.Label(parent, text="e.g., https://example-lion-123.convex.cloud",
                  foreground="gray").pack(anchor=tk.W)

        ttk.Separator(parent, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=10)

        # Clerk Settings
        ttk.Label(parent, text="Clerk Secret Key:", font=("", 0, "bold")).pack(anchor=tk.W, pady=(10, 0))
        ttk.Label(parent, text="From Clerk Dashboard → API Keys",
                  foreground="gray").pack(anchor=tk.W)
        self.clerk_secret_var = tk.StringVar(value=self.clerk_auth.secret_key)
        secret_entry = ttk.Entry(parent, textvariable=self.clerk_secret_var, width=50, show="*")
        secret_entry.pack(fill=tk.X, pady=(5, 10))

        ttk.Label(parent, text="Clerk Session ID:", font=("", 0, "bold")).pack(anchor=tk.W)
        ttk.Label(parent, text="From browser DevTools: Application → Cookies → __session",
                  foreground="gray").pack(anchor=tk.W)
        self.clerk_session_var = tk.StringVar(value=self.clerk_auth.session_id)
        session_entry = ttk.Entry(parent, textvariable=self.clerk_session_var, width=50)
        session_entry.pack(fill=tk.X, pady=(5, 10))

        # Help text
        help_text = """
How to get your Clerk Session ID:
1. Login to your HolaAI web app
2. Open browser DevTools (F12 or Cmd+Option+I)
3. Go to Application → Cookies → your domain
4. Find "__session" cookie and copy its value
        """
        ttk.Label(parent, text=help_text, foreground="gray", justify=tk.LEFT).pack(anchor=tk.W, pady=10)

    def _create_playlists_tab(self, parent):
        """Create the playlists management tab"""
        ttk.Label(parent, text="YouTube Playlist IDs to sync:",
                  font=("", 0, "bold")).pack(anchor=tk.W)
        ttk.Label(parent, text="One playlist ID per line (e.g., PLxxxxxxx)",
                  foreground="gray").pack(anchor=tk.W, pady=(0, 5))

        # Playlist text area
        self.playlist_text = scrolledtext.ScrolledText(parent, height=10, width=50)
        self.playlist_text.pack(fill=tk.BOTH, expand=True, pady=5)
        self.playlist_text.insert(tk.END, "\n".join(self.config.playlist_ids))

        # Buttons
        btn_frame = ttk.Frame(parent)
        btn_frame.pack(fill=tk.X, pady=5)

        ttk.Button(btn_frame, text="Add from URL",
                   command=self._add_playlist_from_url).pack(side=tk.LEFT, padx=5)

    def _create_settings_tab(self, parent):
        """Create the general settings tab"""
        # Sync interval
        ttk.Label(parent, text="Sync Interval (minutes):",
                  font=("", 0, "bold")).pack(anchor=tk.W)
        self.interval_var = tk.StringVar(value=str(self.config.sync_interval_minutes))
        interval_frame = ttk.Frame(parent)
        interval_frame.pack(fill=tk.X, pady=5)
        interval_spinbox = ttk.Spinbox(
            interval_frame,
            from_=5,
            to=1440,
            textvariable=self.interval_var,
            width=10
        )
        interval_spinbox.pack(side=tk.LEFT)
        ttk.Label(interval_frame, text="(5-1440 min)").pack(side=tk.LEFT, padx=10)

        ttk.Separator(parent, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=10)

        # Preferred language
        ttk.Label(parent, text="Preferred Transcript Language:",
                  font=("", 0, "bold")).pack(anchor=tk.W)
        self.language_var = tk.StringVar(value=self.config.preferred_language)
        lang_frame = ttk.Frame(parent)
        lang_frame.pack(fill=tk.X, pady=5)

        languages = [
            ("Auto (any available)", "auto"),
            ("English", "en"),
            ("Spanish", "es"),
            ("Chinese", "zh"),
            ("Japanese", "ja"),
            ("Korean", "ko"),
        ]
        for text, value in languages:
            ttk.Radiobutton(
                lang_frame,
                text=text,
                variable=self.language_var,
                value=value
            ).pack(anchor=tk.W)

    def _create_log_tab(self, parent):
        """Create the sync log tab"""
        ttk.Label(parent, text="Sync Log:", font=("", 0, "bold")).pack(anchor=tk.W)

        self.log_text = scrolledtext.ScrolledText(parent, height=20, width=50, state=tk.DISABLED)
        self.log_text.pack(fill=tk.BOTH, expand=True, pady=5)

        btn_frame = ttk.Frame(parent)
        btn_frame.pack(fill=tk.X, pady=5)

        ttk.Button(btn_frame, text="Clear Log",
                   command=self._clear_log).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="Run Sync Now",
                   command=self._run_sync).pack(side=tk.LEFT, padx=5)

    def _save(self):
        """Save settings and close"""
        try:
            # Validate interval
            interval = int(self.interval_var.get())
            if interval < 5 or interval > 1440:
                messagebox.showerror("Error", "Sync interval must be between 5 and 1440 minutes")
                return

            # Update config
            self.config.convex_url = self.convex_url_var.get().strip()
            self.config.sync_interval_minutes = interval
            self.config.preferred_language = self.language_var.get()

            # Parse playlist IDs
            playlist_text = self.playlist_text.get("1.0", tk.END).strip()
            self.config.playlist_ids = [
                line.strip()
                for line in playlist_text.split("\n")
                if line.strip()
            ]

            # Update Clerk auth
            self.clerk_auth.secret_key = self.clerk_secret_var.get().strip()
            self.clerk_auth.session_id = self.clerk_session_var.get().strip()

            # Save
            save_config(self.config)
            save_clerk_auth(self.clerk_auth)

            messagebox.showinfo("Success", "Settings saved successfully!")
            self.root.destroy()

        except ValueError as e:
            messagebox.showerror("Error", f"Invalid value: {e}")

    def _test_connection(self):
        """Test the Convex connection"""
        # Save current values first
        self.config.convex_url = self.convex_url_var.get().strip()
        self.clerk_auth.secret_key = self.clerk_secret_var.get().strip()
        self.clerk_auth.session_id = self.clerk_session_var.get().strip()
        save_config(self.config)
        save_clerk_auth(self.clerk_auth)

        from .convex_sync import test_connection

        success, message = test_connection()

        if success:
            messagebox.showinfo("Connection Test", message)
        else:
            messagebox.showerror("Connection Test", message)

    def _add_playlist_from_url(self):
        """Add a playlist ID from a URL"""
        url = tk.simpledialog.askstring(
            "Add Playlist",
            "Enter YouTube playlist URL or ID:"
        )
        if url:
            # Extract playlist ID from URL
            playlist_id = url
            if "list=" in url:
                import re
                match = re.search(r"list=([a-zA-Z0-9_-]+)", url)
                if match:
                    playlist_id = match.group(1)

            # Add to text area
            current = self.playlist_text.get("1.0", tk.END).strip()
            if current:
                self.playlist_text.insert(tk.END, f"\n{playlist_id}")
            else:
                self.playlist_text.insert(tk.END, playlist_id)

    def _clear_log(self):
        """Clear the sync log"""
        self.log_text.config(state=tk.NORMAL)
        self.log_text.delete("1.0", tk.END)
        self.log_text.config(state=tk.DISABLED)

    def _log(self, message: str):
        """Add a message to the log"""
        self.log_text.config(state=tk.NORMAL)
        self.log_text.insert(tk.END, f"{message}\n")
        self.log_text.see(tk.END)
        self.log_text.config(state=tk.DISABLED)
        self.root.update()

    def _run_sync(self):
        """Run a sync from the UI"""
        # Save settings first
        self._save_without_close()

        self._log("Starting sync...")

        def sync_thread():
            try:
                from .convex_sync import full_sync

                stats = full_sync(progress_callback=self._log)

                self._log(f"\nSync complete!")
                self._log(f"  Playlists: {stats['playlists_synced']}")
                self._log(f"  Videos: {stats['videos_synced']}")
                self._log(f"  Transcripts: {stats['transcripts_synced']}")

                if stats["errors"]:
                    self._log(f"  Errors: {len(stats['errors'])}")
                    for err in stats["errors"]:
                        self._log(f"    - {err}")

            except Exception as e:
                self._log(f"Sync failed: {e}")

        # Run in background thread
        thread = threading.Thread(target=sync_thread, daemon=True)
        thread.start()

    def _save_without_close(self):
        """Save settings without closing the window"""
        try:
            interval = int(self.interval_var.get())
            self.config.convex_url = self.convex_url_var.get().strip()
            self.config.sync_interval_minutes = interval
            self.config.preferred_language = self.language_var.get()

            playlist_text = self.playlist_text.get("1.0", tk.END).strip()
            self.config.playlist_ids = [
                line.strip()
                for line in playlist_text.split("\n")
                if line.strip()
            ]

            self.clerk_auth.secret_key = self.clerk_secret_var.get().strip()
            self.clerk_auth.session_id = self.clerk_session_var.get().strip()

            save_config(self.config)
            save_clerk_auth(self.clerk_auth)

        except ValueError:
            pass  # Ignore validation errors during auto-save

    def run(self):
        """Run the settings window"""
        self.root.mainloop()


def open_settings_window():
    """Open the settings window"""
    # Import simpledialog for the playlist URL input
    import tkinter.simpledialog

    window = SettingsWindow()
    window.run()


if __name__ == "__main__":
    open_settings_window()
