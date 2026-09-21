const path = require('node:path');
const { chromium } = require('playwright');

async function launchBrowser({ navigationTimeoutMs }) {
  const profilePath = path.join(__dirname, '..', 'data', 'browser-profile');
  const context = await chromium.launchPersistentContext(profilePath, {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1440, height: 960 },
  });
  const page = context.pages()[0] || await context.newPage();
  page.setDefaultNavigationTimeout(navigationTimeoutMs);
  page.setDefaultTimeout(10_000);
  await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' });
  return { context, page };
}

module.exports = { launchBrowser };
