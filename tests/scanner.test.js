const test = require('node:test');
const assert = require('node:assert/strict');
const { extractConversationId, normalizeConversationUrl } = require('../src/scanner');

test('extracts conversation IDs from relative and absolute ChatGPT URLs', () => {
  assert.equal(extractConversationId('/c/abc-123'), 'abc-123');
  assert.equal(extractConversationId('https://chatgpt.com/c/abc-123?model=test'), 'abc-123');
});

test('does not treat unrelated paths as conversations', () => {
  assert.equal(extractConversationId('/g/gpt-id'), null);
  assert.equal(extractConversationId('/'), null);
});

test('normalizes a conversation URL to a local path and query', () => {
  assert.equal(normalizeConversationUrl('https://chatgpt.com/c/abc?model=test#message'), '/c/abc?model=test');
});
