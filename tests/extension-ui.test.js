const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

test('extension syncs, selects, confirms, and deletes through the signed-in tab', async (t) => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent('<main>Mock ChatGPT</main>');
  await page.evaluate(() => {
    window.__deleteRequests = [];
    window.fetch = async (url, options = {}) => {
      if (url === '/api/auth/session') {
        return new Response(JSON.stringify({ accessToken: 'test-token' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (String(url).startsWith('/backend-api/conversations?')) {
        return new Response(JSON.stringify({
          items: [
            { id: 'one', title: 'Delete this chat', update_time: 2 },
            { id: 'two', title: 'Keep this chat', update_time: 1 },
          ],
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (String(url).startsWith('/backend-api/conversation/') && options.method === 'PATCH') {
        window.__deleteRequests.push({ url, body: options.body });
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

  await page.getByRole('button', { name: 'Clean chats' }).click();
  await page.getByRole('button', { name: 'Sync chats' }).click();
  await assert.doesNotReject(() => page.getByText(/Synced 2 conversations/).waitFor());

  await page.getByRole('searchbox').fill('Delete this');
  await page.getByRole('button', { name: 'Select filtered' }).click();
  assert.equal(await page.locator('.gptsd-row input:checked').count(), 1);
  assert.equal(await page.locator('.gptsd-count').textContent(), '1 selected');

  page.once('dialog', (dialog) => dialog.accept('DELETE 1 CHATS'));
  await page.getByRole('button', { name: 'Review deletion' }).click();
  await assert.doesNotReject(() => page.getByText(/Finished deleting 1 conversation/).waitFor());
  assert.equal(await page.locator('.gptsd-count').textContent(), '0 selected');
  assert.deepEqual(await page.evaluate(() => window.__deleteRequests), [{
    url: '/backend-api/conversation/one',
    body: JSON.stringify({ is_visible: false }),
  }]);
});
