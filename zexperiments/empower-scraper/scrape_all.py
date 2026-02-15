"""
Empower Retirement Scraper using Patchright (no CDP, no extra args).

Usage:
  # Launch browser, log in, scrape — all in one script
  PYENV_VERSION=3.12.10 uv run python scrape_all.py

  # Scrape without syncing to Convex
  PYENV_VERSION=3.12.10 uv run python scrape_all.py --no-sync
"""
import asyncio
import csv
import json
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from patchright.async_api import async_playwright

SCRIPT_DIR = Path(__file__).parent
USER_DATA_DIR = str(SCRIPT_DIR / "user_data")
OUTPUT_DIR = SCRIPT_DIR / "output"
EMPOWER_LOGIN = "https://participant.empower-retirement.com/participant/#/login"
EMPOWER_HOME = "https://participant.empower-retirement.com/dashboard/#/user/home"

# Possible net-worth analysis pages on Empower dashboard
NET_WORTH_URLS = [
    "https://participant.empower-retirement.com/dashboard/#/analysis/net-worth",
    "https://participant.empower-retirement.com/dashboard/#/net-worth",
    "https://participant.empower-retirement.com/dashboard/#/user/net-worth",
    "https://participant.empower-retirement.com/dashboard/#/networth",
]

# Collect API responses that might contain historical data
_api_captures: list[dict] = []


async def wait_for_text(page, text, timeout=30):
    """Poll until page body contains text."""
    for _ in range(timeout * 2):
        try:
            found = await page.evaluate(
                f"document.body && document.body.innerText.includes('{text}')"
            )
            if found:
                return True
        except Exception:
            pass
        await asyncio.sleep(0.5)
    return False


async def get_accounts(page):
    """Parse all account entries from the overview page."""
    return await page.evaluate("""
        () => {
            const buttons = document.querySelectorAll('button');
            const accounts = [];
            const seen = new Set();
            for (const btn of buttons) {
                const text = btn.textContent.trim();
                // Skip Reconnect accounts — they have stale data
                if (text.includes('Reconnect')) continue;
                // Match accounts: 3-4 digit number + "• Xh/m/d ago"
                const match = text.match(/(\\d{3,4})\\s*•\\s*(\\d+[mhd]?)\\s*ago/);
                if (match) {
                    const accountNum = match[1];
                    if (seen.has(accountNum)) continue;
                    seen.add(accountNum);
                    const lines = text.split('\\n').map(l => l.trim()).filter(Boolean);
                    const institution = lines[0] || '';
                    const balanceMatch = text.match(/\\$([\\d,]+(?:\\.\\d{2})?)/);
                    const balance = balanceMatch ? balanceMatch[0] : '$0';
                    accounts.push({ institution, accountNum, balance, buttonText: text.substring(0, 80) });
                }
            }
            return accounts;
        }
    """)


async def click_account(page, account):
    """Click an account button by matching its text content."""
    account_num = account["accountNum"]
    institution = account["institution"]
    return await page.evaluate(f"""
        () => {{
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {{
                const text = btn.textContent;
                if (text.includes('{account_num}') && text.includes('ago') && text.includes('{institution}')) {{
                    btn.click();
                    return true;
                }}
            }}
            // Fallback: match by account number only
            for (const btn of buttons) {{
                const text = btn.textContent;
                if (text.includes('{account_num}') && text.includes('ago')) {{
                    btn.click();
                    return true;
                }}
            }}
            return false;
        }}
    """)


