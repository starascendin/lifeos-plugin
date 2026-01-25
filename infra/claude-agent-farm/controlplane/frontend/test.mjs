import { chromium, devices } from '@playwright/test';

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices['iPhone 12']
});
const page = await context.newPage();

page.on('console', msg => console.log('CONSOLE:', msg.text()));
page.on('pageerror', err => console.log('ERROR:', err.message));

await page.goto('http://claude-farm-master.tail05d28.ts.net:30080');
await page.waitForTimeout(2000);
await page.screenshot({ path: 'final-dashboard.png', fullPage: true });

await page.goto('http://claude-farm-master.tail05d28.ts.net:30080/configs/new');
await page.waitForTimeout(2000);
await page.screenshot({ path: 'final-configs-new.png', fullPage: true });

await browser.close();
console.log('Done');
