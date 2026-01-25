import { chromium, devices } from '@playwright/test';

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices['iPhone 12'],
  bypassCSP: true,
  ignoreHTTPSErrors: true,
});

// Clear all caches
await context.clearCookies();

const page = await context.newPage();

// Log all requests/responses
page.on('request', req => {
  if (req.url().includes('.js')) {
    console.log('REQ:', req.url());
  }
});
page.on('response', resp => {
  if (resp.url().includes('.js')) {
    console.log('RESP:', resp.url(), resp.status(), resp.headers()['content-type']);
  }
});
page.on('console', msg => console.log('CONSOLE:', msg.text()));
page.on('pageerror', err => console.log('ERROR:', err.message));

await page.goto('http://claude-farm-master.tail05d28.ts.net:30080', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'test2.png', fullPage: true });

await browser.close();
console.log('Done');