async def scrape_account(page, account):
    """Click account, wait for detail, extract transactions."""
    clicked = await click_account(page, account)
    if not clicked:
        print(f"  Could not click {account['accountNum']}, skipping")
        return None

    await asyncio.sleep(3)

    acct_num = account["accountNum"]
    inst = account["institution"].replace("'", "\\'")
    detail = await page.evaluate(f"""
        () => {{
            const text = document.body.innerText;
            // Try multiple patterns to find the account title
            let accountTitle = '';
            const patterns = [
                /([\\w\\s]+ - Ending in {acct_num})/,
                /({inst}[\\s\\S]{{0,50}}?{acct_num})/,
            ];
            for (const p of patterns) {{
                const m = text.match(p);
                if (m) {{ accountTitle = m[1]; break; }}
            }}
            if (!accountTitle) accountTitle = '{inst} {acct_num}';

            const searchIdx = text.indexOf('Search transactions');
            if (searchIdx === -1) return {{ accountTitle, rawSection: '', hasTransactions: false }};

            const totalIdx = text.indexOf('\\nTotal\\n', searchIdx);
            const legalIdx = text.indexOf('Legal disclosures');
            const endIdx = totalIdx !== -1 ? totalIdx + 50 : (legalIdx !== -1 ? legalIdx : searchIdx + 8000);
            const rawSection = text.substring(searchIdx, endIdx);
            const hasTransactions = !rawSection.includes('No transactions found');

            return {{ accountTitle, rawSection, hasTransactions }};
        }}
    """)

    if not detail.get("hasTransactions"):
        return {"accountTitle": detail.get("accountTitle", ""), "transactions": []}

    transactions = parse_transactions(detail.get("rawSection", ""))
    return {"accountTitle": detail.get("accountTitle", ""), "transactions": transactions}


def parse_transactions(raw_text):
    lines = [l.strip() for l in raw_text.split("\n") if l.strip()]
    transactions = []
    is_investment = "Action" in lines and "Quantity" in lines

    header_idx = -1
    for i, line in enumerate(lines):
        if line == "Date":
            header_idx = i
            break
    if header_idx == -1:
        return transactions

    headers = []
    for i in range(header_idx, len(lines)):
        if re.match(r"^\d{1,2}/\d{1,2}/\d{4}$", lines[i]):
            break
        headers.append(lines[i])
    col_count = len(headers)

    i = header_idx + col_count
    while i < len(lines) and not re.match(r"^\d{1,2}/\d{1,2}/\d{4}$", lines[i]):
        i += 1

    while i < len(lines):
        date_match = re.match(r"^(\d{1,2}/\d{1,2}/\d{4})$", lines[i])
        if date_match:
            row = {"date": date_match.group(1)}
            if is_investment:
                row["action"] = lines[i + 1] if i + 1 < len(lines) else ""
                row["description"] = lines[i + 2] if i + 2 < len(lines) else ""
                row["category"] = lines[i + 3] if i + 3 < len(lines) else ""
                row["quantity"] = lines[i + 4] if i + 4 < len(lines) else ""
                row["price"] = lines[i + 5] if i + 5 < len(lines) else ""
                remaining = []
                for j in range(i + 6, min(i + 9, len(lines))):
                    if re.match(r"^\d{1,2}/\d{1,2}/\d{4}$", lines[j]):
                        break
                    if lines[j] == "Total":
                        break
                    remaining.append(lines[j])
                row["amount"] = remaining[-1] if remaining else ""
            else:
                row["description"] = lines[i + 1] if i + 1 < len(lines) else ""
                row["category"] = lines[i + 2] if i + 2 < len(lines) else ""
                remaining = []
                for j in range(i + 3, min(i + 6, len(lines))):
                    if re.match(r"^\d{1,2}/\d{1,2}/\d{4}$", lines[j]):
                        break
                    if lines[j] == "Total":
                        break
                    remaining.append(lines[j])
                row["amount"] = remaining[-1] if remaining else ""
            transactions.append(row)
            i += max(col_count, 4)
        elif lines[i] == "Total":
            break
        else:
            i += 1

    return transactions


