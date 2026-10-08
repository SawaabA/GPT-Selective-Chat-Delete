const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  conversationRangeIds,
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
  assert.equal(manifest.name, 'Cloudy Chat Cleanup for ChatGPT');
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'extension', 'assets', 'cloud-cleaner-mascot.png')), true);
  assert.deepEqual(manifest.web_accessible_resources, [{
    resources: ['assets/cloud-cleaner-mascot.png'],
    matches: ['https://chatgpt.com/*'],
  }]);
});

test('normalizes and filters conversations without exposing message contents', () => {
  const normalized = normalizeConversation({ id: 'abc', title: '  Project   notes ', update_time: 12 });
  assert.deepEqual(normalized, {
    id: 'abc',
    title: 'Project notes',
    createTime: null,
    updateTime: 12,
    isArchived: false,
    url: '/c/abc',
  });
  assert.deepEqual(filterConversations([normalized], 'NOTES').map(({ id }) => id), ['abc']);
  assert.equal(normalizeConversation({ title: 'missing id' }), null);
});

test('returns an inclusive range in either selection direction', () => {
  const conversations = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
  assert.deepEqual(conversationRangeIds(conversations, 'b', 'd'), ['b', 'c', 'd']);
  assert.deepEqual(conversationRangeIds(conversations, 'd', 'b'), ['b', 'c', 'd']);
  assert.deepEqual(conversationRangeIds(conversations, 'missing', 'b'), []);
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
