const fs = require('node:fs/promises');
const path = require('node:path');
const { ACTIONS } = require('./classifier');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function createReport(conversations) {
  const keepCount = conversations.filter(({ action }) => action === ACTIONS.KEEP).length;
  return {
    generatedAt: new Date().toISOString(),
    total: conversations.length,
    keepCount,
    deleteCandidateCount: conversations.length - keepCount,
    conversations,
  };
}

function formatPreview(report) {
  const rows = report.conversations.map(({ action, title }) => {
    const label = action === ACTIONS.KEEP ? 'KEEP' : 'DELETE CANDIDATE';
    return `${label.padEnd(17)}${title}`;
  });
  return [
    '----------------------------------------',
    'Chat Cleanup Preview',
    '----------------------------------------',
    '',
    ...rows,
    '',
    '----------------------------------------',
    '',
    `Total found: ${report.total}`,
    `Keep: ${report.keepCount}`,
    `Delete candidates: ${report.deleteCandidateCount}`,
    '',
    'NO CHATS WERE MODIFIED.',
  ].join('\n');
}

function formatHtmlReport(report) {
  const rows = report.conversations.map(({ action, title, id, url, matchedBy }) => {
    const isKeep = action === ACTIONS.KEEP;
    const label = isKeep ? 'Keep' : 'Delete candidate';
    const searchText = `${title} ${id || ''} ${url}`.toLocaleLowerCase();
    return `<tr data-action="${escapeHtml(action)}" data-search="${escapeHtml(searchText)}">
      <td class="select"><input class="keep-checkbox" type="checkbox" aria-label="Keep ${escapeHtml(title)}" data-id="${escapeHtml(id || '')}" ${isKeep ? 'checked' : ''} ${id ? '' : 'disabled title="No conversation ID is available"'}></td>
      <td><span class="pill ${isKeep ? 'keep' : 'candidate'}">${label}</span></td>
      <td class="title">${escapeHtml(title)}</td>
      <td class="id">${escapeHtml(id || 'Unavailable')}</td>
      <td>${matchedBy ? escapeHtml(matchedBy) : '&mdash;'}</td>
      <td><a href="https://chatgpt.com${escapeHtml(url)}" target="_blank" rel="noreferrer">Open chat</a></td>
    </tr>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Chat Cleanup Preview</title>
  <style>
    :root { color-scheme: light; --ink:#18201d; --muted:#66716c; --line:#dfe5e2; --surface:#fff; --bg:#f4f7f5; --green:#147d55; --green-bg:#e7f7ef; --amber:#9a5b06; --amber-bg:#fff4d8; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif; }
    main { width:min(1180px,calc(100% - 32px)); margin:48px auto; }
    header { display:flex; justify-content:space-between; gap:24px; align-items:end; margin-bottom:24px; }
    h1 { margin:0 0 4px; font-size:32px; letter-spacing:-.03em; }
    header p,.meta { margin:0; color:var(--muted); }
    .safe { background:var(--green-bg); color:var(--green); padding:9px 13px; border-radius:999px; font-weight:700; white-space:nowrap; }
    .mode-switch { display:flex; align-items:center; gap:10px; margin-top:14px; color:var(--muted); font-weight:650; }
    .mode-switch input { width:38px; height:20px; accent-color:#b42318; }
    .danger { margin:0 0 24px; padding:16px 18px; border:1px solid #f0b4ad; border-radius:14px; background:#fff2f0; color:#7a271a; }
    .danger code { background:#fff; border:1px solid #f0b4ad; border-radius:6px; padding:3px 7px; }
    .stats { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin:24px 0; }
    .stat { background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:20px; }
    .stat strong { display:block; font-size:30px; }
    .stat span { color:var(--muted); }
    .panel { background:var(--surface); border:1px solid var(--line); border-radius:18px; overflow:hidden; box-shadow:0 8px 30px rgba(28,45,38,.05); }
    .toolbar { display:flex; flex-wrap:wrap; gap:10px; padding:16px; border-bottom:1px solid var(--line); }
    input[type="search"] { flex:1 1 320px; min-width:0; border:1px solid var(--line); border-radius:10px; padding:11px 13px; font:inherit; }
    input[type="checkbox"] { width:18px; height:18px; accent-color:var(--green); cursor:pointer; }
    button { border:1px solid var(--line); background:#fff; border-radius:10px; padding:10px 14px; font:inherit; cursor:pointer; }
    button.active { color:#fff; background:var(--ink); border-color:var(--ink); }
    .table-wrap { overflow:auto; max-height:65vh; }
    table { width:100%; border-collapse:collapse; }
    th { position:sticky; top:0; background:#fafcfb; color:var(--muted); text-align:left; font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
    th,td { padding:13px 16px; border-bottom:1px solid var(--line); vertical-align:middle; }
    tr:last-child td { border-bottom:0; }
    .title { min-width:280px; font-weight:600; }
    .id { max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--muted); font-family:ui-monospace,monospace; font-size:12px; }
    .pill { display:inline-block; border-radius:999px; padding:5px 9px; white-space:nowrap; font-size:12px; font-weight:750; }
    .pill.keep { color:var(--green); background:var(--green-bg); }
    .pill.candidate { color:var(--amber); background:var(--amber-bg); }
    a { color:#1264a3; font-weight:600; text-decoration:none; white-space:nowrap; }
    .selection-bar { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:14px 16px; background:#f8fbf9; border-bottom:1px solid var(--line); }
    .selection-bar strong { color:var(--green); }
    .primary { border-color:var(--green); background:var(--green); color:#fff; font-weight:700; }
    .select { width:52px; text-align:center; }
    footer { color:var(--muted); margin-top:14px; font-size:13px; }
    [hidden] { display:none; }
    @media (max-width:700px) { main{margin:24px auto} header{align-items:start;flex-direction:column}.stats{grid-template-columns:1fr}.selection-bar{align-items:stretch;flex-direction:column}.id,th:nth-child(4),th:nth-child(5),td:nth-child(5){display:none} }
  </style>
</head>
<body>
<main>
  <header><div><h1>Chat Cleanup Preview</h1><p class="meta">Generated ${escapeHtml(new Date(report.generatedAt).toLocaleString())}</p><label class="mode-switch"><input id="delete-mode" type="checkbox"> Show permanent deletion mode</label></div><div class="safe">Read-only &middot; no chats modified</div></header>
  <section class="danger" id="delete-help" hidden><strong>Permanent deletion mode</strong><br>This report never deletes chats itself. After verifying and exporting your keep list, close the scanner browser and run <code>npm run delete</code>. The command rescans and requires an exact confirmation phrase.</section>
  <section class="stats">
    <div class="stat"><strong>${report.total}</strong><span>Total conversations</span></div>
    <div class="stat"><strong>${report.keepCount}</strong><span>Keep</span></div>
    <div class="stat"><strong>${report.deleteCandidateCount}</strong><span>Delete candidates</span></div>
  </section>
  <section class="panel">
    <div class="selection-bar"><div><strong id="selected-count">${report.keepCount} selected to keep</strong><div class="meta">Selections export by conversation ID, so duplicate titles are safe.</div></div><button class="primary" id="export">Export keep-list.json</button></div>
    <div class="toolbar">
      <input id="search" type="search" placeholder="Search titles, IDs, or URLs" aria-label="Search conversations">
      <button class="active" data-filter="ALL">All</button>
      <button data-filter="KEEP">Keep</button>
      <button data-filter="DELETE_CANDIDATE">Delete candidates</button>
      <button data-filter="SELECTED">Selected to keep</button>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Keep</th><th>Current rule</th><th>Conversation</th><th>ID</th><th>Matched by</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
  </section>
  <footer id="visible-count">Showing ${report.total} conversations. This report is stored locally on your computer.</footer>
</main>
<script>
  const rows = [...document.querySelectorAll('tbody tr')];
  const search = document.querySelector('#search');
  const buttons = [...document.querySelectorAll('[data-filter]')];
  const count = document.querySelector('#visible-count');
  const selectedCount = document.querySelector('#selected-count');
  const checkboxes = [...document.querySelectorAll('.keep-checkbox')];
  let filter = 'ALL';
  function update() {
    const query = search.value.trim().toLocaleLowerCase();
    let visible = 0;
    for (const row of rows) {
      const isSelected = row.querySelector('.keep-checkbox').checked;
      const matchesFilter = filter === 'ALL' || row.dataset.action === filter || (filter === 'SELECTED' && isSelected);
      const show = matchesFilter && row.dataset.search.includes(query);
      row.hidden = !show;
      if (show) visible += 1;
    }
    count.textContent = 'Showing ' + visible + ' of ' + rows.length + ' conversations. This report is stored locally on your computer.';
    selectedCount.textContent = checkboxes.filter(item => item.checked).length + ' selected to keep';
  }
  search.addEventListener('input', update);
  buttons.forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.filter;
    buttons.forEach(item => item.classList.toggle('active', item === button));
    update();
  }));
  checkboxes.forEach(checkbox => checkbox.addEventListener('change', update));
  document.querySelector('#delete-mode').addEventListener('change', event => {
    document.querySelector('#delete-help').hidden = !event.target.checked;
  });
  document.querySelector('#export').addEventListener('click', () => {
    const conversationIds = checkboxes.filter(item => item.checked && item.dataset.id).map(item => item.dataset.id);
    const keepList = { exactTitles: [], titlePrefixes: [], conversationIds };
    const blob = new Blob([JSON.stringify(keepList, null, 2) + '\\n'], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'keep-list.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
</script>
</body>
</html>`;
}

async function saveReport(report, reportsDirectory = path.join(__dirname, '..', 'reports')) {
  await fs.mkdir(reportsDirectory, { recursive: true });
  const preview = formatPreview(report);
  const paths = {
    json: path.join(reportsDirectory, 'latest-preview.json'),
    text: path.join(reportsDirectory, 'latest-preview.txt'),
    html: path.join(reportsDirectory, 'latest-preview.html'),
  };
  await Promise.all([
    fs.writeFile(paths.json, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    fs.writeFile(paths.text, `${preview}\n`, 'utf8'),
    fs.writeFile(paths.html, formatHtmlReport(report), 'utf8'),
  ]);
  return paths;
}

module.exports = { createReport, escapeHtml, formatHtmlReport, formatPreview, saveReport };