def save_csv(transactions, filepath, is_investment=False):
    if not transactions:
        return
    fieldnames = (
        ["date", "action", "description", "category", "quantity", "price", "amount"]
        if is_investment
        else ["date", "description", "category", "amount"]
    )
    with open(filepath, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(transactions)


def setup_response_interceptor(page):
    """Intercept API responses that might contain net worth / history data."""

    async def on_response(response):
        url = response.url.lower()
        # Look for API calls containing history, networth, aggregate, or chart data
        keywords = [
            "history", "networth", "net_worth", "net-worth",
            "aggregate", "chart", "timeline", "balance",
            "gethistorical", "getnetworth", "getsnapshot",
            "performance", "portfolio",
        ]
        if not any(kw in url for kw in keywords):
            return
        if response.status != 200:
            return
        content_type = response.headers.get("content-type", "")
        if "json" not in content_type and "javascript" not in content_type:
            return
        try:
            body = await response.json()
            _api_captures.append({
                "url": response.url,
                "status": response.status,
                "data": body,
                "capturedAt": time.time(),
            })
            print(f"  [API Capture] {response.url[:100]}")
        except Exception:
            pass

    page.on("response", on_response)


async def extract_net_worth_from_page(page) -> dict:
    """Extract the current net worth value from the dashboard page text."""
    return await page.evaluate("""
        () => {
            const text = document.body.innerText;
            const nwIdx = text.indexOf('NET WORTH');
            if (nwIdx === -1) return { found: false };
            const section = text.substring(nwIdx, nwIdx + 300);
            const match = section.match(/\\$([\\ \\d,]+(?:\\.\\d{2})?)/);
            return {
                found: true,
                netWorthText: match ? match[0] : null,
                section: section.substring(0, 200),
            };
        }
    """)


async def scrape_net_worth_history(page) -> dict:
    """Try to navigate to net worth analysis pages and extract historical data."""
    result = {
        "currentNetWorth": await extract_net_worth_from_page(page),
        "apiCaptures": list(_api_captures),
        "historyPoints": [],
        "scrapedAt": int(time.time() * 1000),
    }

    # Extract history from any captured API responses
    for capture in _api_captures:
        data = capture.get("data")
        if not isinstance(data, (dict, list)):
            continue

        # Recursively look for arrays that look like time series
        candidates = []
        if isinstance(data, list):
            candidates.append(("root", data))
        elif isinstance(data, dict):
            for key, val in data.items():
                if isinstance(val, list) and len(val) >= 3:
                    candidates.append((key, val))

        for key, arr in candidates:
            # Check if items look like date/value pairs
            if not all(isinstance(item, dict) for item in arr[:5]):
                continue
            sample = arr[0]
            # Common field names for date/value in finance APIs
            date_keys = {"date", "dateTime", "timestamp", "time", "x", "period", "day"}
            value_keys = {"value", "amount", "balance", "netWorth", "y", "total"}
            has_date = any(k in sample for k in date_keys)
            has_value = any(k in sample for k in value_keys)
            if has_date and has_value:
                result["historyPoints"] = arr
                print(f"  [Net Worth History] Found {len(arr)} data points from key '{key}'")
                break
        if result["historyPoints"]:
            break

    # Try navigating to net worth analysis pages
    home_url = page.url
    for url in NET_WORTH_URLS:
        try:
            print(f"  Trying net worth page: {url}")
            await page.goto(url, wait_until="domcontentloaded", timeout=15000)
            await asyncio.sleep(5)

            # Check if we landed on a useful page
            has_content = await page.evaluate(
                "document.body && (document.body.innerText.includes('NET WORTH') || document.body.innerText.includes('Net Worth'))"
            )
            if not has_content:
                continue

            print(f"  [Net Worth Page] Found content at {url}")

            # Wait a bit more for chart data API calls to fire
            await asyncio.sleep(3)

            # Try to extract any chart/table data from this page
            page_data = await page.evaluate("""
                () => {
                    const text = document.body.innerText;

                    // Look for tabular data: dates and dollar amounts
                    const datePattern = /\\d{1,2}\\/\\d{1,2}\\/\\d{4}/g;
                    const dates = text.match(datePattern) || [];

                    // Look for dollar values near the dates
                    const moneyPattern = /\\$[\\d,]+(?:\\.\\d{2})?/g;
                    const values = text.match(moneyPattern) || [];

                    return {
                        url: window.location.href,
                        textSnippet: text.substring(0, 2000),
                        datesFound: dates.slice(0, 20),
                        valuesFound: values.slice(0, 20),
                    };
                }
            """)
            result["netWorthPage"] = page_data

            # Check for new API captures that fired on this page
            result["apiCaptures"] = list(_api_captures)
            break

        except Exception as e:
            print(f"  [Net Worth Page] Failed: {e}")
            continue

    # Navigate back to home for account scraping continuity
    try:
        await page.goto(home_url, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(3)
    except Exception:
        pass

    return result


async def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Empower Retirement Scraper (Patchright)")
    print("=" * 40)

    async with async_playwright() as p:
        browser = await p.chromium.launch_persistent_context(
            user_data_dir=USER_DATA_DIR,
            channel="chrome",
            headless=False,
            no_viewport=True,
            args=["--start-maximized"],
        )

        page = browser.pages[0] if browser.pages else await browser.new_page()

        # Set up API response interceptor to capture net worth history data
        setup_response_interceptor(page)

        # Hide Chrome immediately (macOS) — hidden apps still render
        await asyncio.sleep(1)
        if sys.platform == "darwin":
            try:
                subprocess.run([
                    "osascript", "-e",
                    'tell application "System Events" to set visible of process "Google Chrome" to false'
                ], timeout=5, capture_output=True)
                print("Chrome hidden.")
            except Exception:
                pass

        # Navigate to Empower login page
        print("Navigating to Empower...")
        await page.goto(EMPOWER_LOGIN, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(5)
        url = page.url

        if "login" in url:
            print("\nOn login page. Handling login...")

            try:
                # Step 1: Dismiss the maintenance modal (z=1050, "Next" button in modal-footer)
                # This modal may have multiple pages, keep clicking Next/Dismiss until gone
                for _ in range(5):
                    try:
                        modal_footer = page.locator(".modal-footer button")
                        if await modal_footer.count() > 0:
                            btn_text = await modal_footer.first.inner_text()
                            await modal_footer.first.click()
                            print(f"  Modal: clicked '{btn_text.strip()}'")
                            await asyncio.sleep(1)
                        else:
                            break
                    except Exception:
                        break

                # Step 2: Accept cookies banner (z=2147483645)
                try:
                    accept_cookies = page.locator("button", has_text="Accept cookies")
                    if await accept_cookies.count() > 0:
                        await accept_cookies.click()
                        print("  Clicked 'Accept cookies'")
                        await asyncio.sleep(1)
                except Exception:
                    pass

                # Step 3: Click username field to trigger Chrome autofill
                username_input = page.locator('input[name="usernameInput"]')
                await username_input.click()
                await asyncio.sleep(2)

                # Click password field to trigger autofill
                password_input = page.locator('input[name="passwordInput"]')
                await password_input.click()
                await asyncio.sleep(2)

                uval = await username_input.input_value()
                pval = await password_input.input_value()
                print(f"  Username: {'filled' if uval else 'empty'}")
                print(f"  Password: {'filled' if pval else 'empty'}")

                if not uval or not pval:
                    print("\n  Credentials not filled. Please log in manually.")
                    print("  Waiting for dashboard (up to 2 min)...")
                    await wait_for_text(page, "NET WORTH", timeout=120)
                else:
                    # Step 4: Click Sign In
                    sign_in = page.locator("button", has_text="Sign In")
                    await sign_in.click()
                    print("  Clicked Sign In...")
                    await asyncio.sleep(8)

            except Exception as e:
                print(f"  Login error: {e}")
                print("  Please log in manually. Waiting for dashboard...")
                await wait_for_text(page, "NET WORTH", timeout=120)

        # Wait for dashboard
        print("Waiting for dashboard...")
        loaded = await wait_for_text(page, "NET WORTH", timeout=30)
        if not loaded:
            # Maybe need to navigate to home
            await page.goto(EMPOWER_HOME, wait_until="domcontentloaded", timeout=60000)
            loaded = await wait_for_text(page, "NET WORTH", timeout=30)

        if not loaded:
            print("ERROR: Dashboard did not load.")
            await browser.close()
            return

        print("Dashboard loaded!\n")

        # Wait a moment for any chart API calls to complete
        await asyncio.sleep(3)

        # Scrape net worth history before clicking into accounts
        print("Scraping net worth history...")
        nw_history = await scrape_net_worth_history(page)
        nw_history_path = OUTPUT_DIR / "net_worth_history.json"
        with open(nw_history_path, "w") as f:
            json.dump(nw_history, f, indent=2, default=str)
        n_points = len(nw_history.get("historyPoints", []))
        n_captures = len(nw_history.get("apiCaptures", []))
        print(f"  History: {n_points} data points, {n_captures} API captures")
        print(f"  Saved: {nw_history_path.name}\n")

        # Make sure we're back on the dashboard for account scraping
        loaded = await wait_for_text(page, "NET WORTH", timeout=15)
        if not loaded:
            await page.goto(EMPOWER_HOME, wait_until="domcontentloaded", timeout=60000)
            await wait_for_text(page, "NET WORTH", timeout=15)

        # Scrape accounts
        accounts = await get_accounts(page)
        print(f"Found {len(accounts)} accounts:")
        for a in accounts:
            print(f"  - {a['institution']} ...{a['accountNum']} ({a['balance']})")

        all_data = []
        for account in accounts:
            print(f"\nScraping {account['institution']} ...{account['accountNum']}...")
            result = await scrape_account(page, account)
            if not result:
                continue

            txns = result["transactions"]
            is_investment = any(t.get("action") for t in txns)
            print(f"  {len(txns)} transactions")

            if txns:
                inst_clean = re.sub(r"[^a-zA-Z0-9]", "_", account["institution"]).strip("_")
                safe_name = f"{inst_clean}_{account['accountNum']}"
                csv_path = OUTPUT_DIR / f"{safe_name}.csv"
                save_csv(txns, csv_path, is_investment)
                print(f"  Saved: {csv_path.name}")

            all_data.append({
                "institution": account["institution"],
                "accountNum": account["accountNum"],
                "accountTitle": result["accountTitle"],
                "balance": account["balance"],
                "transactions": txns,
            })
            await asyncio.sleep(1)

        # Save combined
        json_path = OUTPUT_DIR / "all_accounts.json"
        with open(json_path, "w") as f:
            json.dump(all_data, f, indent=2)
        print(f"\nSaved: {json_path.name}")

        summary_path = OUTPUT_DIR / "summary.csv"
        with open(summary_path, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["institution", "account_num", "account_title", "balance", "transaction_count"])
            for d in all_data:
                writer.writerow([d["institution"], d["accountNum"], d["accountTitle"], d["balance"], len(d["transactions"])])
        print(f"Saved: {summary_path.name}")

        total_txns = sum(len(d["transactions"]) for d in all_data)
        print(f"\nDone! {len(all_data)} accounts, {total_txns} total transactions.")

        await browser.close()

        # Sync to Convex unless --no-sync flag is passed
        if "--no-sync" not in sys.argv:
            try:
                from sync_to_convex import sync_to_convex, clean_account

                cleaned = [clean_account(a) for a in all_data]
                sync_to_convex(cleaned)
            except Exception as e:
                print(f"\nConvex sync failed: {e}")
                print("Data was saved locally. Run sync_to_convex.py manually.")
        else:
            print("\nSkipping Convex sync (--no-sync flag).")


if __name__ == "__main__":
    asyncio.run(main())
