"""
Launch patchwright browser for manual inspection.
Logs in automatically, then keeps browser open until you press Enter.

Usage:
  .venv/bin/python launch_browser.py
"""
import asyncio
import os
import sys
from pathlib import Path
from patchright.async_api import async_playwright

SCRIPT_DIR = Path(__file__).parent
USER_DATA_DIR = str(SCRIPT_DIR / "user_data")
EMPOWER_LOGIN = "https://participant.empower-retirement.com/participant/#/login"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch_persistent_context(
            user_data_dir=USER_DATA_DIR,
            channel="chrome",
            headless=False,
            no_viewport=True,
            # do NOT add custom browser headers or user_agent
        )

        page = browser.pages[0] if browser.pages else await browser.new_page()

        print("Navigating to Empower login...")
        await page.goto(EMPOWER_LOGIN, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(5)

        url = page.url
        if "login" in url:
            print("On login page. Handling popups + autofill...")

            # Dismiss modals
            for _ in range(5):
                try:
                    modal_btn = page.locator(".modal-footer button")
                    if await modal_btn.count() > 0:
                        txt = await modal_btn.first.inner_text()
                        await modal_btn.first.click()
                        print(f"  Dismissed: {txt.strip()}")
                        await asyncio.sleep(1)
                    else:
                        break
                except Exception:
                    break

            # Accept cookies
            try:
                accept = page.locator("button", has_text="Accept cookies")
                if await accept.count() > 0:
                    await accept.click()
                    print("  Accepted cookies")
                    await asyncio.sleep(1)
            except Exception:
                pass

            # Trigger autofill
            try:
                await page.locator('input[name="usernameInput"]').click()
                await asyncio.sleep(2)
                await page.locator('input[name="passwordInput"]').click()
                await asyncio.sleep(2)

                uval = await page.locator('input[name="usernameInput"]').input_value()
                pval = await page.locator('input[name="passwordInput"]').input_value()

                if uval and pval:
                    await page.locator("button", has_text="Sign In").click()
                    print("  Signed in. Waiting for dashboard...")
                    await asyncio.sleep(8)
                else:
                    print("  Credentials not autofilled. Please log in manually.")
            except Exception as e:
                print(f"  Login error: {e}. Please log in manually.")

        print("\nBrowser is open. Inspect the page as needed.")
        print("To close: create a file called 'STOP' in the scraper directory,")
        print("  e.g.: touch ./STOP")
        print("Or press Ctrl+C")

        # Keep alive — poll for STOP file
        stop_file = str(SCRIPT_DIR / "STOP")
        # Clean up any stale stop file
        if os.path.exists(stop_file):
            os.remove(stop_file)

        try:
            while True:
                if os.path.exists(stop_file):
                    os.remove(stop_file)
                    break
                if len(browser.pages) == 0:
                    page = await browser.new_page()
                await asyncio.sleep(1)
        except Exception as e:
            print(f"Browser closed: {e}")

        print("Closing browser...")
        await browser.close()

try:
    asyncio.run(main())
except KeyboardInterrupt:
    print("Shutdown.")
