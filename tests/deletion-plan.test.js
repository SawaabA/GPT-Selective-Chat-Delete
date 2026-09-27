const test = require('node:test');
const assert = require('node:assert/strict');
const { createDeletionPlan, normalizeId, sameIds } = require('../src/deletion-plan');

const chats = [
  { id: 'A', title: 'Keep this' },
  { id: 'B', title: 'Delete this' },
];

test('creates a deletion plan only from the unchanged fresh scan', () => {
  const result = createDeletionPlan(chats, [...chats].reverse(), ['a'], 1);
  assert.deepEqual(result.map(({ id }) => id), ['B']);
});

test('rejects a changed conversation set even when the count is unchanged', () => {
  assert.throws(
    () => createDeletionPlan(chats, [chats[0], { id: 'C', title: 'New chat' }], ['A'], 1),
    /conversation list changed/i,
  );
});

test('rejects missing IDs and unknown keep selections', () => {
  assert.throws(() => createDeletionPlan(chats, [{ title: 'No ID' }, chats[1]], ['A'], 1), /no stable ID/i);
  assert.throws(() => createDeletionPlan(chats, chats, ['unknown'], 1), /unknown conversation ID/i);
});

test('rejects a candidate-count mismatch', () => {
  assert.throws(() => createDeletionPlan(chats, chats, ['A'], 2), /dashboard showed 2/i);
});

test('normalizes IDs and compares sets without relying on order', () => {
  assert.equal(normalizeId(' A '), 'a');
  assert.equal(sameIds(new Set(['a', 'b']), new Set(['b', 'a'])), true);
});
