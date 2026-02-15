"""Launch patchwright browser and keep it open. Matches the working bl_authed_patchwright config exactly."""
import asyncio
import sys
from patchright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch_persistent_context(
            user_data_dir="./user_data",
            channel="chrome",
            headless=False,
            no_viewport=True,
            # do NOT add custom browser headers or user_agent
        )

        if browser.pages:
            page = browser.pages[0]
        else:
            page = await browser.new_page()

        await page.goto("https://participant.empower-retirement.com/dashboard/#/user/home",
                        wait_until="domcontentloaded", timeout=60000)

        print("BROWSER_READY")
        print("Use patchwright API (not CDP) to interact with the browser.")

        # Keep alive
        try:
            while True:
                if len(browser.pages) == 0:
                    page = await browser.new_page()
                await asyncio.sleep(2)
        except Exception as e:
            print(f"Browser closed: {e}")

try:
    asyncio.run(main())
except KeyboardInterrupt:
    print("Shutdown.")
