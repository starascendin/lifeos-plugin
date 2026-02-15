# Empower Retirement Scraper — Patchright Setup Instructions

## Overview

This scraper uses **Patchright** (a Playwright fork) to bypass Cloudflare's bot detection on the Empower Retirement dashboard. It launches a real Chrome browser, logs in using Chrome's saved autofill credentials, and scrapes transaction data from all linked accounts.

## Critical Version Requirement

**You MUST use patchright `1.52.5`.** This is the last version that properly suppresses the "Chrome is being controlled by automated test software" infobar and related automation flags.

- **patchright 1.52.5** — works, no automation banner, bypasses Cloudflare Turnstile
- **patchright 1.58.0+** — BROKEN, reintroduces "controlled by test software" banner, Cloudflare blocks it

The version is pinned in `pyproject.toml` and locked in `uv.lock`. Do NOT upgrade.

## Prerequisites

1. **Python 3.12+** (tested with 3.12.10 and 3.13)
2. **uv** (Python package manager) — `brew install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`
3. **Google Chrome** installed at the system default path (the scraper uses `channel="chrome"`)
4. Your Empower login credentials saved in Chrome's autofill (the scraper clicks the username/password fields to trigger Chrome autofill)

## Setup

```bash
cd zexperiments/empower-scraper

# Create venv and install dependencies (patchright 1.52.5 pinned)
uv sync

# Install patchright's bundled Chromium (only needed once)
uv run python -m patchright install
```

## Launch Configuration — DO NOT CHANGE

The browser MUST be launched with exactly these settings:

```python
browser = await p.chromium.launch_persistent_context(
    user_data_dir=USER_DATA_DIR,  # absolute path to ./user_data
    channel="chrome",              # use system Chrome, NOT bundled Chromium
    headless=False,                # headless WILL be blocked by Cloudflare
    no_viewport=True,              # let Chrome manage its own viewport
    args=["--start-maximized"],    # safe display arg, not automation-related
    # DO NOT add any of these:
    # - args=["--remote-debugging-port=..."]  ← triggers Cloudflare
    # - args=["--no-sandbox"]                 ← triggers automation detection
    # - args=["--disable-blink-features=..."] ← unnecessary, may trigger
    # - user_agent="..."                      ← triggers fingerprint mismatch
    # - extra_http_headers={...}              ← triggers fingerprint mismatch
)
```

### Why each setting matters

| Setting | Why |
|---------|-----|
| `channel="chrome"` | Uses the real system Chrome binary. Bundled Chromium has a different fingerprint that Cloudflare may flag. |
| `headless=False` | Cloudflare Turnstile blocks headless browsers entirely. There is no workaround. |
| `no_viewport=True` | Lets Chrome manage its own window size naturally, avoiding viewport-based detection. |
| `args=["--start-maximized"]` | Safe display flag. Do NOT use `--window-size` with small values — the dashboard may not render "NET WORTH" text properly in small viewports, breaking detection. |
| `user_data_dir` | **Must be an absolute path.** Stores the Chrome profile (cookies, autofill, sessions). All scripts MUST use the same `user_data_dir` to share the login session. |
| No `--remote-debugging-port` | CDP args are detected by Cloudflare. |
| No `--no-sandbox` | Triggers the "controlled by test software" infobar. |
| No custom `user_agent` | Mismatches between the UA header and the browser's actual navigator.userAgent trigger Cloudflare. |

### Hiding Chrome on macOS

The scraper hides Chrome immediately after launch using macOS `osascript`:

```python
subprocess.run([
    "osascript", "-e",
    'tell application "System Events" to set visible of process "Google Chrome" to false'
], timeout=5, capture_output=True)
```

This is equivalent to Cmd+H. macOS hidden apps **still render normally** — Cloudflare's JS challenges, page interactions, and scraping all work while Chrome is invisible. The browser flashes for ~1 second on launch, then disappears.

**Do NOT use `headless=True` instead** — Cloudflare blocks headless mode entirely. The osascript hide is the correct way to run non-intrusively.

## Scripts

### `scrape_all.py` — Main scraper
Logs in, scrapes all accounts, saves CSVs + JSON.

```bash
uv run python scrape_all.py
```

Output goes to `./output/`:
- `{institution}_{accountNum}.csv` — per-account transaction CSV
- `all_accounts.json` — combined JSON of all accounts
- `summary.csv` — one-row-per-account summary

### `launch_browser.py` — Inspect mode
Logs in, keeps browser open for manual inspection.

```bash
uv run python launch_browser.py
```

To close: `touch ./STOP` or Ctrl+C.

### `inspect_dashboard.py` — Dashboard structure dump
One-off script to dump account structure and inspect the page. Logs in, prints all account categories and clickable buttons, then keeps browser open.

```bash
uv run python inspect_dashboard.py
```

## Login Flow

The Empower login page has 3 layers that must be dismissed in order:

1. **Maintenance modal** (z-index 1050) — `.modal-footer button` — click "Next" then "Dismiss"
2. **Cookie consent banner** (z-index 2147483645) — button with text "Accept cookies"
3. **Login form** — `input[name="usernameInput"]` and `input[name="passwordInput"]`

The scraper:
1. Clicks the modal buttons until they're gone
2. Clicks "Accept cookies" if present
3. Clicks the username field, waits 2s (triggers Chrome autofill)
4. Clicks the password field, waits 2s
5. If both fields are filled, clicks "Sign In"
6. If not filled, falls back to waiting for manual login (up to 2 min)

## Account Detection

Accounts are identified by scanning all `<button>` elements for text matching the pattern:
```
/{3,4 digit number} • {time} ago/
```

Accounts with "Reconnect" in their text are **skipped** (they have stale/broken connections).

The scraper handles both:
- **Banking accounts** (Cash, Credit Cards): date, description, category, amount
- **Investment accounts**: date, action, description, category, quantity, price, amount

## Troubleshooting

### "Chrome is being controlled by automated test software"
You are NOT on patchright 1.52.5. Check:
```bash
uv run python -c "import patchright; print(patchright.__version__)"
```
Must be `1.52.5`. If not, delete `.venv` and re-run `uv sync`.

### Stuck on Cloudflare "Just a moment..."
- Make sure `headless=False` (headless is always blocked, use osascript hide instead)
- Make sure you're NOT passing automation-related `args` (`--remote-debugging-port`, `--no-sandbox`, etc.)
- `--start-maximized` is safe to pass
- Make sure `channel="chrome"` (not Chromium)
- Delete `user_data/` and try fresh

### Credentials not autofilled
- First time: log in manually once. Chrome will offer to save credentials.
- Make sure all scripts use the SAME absolute `user_data_dir` path.
- If using a fresh `user_data/`, you'll need to log in manually and save credentials again.

### `user_data` path mismatch
All scripts define:
```python
SCRIPT_DIR = Path(__file__).parent
USER_DATA_DIR = str(SCRIPT_DIR / "user_data")
```
This is an absolute path derived from the script's location. **Never use relative paths** like `"./user_data"` — that resolves based on `cwd`, not the script directory.
