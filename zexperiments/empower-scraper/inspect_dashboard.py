"""Patchright-based inspector: logs in, dumps dashboard structure, then keeps browser open."""
import asyncio
import json
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
        )

        page = browser.pages[0] if browser.pages else await browser.new_page()

        # Login
        print("Navigating to Empower login...")
        await page.goto(EMPOWER_LOGIN, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(5)

        if "login" in page.url:
            # Dismiss modals
            for _ in range(5):
                try:
                    btn = page.locator(".modal-footer button")
                    if await btn.count() > 0:
                        txt = await btn.first.inner_text()
                        await btn.first.click()
                        print(f"  Dismissed: {txt.strip()}")
                        await asyncio.sleep(1)
                    else:
                        break
                except Exception:
                    break

            try:
                accept = page.locator("button", has_text="Accept cookies")
                if await accept.count() > 0:
                    await accept.click()
                    await asyncio.sleep(1)
            except Exception:
                pass

            # Autofill
            await page.locator('input[name="usernameInput"]').click()
            await asyncio.sleep(2)
            await page.locator('input[name="passwordInput"]').click()
            await asyncio.sleep(2)

            uval = await page.locator('input[name="usernameInput"]').input_value()
            pval = await page.locator('input[name="passwordInput"]').input_value()

            if uval and pval:
                await page.locator("button", has_text="Sign In").click()
                print("  Signed in...")
                await asyncio.sleep(8)
            else:
                print("  Please log in manually...")

        # Wait for dashboard
        for _ in range(30):
            try:
                found = await page.evaluate("document.body && document.body.innerText.includes('NET WORTH')")
                if found:
                    break
            except Exception:
                pass
            await asyncio.sleep(2)

        print("\n=== DASHBOARD STRUCTURE ===\n")

        # Dump all accounts with categories
        structure = await page.evaluate("""
            () => {
                const body = document.body.innerText;
                const assetsIdx = body.indexOf('ASSETS');
                const connectIdx = body.indexOf('+Connect account');
                const section = body.substring(assetsIdx, connectIdx !== -1 ? connectIdx : assetsIdx + 5000);
                return section;
            }
        """)
        print(structure)

        print("\n=== ALL CLICKABLE ACCOUNTS ===\n")
        accounts = await page.evaluate("""
            () => {
                const buttons = document.querySelectorAll('button');
                const results = [];
                for (const btn of buttons) {
                    const text = btn.textContent.trim();
                    if (text.includes('ago') && (text.includes('$') || text.includes('Reconnect'))) {
                        results.push(text.substring(0, 150));
                    }
                }
                return results;
            }
        """)
        for i, a in enumerate(accounts):
            print(f"  {i+1}. {a}")

        # Keep browser open
        print("\nBrowser open. Touch ./STOP to close.")
        stop_file = str(SCRIPT_DIR / "STOP")
        import os
        if os.path.exists(stop_file):
            os.remove(stop_file)
        try:
            while True:
                if os.path.exists(stop_file):
                    os.remove(stop_file)
                    break
                if len(browser.pages) == 0:
                    await browser.new_page()
                await asyncio.sleep(1)
        except Exception:
            pass

        await browser.close()

try:
    asyncio.run(main())
except KeyboardInterrupt:
    print("Shutdown.")
