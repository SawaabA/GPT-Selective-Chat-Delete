const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  filterConversations,
  normalizeConversation,
  parseRetryAfterMs,
  runDeleteQueue,
} = require('../extension/core');

test('extension manifest is valid, narrowly scoped, and requests no extra permissions', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'extension', 'manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://chatgpt.com/*']);
  assert.equal(Object.hasOwn(manifest, 'permissions'), false);
  assert.equal(Object.hasOwn(manifest, 'host_permissions'), false);
});

test('normalizes and filters conversations without exposing message contents', () => {
  const normalized = normalizeConversation({ id: 'abc', title: '  Project   notes ', update_time: 12 });
  assert.deepEqual(normalized, {
    id: 'abc',
    title: 'Project notes',
    createTime: null,
    updateTime: 12,
    url: '/c/abc',
  });
  assert.deepEqual(filterConversations([normalized], 'NOTES').map(({ id }) => id), ['abc']);
  assert.equal(normalizeConversation({ title: 'missing id' }), null);
});

test('parses retry-after seconds and dates with a safe fallback', () => {
  assert.equal(parseRetryAfterMs('12', 0), 12_000);
  assert.equal(parseRetryAfterMs('Thu, 01 Jan 1970 00:01:00 GMT', 0), 60_000);
  assert.equal(parseRetryAfterMs(null, 0), 120_000);
});

test('deletion queue uses normal delays and longer batch cooldowns', async () => {
  const calls = [];
  const waits = [];
  const deleted = await runDeleteQueue(['a', 'b', 'c'], {
    deleteOne: async (id) => calls.push(id),
    delay: async (ms) => waits.push(ms),
    intervalMs: 10,
    batchSize: 2,
    batchCooldownMs: 50,
  });
  assert.deepEqual(calls, ['a', 'b', 'c']);
  assert.deepEqual(waits, [10, 50]);
  assert.deepEqual(deleted, ['a', 'b', 'c']);
});

test('deletion queue stops immediately when a deletion fails', async () => {
  const calls = [];
  await assert.rejects(() => runDeleteQueue(['a', 'b', 'c'], {
    deleteOne: async (id) => {
      calls.push(id);
      if (id === 'b') throw new Error('stop');
    },
    delay: async () => {},
  }), /stop/);
  assert.deepEqual(calls, ['a', 'b']);
});
