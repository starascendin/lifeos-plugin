import { chromium, devices } from '@playwright/test';

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices['iPhone 12']
});
const page = await context.newPage();

await page.goto('http://localhost:5174');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'local-dashboard.png', fullPage: true });

await page.goto('http://localhost:5174/configs/new');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'local-configs-new.png', fullPage: true });

await browser.close();
console.log('Local screenshots saved');
