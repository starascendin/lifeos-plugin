"""
Empower Retirement Scraper using Patchright (Cloudflare-bypassing Playwright fork).

Usage:
  # Step 1: Headed mode — log in manually, then press Enter to scrape
  python3 scrape_patchwright.py

  # Step 2: Headless mode — uses saved session from step 1
  python3 scrape_patchwright.py --headless
"""

import asyncio
import argparse
import csv
import json
import os
import re
from datetime import datetime
from pathlib import Path

from patchright.async_api import async_playwright

SCRIPT_DIR = Path(__file__).parent
USER_DATA_DIR = str(SCRIPT_DIR / "user_data")
OUTPUT_DIR = SCRIPT_DIR / "output"
EMPOWER_HOME = "https://participant.empower-retirement.com/dashboard/#/user/home"


async def wait_for_page_content(page, text, timeout=15000):
    """Wait until page body contains specific text."""
    try:
        await page.wait_for_function(
            f"document.body && document.body.innerText.includes('{text}')",
            timeout=timeout,
        )
        return True
    except Exception:
        return False


async def get_accounts(page):
    """Parse all account entries from the home/overview page."""
    return await page.evaluate("""
        () => {
            const buttons = document.querySelectorAll('button');
            const accounts = [];
            const seen = new Set();
            for (const btn of buttons) {
                const text = btn.textContent.trim();
                const match = text.match(/(\\d{4})\\s*•\\s*(\\d+[mhd]?)\\s*ago/);
                if (match) {
                    const accountNum = match[1];
                    if (seen.has(accountNum)) continue;
                    seen.add(accountNum);

                    const lines = text.split('\\n').map(l => l.trim()).filter(Boolean);
                    const institution = lines[0] || '';
                    const balanceMatch = text.match(/\\$([\\d,]+(?:\\.\\d{2})?)/);
                    const balance = balanceMatch ? balanceMatch[0] : '$0';

                    accounts.push({ institution, accountNum, balance });
                }
            }
            return accounts;
        }
    """)


async def click_account(page, account_num):
    """Click on an account button by its 4-digit identifier."""
    return await page.evaluate(f"""
        () => {{
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {{
                if (btn.textContent.includes('{account_num}') && btn.textContent.includes('ago')) {{
                    btn.click();
                    return true;
                }}
            }}
            return false;
        }}
    """)


