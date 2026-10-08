const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

test('extension loads, searches, reviews, and deletes through the signed-in tab', async (t) => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent('<main>Mock ChatGPT</main>');
  await page.evaluate(() => {
    window.__mutationRequests = [];
    window.fetch = async (url, options = {}) => {
      if (url === '/api/auth/session') {
        return new Response(JSON.stringify({ accessToken: 'test-token' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (String(url).startsWith('/backend-api/conversations?') && String(url).includes('is_archived=false')) {
        return new Response(JSON.stringify({
          items: [
            { id: 'one', title: 'Delete this chat', update_time: 2 },
            { id: 'two', title: 'Keep this chat', update_time: 1 },
          ],
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (String(url).startsWith('/backend-api/conversation/') && options.method === 'PATCH') {
        window.__mutationRequests.push({ url, body: options.body });
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('', { status: 404 });
    };
  });
  await page.addScriptTag({ path: path.join(__dirname, '..', 'extension', 'core.js') });
  await page.addScriptTag({ path: path.join(__dirname, '..', 'extension', 'content.js') });

  await page.getByRole('button', { name: 'Manage history' }).click();
  await assert.doesNotReject(() => page.getByText(/2 active chats loaded/).waitFor());
  await page.keyboard.press('Control+Shift+K');
  assert.equal(await page.locator('#gptsd-panel').isHidden(), true);
  await page.keyboard.press('Control+Shift+K');
  assert.equal(await page.locator('#gptsd-panel').isVisible(), true);
  assert.equal(await page.locator('.gptsd-list').evaluate((element) => getComputedStyle(element).backgroundImage), 'none');
  await page.getByRole('button', { name: 'Choose color theme' }).click();
  await page.getByRole('menuitemradio', { name: 'Matcha Cloud' }).click();
  assert.equal(await page.locator('#gptsd-root').getAttribute('data-theme'), 'matcha-cloud');

  await page.getByRole('checkbox', { name: 'Select Delete this chat' }).check();
  await page.getByRole('checkbox', { name: 'Select Keep this chat' }).click({ modifiers: ['Shift'] });
  assert.equal(await page.locator('.gptsd-row input:checked').count(), 2);
  await page.getByRole('button', { name: 'Clear' }).click();

  await page.getByRole('searchbox', { name: 'Search chats' }).fill('Delete this');
  await page.getByRole('checkbox', { name: 'Select all filtered chats' }).check();
  assert.equal(await page.locator('.gptsd-row input:checked').count(), 1);
  assert.equal(await page.locator('.gptsd-count').textContent(), '1 selected');

  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  assert.equal(await page.getByRole('heading', { name: 'Delete 1 chat?' }).isVisible(), true);
  assert.equal(await page.locator('.gptsd-review-list').textContent(), 'Delete this chat');
  await page.getByRole('button', { name: 'Delete 1 chat' }).click();
  await assert.doesNotReject(() => page.getByText(/Deleted 1 chat successfully/).waitFor());
  assert.equal(await page.locator('.gptsd-count').textContent(), '0 selected');
  assert.deepEqual(await page.evaluate(() => window.__mutationRequests), [{
    url: '/backend-api/conversation/one',
    body: JSON.stringify({ is_visible: false }),
  }]);
});

test('extension archives active chats and restores archived chats', async (t) => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent('<main>Mock ChatGPT</main>');
  await page.evaluate(() => {
    window.__mutationRequests = [];
    window.fetch = async (url, options = {}) => {
      if (url === '/api/auth/session') {
        return new Response(JSON.stringify({ accessToken: 'test-token' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (String(url).startsWith('/backend-api/conversations?')) {
        const archived = String(url).includes('is_archived=true');
        return new Response(JSON.stringify({
          items: [{ id: archived ? 'archived' : 'active', title: archived ? 'Archived chat' : 'Active chat', update_time: 1 }],
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (String(url).startsWith('/backend-api/conversation/') && options.method === 'PATCH') {
        window.__mutationRequests.push({ url, body: options.body });
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('', { status: 404 });
    };
  });
  await page.addScriptTag({ path: path.join(__dirname, '..', 'extension', 'core.js') });
  await page.addScriptTag({ path: path.join(__dirname, '..', 'extension', 'content.js') });

  await page.getByRole('button', { name: 'Manage history' }).click();
  await page.getByText(/1 active chat loaded/).waitFor();
  await page.getByRole('checkbox', { name: 'Select Active chat' }).check();
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await page.getByText(/Archived 1 chat successfully/).waitFor();

  await page.getByRole('tab', { name: 'Archived' }).click();
  await page.getByText(/1 archived chat loaded/).waitFor();
  await page.getByRole('checkbox', { name: 'Select Archived chat' }).check();
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await page.getByText(/Restored 1 chat successfully/).waitFor();

  assert.deepEqual(await page.evaluate(() => window.__mutationRequests), [
    { url: '/backend-api/conversation/active', body: JSON.stringify({ is_archived: true }) },
    { url: '/backend-api/conversation/archived', body: JSON.stringify({ is_archived: false }) },
  ]);
});
