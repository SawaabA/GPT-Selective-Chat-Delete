const test = require('node:test');
const assert = require('node:assert/strict');
const { ACTIONS, classifyConversation, classifyConversations } = require('../src/classifier');

const keepList = {
  exactTitles: ['Quiz Answer Only', 'Same title'],
  titlePrefixes: ['Important project'],
  conversationIds: ['id-to-keep'],
};

test('keeps an exact title match', () => {
  assert.equal(classifyConversation({ title: 'Quiz Answer Only' }, keepList).action, ACTIONS.KEEP);
});

test('title matching is case insensitive', () => {
  assert.equal(classifyConversation({ title: 'quiz answer only' }, keepList).action, ACTIONS.KEEP);
});

test('normalizes surrounding and repeated whitespace', () => {
  assert.equal(classifyConversation({ title: '  Quiz   Answer  Only ' }, keepList).action, ACTIONS.KEEP);
});

test('keeps a matching title prefix', () => {
  assert.equal(classifyConversation({ title: 'IMPORTANT PROJECT notes' }, keepList).action, ACTIONS.KEEP);
});

test('does not collapse different conversations with duplicate titles', () => {
  const results = classifyConversations([
    { id: 'one', title: 'Same title', url: '/c/one' },
    { id: 'two', title: 'Same title', url: '/c/two' },
  ], keepList);
  assert.equal(results.length, 2);
  assert.deepEqual(results.map(({ id }) => id), ['one', 'two']);
});

test('conversation ID match has priority', () => {
  const result = classifyConversation({ id: 'ID-TO-KEEP', title: 'Unlisted' }, keepList);
  assert.equal(result.action, ACTIONS.KEEP);
  assert.equal(result.matchedBy, 'conversationId');
});

test('marks a non-match as a delete candidate', () => {
  assert.equal(classifyConversation({ title: 'Random old chat' }, keepList).action, ACTIONS.DELETE_CANDIDATE);
});
