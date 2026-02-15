"""
Empower Retirement Scraper using Patchright (no CDP, no extra args).

Usage:
  # Launch browser, log in, scrape — all in one script
  PYENV_VERSION=3.12.10 uv run python scrape_all.py
"""
import asyncio
import csv
import json
import re
from pathlib import Path
from patchright.async_api import async_playwright

SCRIPT_DIR = Path(__file__).parent
USER_DATA_DIR = str(SCRIPT_DIR / "user_data")
OUTPUT_DIR = SCRIPT_DIR / "output"
EMPOWER_LOGIN = "https://participant.empower-retirement.com/participant/#/login"
EMPOWER_HOME = "https://participant.empower-retirement.com/dashboard/#/user/home"


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
    """Click an account button by its 4-digit identifier."""
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


async def scrape_account(page, account):
    """Click account, wait for detail, extract transactions."""
    clicked = await click_account(page, account["accountNum"])
    if not clicked:
        print(f"  Could not click {account['accountNum']}, skipping")
        return None

    await asyncio.sleep(3)

    detail = await page.evaluate(f"""
        () => {{
            const text = document.body.innerText;
            const titleMatch = text.match(/([\\w\\s]+ - Ending in {account['accountNum']})/);
            const accountTitle = titleMatch ? titleMatch[1] : '{account["institution"]} {account["accountNum"]}';

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
            # do NOT add custom browser headers or user_agent
        )

        page = browser.pages[0] if browser.pages else await browser.new_page()

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

        # Minimize the window after Cloudflare passed
        try:
            await page.evaluate("window.blur()")
        except Exception:
            pass

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
                safe_name = re.sub(r"[^a-zA-Z0-9_]", "", f"{account['institution']}_{account['accountNum']}")
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


if __name__ == "__main__":
    asyncio.run(main())
