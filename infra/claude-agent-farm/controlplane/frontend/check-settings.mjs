import { chromium, devices } from '@playwright/test';

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices['iPhone 12']
});
const page = await context.newPage();

await page.goto('http://claude-farm-master.tail05d28.ts.net:30080/settings');
await page.waitForTimeout(2000);
await page.screenshot({ path: 'settings-page.png', fullPage: true });

await browser.close();
console.log('Done');
