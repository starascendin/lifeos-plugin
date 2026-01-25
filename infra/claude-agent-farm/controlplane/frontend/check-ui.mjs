import { chromium, devices } from '@playwright/test';

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices['iPhone 12']
});
const page = await context.newPage();

const BASE = 'http://claude-farm-master.tail05d28.ts.net:30080';

// Check dashboard
await page.goto(BASE);
await page.waitForTimeout(1000);
await page.screenshot({ path: 'ui-dashboard.png', fullPage: true });

// Check configs/new to verify GitHub repos load
await page.goto(`${BASE}/configs/new`);
await page.waitForTimeout(2000);
await page.screenshot({ path: 'ui-configs-new.png', fullPage: true });

await browser.close();
console.log('Screenshots saved');
