# Product Requirements Document (PRD)  
**Product Name:** YouTube Transcripts Sync → Convex + Clerk  
**Internal Codename:** TubeVault  
**Target User:** You (and anyone with private YouTube playlists who wants transcripts in Convex in real time)  
**Platform:** macOS 14+ (Intel + Apple Silicon) native menu-bar app  
**Launch Goal:** < 2 hours from zero to fully working personal app  

### 1. Objective  
A tiny, beautiful, native macOS menu-bar app that:  
- Authenticates with your personal Google/YouTube account (OAuth)  
- Continuously watches your chosen YouTube playlists (including private & unlisted)  
- Downloads new video transcripts (auto or manual captions)  
- Pushes them instantly into your Convex backend (with Clerk user context)  
- Shows sync status and lets you trigger manual syncs  

All of this runs 100 % locally, no Docker, no server, no browser extension.

### 2. Core Features (MVP – shippable in one afternoon)

| Priority | Feature                              | Description                                                                                   | Implementation notes |
|---------|--------------------------------------|-----------------------------------------------------------------------------------------------|----------------------|
| 1       | Menu-bar icon (status item)            | Always visible in macOS menu bar with YouTube-style icon (or film)                             | Platypus → Status Menu |
| 1       | Dropdown menu                        | • Sync Now  <br>• Last sync: 14:32  <br>• Open Convex Dashboard  <br>• —  <br>• Settings…  <br>• Quit | Platypus menu editor + dynamic updates |
| 1       | One-click manual sync                | Clicking “Sync Now” immediately runs the full sync                                            | Platypus menu item → rerun script |
| 1       | Automatic background sync            | Every 30 min (configurable)                                                          | Platypus “Remain running” + NSTimer via small AppleScript/Platypus trick |
| 1       | Full YouTube → Convex sync           | Uses yt-dlp for transcripts + Convex Python client                                            | Pure Python script |
| 1       | Clerk-aware user context             | Automatically adds `clerkUserId` and `clerkOrgId` (if any) to every transcript row            | Read from Convex auth token stored locally |
| 2       | Settings window (native-looking)     | Simple UI to:  <br>• Add/remove playlist IDs  <br>• Set sync interval  <br>• Re-authenticate Google  <br>• Test Convex connection | Platypus → “Droplet” mode + bundled PySide6 / Toga / tkinter window |
| 2       | Real-time sync log in Settings       | Scrollable text box showing what was just downloaded                                          | Python → stdout captured by Platypus → shown in settings window |
| 3       | Notification when new transcripts arrive | macOS UserNotification “3 new transcripts saved”                                        | Python → `osascript -e 'display notification ...'` |

### 3. Non-Goals (for v1)
- No multi-account support  
- No Windows/Linux versions  
- No public distribution (personal tool)  
- No App Store notarization needed  

### 4. Technical Implementation Plan (100 % Platypus-based)

| Component               | Tool / Library                              | Reason |
|-------------------------|---------------------------------------------|--------|
| App wrapper & menu bar  | Platypus 5.5+                                       | Native menu-bar support, zero code |
| Python runtime          | System python3.12 or Homebrew python@3.12           | Already on every modern Mac |
| YouTube transcripts     | yt-dlp (2025 version)                               | Best caption downloader, works on private videos |
| Google OAuth            | google-auth-oauthlib (InstalledAppFlow)             | First run opens browser, then silent |
| Convex + Clerk          | convex python client + convex-auth token parsing    | You already know how |
| Settings UI             | PySide6 (Qt) or Toga – bundled inside the .app      | Looks native, tiny binary (~25 MB total) |
| Icon                    | SF Symbols “film” or custom red YouTube play button | Template mode for dark/light auto-switch |

### 5. Folder Structure of the final .app

```
YouTubeToConvex.app/
└── Contents/
    ├── MacOS/
    │   └── youtube_to_convex.py          # main script
    ├── Resources/
    │   ├── script.ptpl                   # Platypus project (optional)
    │   ├── credentials.json              # Google OAuth credentials
    │   ├── icon.icns
    │   └── venv/ (or site-packages)      # PySide6 + convex + yt-dlp
    └── Info.plist
```

### 6. Exact User Flows

1. First launch  
   → Menu-bar icon appears  
   → User clicks → Settings…  
   → Settings window opens → clicks “Sign in with Google” → browser opens → grants access  
   → Token saved in `~/Library/Application Support/YouTubeToConvex/`

2. Normal usage  
   → Every 30 min or on “Sync Now” → script runs silently  
   → New transcripts appear in Convex table `youtubeTranscripts` with `clerkUserId`

3. Manual override  
   → Click menu-bar icon → “Sync Now” → progress shown in Settings window

### 7. Success Metrics (for you)
- < 2 hours from reading this PRD to first successful sync  
- App size < 60 MB  
- Zero crashes after a week of running 24/7  
- You never have to think about YouTube transcripts again

I can send you the complete ready-to-go package tomorrow morning:  
- Platypus project file (.platypus)  
- Full Python script with Clerk-aware  
- Bundled PySide6 settings window  
- Icon pack  
- One-click build instructions  

Just say the word and I’ll zip it up for you.