async def scrape_account_transactions(page, account):
    """Scrape transactions from the currently visible account detail panel."""
    await asyncio.sleep(3)

    detail = await page.evaluate(f"""
        () => {{
            const text = document.body.innerText;

            // Get account title
            const titleMatch = text.match(/([\\w\\s]+ - Ending in {account['accountNum']})/);
            const accountTitle = titleMatch ? titleMatch[1] : '{account["institution"]} {account["accountNum"]}';

            // Find transaction section
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

    raw = detail.get("rawSection", "")
    account_title = detail.get("accountTitle", "")
    transactions = parse_transactions(raw)

    return {"accountTitle": account_title, "transactions": transactions}


def parse_transactions(raw_text):
    """Parse transaction text into structured data."""
    lines = [l.strip() for l in raw_text.split("\n") if l.strip()]
    transactions = []

    # Detect account type by headers
    is_investment = "Action" in lines and "Quantity" in lines

    # Find the header row
    header_idx = -1
    for i, line in enumerate(lines):
        if line == "Date":
            header_idx = i
            break

    if header_idx == -1:
        return transactions

    # Count headers
    headers = []
    for i in range(header_idx, len(lines)):
        if re.match(r"^\d{1,2}/\d{1,2}/\d{4}$", lines[i]):
            break
        headers.append(lines[i])

    col_count = len(headers)

    # Parse rows
    i = header_idx + col_count
    # Skip "Add transaction" if present
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
                # Find amount in remaining fields
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
                # Find amount
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
    """Save transactions to CSV."""
    if not transactions:
        return

    if is_investment:
        fieldnames = ["date", "action", "description", "category", "quantity", "price", "amount"]
    else:
        fieldnames = ["date", "description", "category", "amount"]

    with open(filepath, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(transactions)


async def main():
    parser = argparse.ArgumentParser(description="Empower Retirement Scraper")
    parser.add_argument("--headless", action="store_true", help="Run in headless mode (requires prior login)")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Empower Retirement Scraper (Patchright)")
    print("=" * 40)
    print(f"Mode: {'headless' if args.headless else 'headed'}")
    print(f"User data: {USER_DATA_DIR}\n")

    async with async_playwright() as p:
        browser = await p.chromium.launch_persistent_context(
            user_data_dir=USER_DATA_DIR,
            channel="chrome",
            headless=args.headless,
            no_viewport=not args.headless,
            viewport={"width": 1920, "height": 1080} if args.headless else None,
            # do NOT add custom browser headers or user_agent
        )

        # Get or create page
        if browser.pages:
            page = browser.pages[0]
        else:
            page = await browser.new_page()

        # Navigate to Empower
        print(f"Navigating to Empower...")
        await page.goto(EMPOWER_HOME, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(5)

        # Check current state
        current_url = page.url
        title = await page.title()
        print(f"URL: {current_url}")
        print(f"Title: {title}")

        if not args.headless:
            # In headed mode, wait for the dashboard to appear (user logs in)
            print("\nBrowser is open. Log in if needed.")
            print("Waiting for dashboard to appear (polling for NET WORTH text)...")
            for attempt in range(120):  # Wait up to ~4 minutes
                try:
                    has_content = await page.evaluate("document.body.innerText.includes('NET WORTH')")
                    if has_content:
                        print("Dashboard detected!")
                        break
                except Exception:
                    pass
                await asyncio.sleep(2)
            else:
                print("Timed out waiting for dashboard.")
                await browser.close()
                return
        else:
            # In headless mode, wait for content automatically
            print("Waiting for dashboard to render...")
            await asyncio.sleep(5)

        # Re-check the page after user says ready
        current_url = page.url
        title = await page.title()
        print(f"\nCurrent URL: {current_url}")
        print(f"Title: {title}")

        # Navigate to home if not there
        if "/user/home" not in current_url:
            print("Navigating to home page...")
            await page.goto(EMPOWER_HOME, wait_until="domcontentloaded", timeout=60000)
            await asyncio.sleep(5)

        # Wait for dashboard content
        print("Waiting for dashboard content...")
        dashboard_loaded = await wait_for_page_content(page, "NET WORTH", timeout=30000)
        if not dashboard_loaded:
            body_text = await page.evaluate("document.body.innerText.substring(0, 500)")
            print(f"\nERROR: Dashboard didn't load. Page content:\n{body_text[:500]}")
            await browser.close()
            return

        print("\nOn the dashboard. Starting scrape...\n")

        # Get all accounts
        accounts = await get_accounts(page)
        print(f"Found {len(accounts)} accounts:")
        for a in accounts:
            print(f"  - {a['institution']} ...{a['accountNum']} ({a['balance']})")

        # Scrape each account
        all_data = []

        for account in accounts:
            result = await scrape_account_transactions(page, account)
            if not result:
                continue

            txns = result["transactions"]
            account_title = result["accountTitle"]
            is_investment = any(t.get("action") for t in txns)

            print(f"\n{account['institution']} ...{account['accountNum']}: {len(txns)} transactions")

            # Save CSV
            if txns:
                safe_name = f"{account['institution']}_{account['accountNum']}".replace(" ", "_")
                safe_name = re.sub(r"[^a-zA-Z0-9_]", "", safe_name)
                csv_path = OUTPUT_DIR / f"{safe_name}.csv"
                save_csv(txns, csv_path, is_investment)
                print(f"  Saved: {csv_path}")

            all_data.append({
                "institution": account["institution"],
                "accountNum": account["accountNum"],
                "accountTitle": account_title,
                "balance": account["balance"],
                "transactions": txns,
            })

            await asyncio.sleep(1)

        # Save combined JSON
        json_path = OUTPUT_DIR / "all_accounts.json"
        with open(json_path, "w") as f:
            json.dump(all_data, f, indent=2)
        print(f"\nSaved combined JSON: {json_path}")

        # Save summary
        summary_path = OUTPUT_DIR / "summary.csv"
        with open(summary_path, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["institution", "account_num", "account_title", "balance", "transaction_count"])
            for d in all_data:
                writer.writerow([d["institution"], d["accountNum"], d["accountTitle"], d["balance"], len(d["transactions"])])
        print(f"Saved summary: {summary_path}")

        print(f"\nDone! Scraped {len(all_data)} accounts.")

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
