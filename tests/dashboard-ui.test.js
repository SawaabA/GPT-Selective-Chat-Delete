const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createReport, formatHtmlReport } = require('../src/reporter');

test('dashboard requires explicit selection and shows an exact review', async (t) => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.exposeFunction('chatCleanupDelete', async () => ({ deletedCount: 0, message: 'test' }));
  await page.setContent(formatHtmlReport(createReport([
    { action: 'KEEP', title: 'Protected chat', id: 'keep', url: '/c/keep', matchedBy: 'conversationId' },
    { action: 'DELETE_CANDIDATE', title: 'Old chat one', id: 'old-1', url: '/c/old-1' },
    { action: 'DELETE_CANDIDATE', title: 'Old chat two', id: 'old-2', url: '/c/old-2' },
  ])));

  assert.equal(await page.locator('.delete-checkbox:checked').count(), 0);
  assert.equal(await page.locator('#review-delete').isDisabled(), true);

  await page.getByRole('button', { name: 'Delete candidates' }).click();
  await page.getByRole('button', { name: 'Select visible', exact: true }).click();
  assert.equal(await page.locator('.delete-checkbox:checked').count(), 2);
  assert.match(await page.locator('#selected-count').textContent(), /^2 selected/);

  await page.getByRole('button', { name: 'Review deletion' }).click();
  assert.deepEqual(await page.locator('#review-list li').allTextContents(), ['Old chat one', 'Old chat two']);
  assert.equal(await page.locator('#delete-now').isDisabled(), true);
  await page.locator('#delete-confirmation').fill('DELETE 2 CHATS');
  assert.equal(await page.locator('#delete-now').isEnabled(), true);
});
