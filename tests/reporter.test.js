const test = require('node:test');
const assert = require('node:assert/strict');
const { createReport, formatHtmlReport } = require('../src/reporter');

test('creates correct report counts', () => {
  const report = createReport([
    { action: 'KEEP', title: 'Keep me' },
    { action: 'DELETE_CANDIDATE', title: 'Preview only' },
  ]);
  assert.equal(report.total, 2);
  assert.equal(report.keepCount, 1);
  assert.equal(report.deleteCandidateCount, 1);
});

test('HTML report preserves Unicode and escapes user-controlled titles', () => {
  const report = createReport([{
    action: 'DELETE_CANDIDATE',
    title: 'Pokémon <script>alert(1)</script>',
    id: 'abc',
    url: '/c/abc',
  }]);
  const html = formatHtmlReport(report);
  assert.match(html, /Pokémon &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /data-filter="DELETE_CANDIDATE"/);
  assert.match(html, /class="keep-checkbox"/);
  assert.match(html, /Export keep-list\.json/);
  assert.match(html, /conversationIds/);
  assert.match(html, /Delete mode temporarily disabled/);
  assert.match(html, /Permanently delete unchecked chats/);
  assert.match(html, /chatCleanupDelete/);
});
