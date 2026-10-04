(function startExtension() {
  if (window.top !== window.self || document.getElementById('gptsd-root')) return;

  const Core = globalThis.GPTSelectiveDeleteCore;
  const state = {
    conversations: [],
    selectedIds: new Set(),
    query: '',
    syncing: false,
    deleting: false,
    cooldownUntil: 0,
    cooldownTimer: null,
  };

  const root = document.createElement('div');
  root.id = 'gptsd-root';
  root.innerHTML = `
    <button class="gptsd-launcher" type="button" aria-expanded="false">Clean chats</button>
    <section class="gptsd-panel" aria-label="Selective chat deletion" hidden>
      <header class="gptsd-header">
        <div>
          <strong>Selective chat delete</strong>
          <small>Local extension · deletion is permanent</small>
        </div>
        <button class="gptsd-close" type="button" aria-label="Close">×</button>
      </header>
      <div class="gptsd-controls">
        <button class="gptsd-sync" type="button">Sync chats</button>
        <input class="gptsd-search" type="search" placeholder="Filter by title" aria-label="Filter conversations by title">
        <button class="gptsd-select-visible" type="button">Select filtered</button>
        <button class="gptsd-clear" type="button">Clear</button>
      </div>
      <div class="gptsd-status" role="status">Open ChatGPT normally, then sync your conversations.</div>
      <div class="gptsd-list" role="list"></div>
      <footer class="gptsd-footer">
        <span class="gptsd-count">0 selected</span>
        <button class="gptsd-delete" type="button" disabled>Review deletion</button>
      </footer>
    </section>`;
  document.documentElement.appendChild(root);

  const elements = {
    launcher: root.querySelector('.gptsd-launcher'),
    panel: root.querySelector('.gptsd-panel'),
    close: root.querySelector('.gptsd-close'),
    sync: root.querySelector('.gptsd-sync'),
    search: root.querySelector('.gptsd-search'),
    selectVisible: root.querySelector('.gptsd-select-visible'),
    clear: root.querySelector('.gptsd-clear'),
    status: root.querySelector('.gptsd-status'),
    list: root.querySelector('.gptsd-list'),
    count: root.querySelector('.gptsd-count'),
    delete: root.querySelector('.gptsd-delete'),
  };

  function setStatus(message, type = '') {
    elements.status.textContent = message;
    elements.status.dataset.type = type;
  }

  function visibleConversations() {
    return Core.filterConversations(state.conversations, state.query);
  }

  function render() {
    const visible = visibleConversations();
    elements.list.replaceChildren();
    for (const conversation of visible) {
      const label = document.createElement('label');
      label.className = 'gptsd-row';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = state.selectedIds.has(conversation.id);
      checkbox.dataset.id = conversation.id;
      const title = document.createElement('span');
      title.textContent = conversation.title;
      const open = document.createElement('a');
      open.href = conversation.url;
      open.target = '_blank';
      open.rel = 'noopener noreferrer';
      open.textContent = 'Open';
      open.addEventListener('click', (event) => event.stopPropagation());
      label.append(checkbox, title, open);
      elements.list.appendChild(label);
    }
    if (state.conversations.length && !visible.length) {
      const empty = document.createElement('p');
      empty.className = 'gptsd-empty';
      empty.textContent = 'No conversations match this filter.';
      elements.list.appendChild(empty);
    }
    elements.count.textContent = `${state.selectedIds.size} selected`;
    const coolingDown = state.cooldownUntil > Date.now();
    elements.delete.disabled = state.deleting || state.syncing || coolingDown || state.selectedIds.size === 0;
    elements.sync.disabled = state.deleting || state.syncing;
    elements.selectVisible.disabled = state.deleting || visible.length === 0;
    elements.clear.disabled = state.deleting || state.selectedIds.size === 0;
    elements.delete.textContent = state.deleting ? 'Deleting…' : coolingDown ? 'Rate-limit cooldown' : 'Review deletion';
  }

  async function getSession() {
    const response = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
    if (!response.ok) throw new Error(`ChatGPT session check failed (${response.status}).`);
    const session = await response.json();
    if (!session?.accessToken) throw new Error('No signed-in ChatGPT session was found. Refresh the page and sign in normally.');
    return session;
  }

  async function fetchConversationPage(accessToken, offset) {
    const response = await fetch(`/backend-api/conversations?offset=${offset}&limit=100`, {
      credentials: 'include',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.status === 429) {
      throw new Core.RateLimitError(Core.parseRetryAfterMs(response.headers.get('retry-after')));
    }
    if (!response.ok) throw new Error(`Conversation sync failed (${response.status}).`);
    const payload = await response.json();
    if (!Array.isArray(payload?.items)) throw new Error('ChatGPT returned an unfamiliar conversation-list format.');
    return payload.items;
  }

  async function syncConversations() {
    if (state.syncing || state.deleting) return;
    state.syncing = true;
    render();
    setStatus('Checking your existing ChatGPT session…');
    try {
      const session = await getSession();
      const found = new Map();
      let offset = 0;
      while (true) {
        setStatus(`Syncing conversations… ${found.size} found`);
        const items = await fetchConversationPage(session.accessToken, offset);
        for (const item of items) {
          const normalized = Core.normalizeConversation(item);
          if (normalized) found.set(normalized.id, normalized);
        }
        if (items.length < 100) break;
        offset += items.length;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      state.conversations = [...found.values()].sort((left, right) => (right.updateTime || 0) - (left.updateTime || 0));
      state.selectedIds = new Set([...state.selectedIds].filter((id) => found.has(id)));
      setStatus(`Synced ${state.conversations.length} conversations. Select only the chats you want permanently deleted.`, 'success');
    } catch (error) {
      setStatus(error instanceof Core.RateLimitError
        ? 'ChatGPT rate-limited the sync. Wait a few minutes and try again.'
        : `${error.message} This extension cannot bypass a Cloudflare page.`, 'error');
    } finally {
      state.syncing = false;
      render();
    }
  }

  async function deleteOne(id, accessToken) {
    const response = await fetch(`/backend-api/conversation/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ is_visible: false }),
    });
    if (response.status === 429) {
      throw new Core.RateLimitError(Core.parseRetryAfterMs(response.headers.get('retry-after')));
    }
    if (response.status === 401 || response.status === 403) throw new Error('Your ChatGPT session changed. Refresh, sync again, and review the remaining selection.');
    if (!response.ok) throw new Error(`ChatGPT rejected a deletion (${response.status}).`);
    if (response.status === 204) return;
    const payload = await response.json().catch(() => null);
    if (payload?.success !== true) throw new Error('ChatGPT did not confirm the deletion, so the batch was stopped.');
  }

  function startCooldown(milliseconds) {
    state.cooldownUntil = Date.now() + Math.max(milliseconds, 2 * 60 * 1000);
    window.clearInterval(state.cooldownTimer);
    state.cooldownTimer = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((state.cooldownUntil - Date.now()) / 1000));
      if (seconds <= 0) {
        window.clearInterval(state.cooldownTimer);
        state.cooldownUntil = 0;
        setStatus('Cooldown finished. Review the remaining selected chats, then resume.', 'success');
      } else {
        setStatus(`ChatGPT requested a cooldown. You can resume in about ${seconds} seconds.`, 'error');
      }
      render();
    }, 1_000);
  }

  async function deleteSelected() {
    if (state.deleting || state.cooldownUntil > Date.now() || !state.selectedIds.size) return;
    const selected = state.conversations.filter(({ id }) => state.selectedIds.has(id));
    const phrase = `DELETE ${selected.length} CHATS`;
    const preview = selected.slice(0, 8).map(({ title }) => `• ${title}`).join('\n');
    const more = selected.length > 8 ? `\n…and ${selected.length - 8} more` : '';
    const confirmation = window.prompt(
      `Permanent deletion cannot be undone.\n\n${preview}${more}\n\nType ${phrase} to continue:`,
      '',
    );
    if (confirmation !== phrase) {
      setStatus('Deletion cancelled. The confirmation phrase did not match.');
      return;
    }

    state.deleting = true;
    render();
    try {
      const session = await getSession();
      const ids = selected.map(({ id }) => id);
      await Core.runDeleteQueue(ids, {
        deleteOne: (id) => deleteOne(id, session.accessToken),
        intervalMs: 3_000,
        batchSize: 10,
        batchCooldownMs: 30_000,
        onProgress: async ({ id, deleted, total }) => {
          state.selectedIds.delete(id);
          state.conversations = state.conversations.filter((conversation) => conversation.id !== id);
          setStatus(`Verified ${deleted} of ${total} deletions. The extension is pacing requests.`);
          render();
        },
      });
      setStatus(`Finished deleting ${ids.length} conversations. Sync again to confirm the live list.`, 'success');
    } catch (error) {
      if (error instanceof Core.RateLimitError) {
        startCooldown(error.retryAfterMs);
      } else {
        setStatus(`${error.message} The remaining chats are still selected; sync and review before resuming.`, 'error');
      }
    } finally {
      state.deleting = false;
      render();
    }
  }

  elements.launcher.addEventListener('click', () => {
    const opening = elements.panel.hidden;
    elements.panel.hidden = !opening;
    elements.launcher.setAttribute('aria-expanded', String(opening));
  });
  elements.close.addEventListener('click', () => {
    elements.panel.hidden = true;
    elements.launcher.setAttribute('aria-expanded', 'false');
  });
  elements.sync.addEventListener('click', syncConversations);
  elements.search.addEventListener('input', () => {
    state.query = elements.search.value;
    render();
  });
  elements.list.addEventListener('change', (event) => {
    const checkbox = event.target.closest('input[type="checkbox"][data-id]');
    if (!checkbox) return;
    if (checkbox.checked) state.selectedIds.add(checkbox.dataset.id);
    else state.selectedIds.delete(checkbox.dataset.id);
    render();
  });
  elements.selectVisible.addEventListener('click', () => {
    visibleConversations().forEach(({ id }) => state.selectedIds.add(id));
    render();
  });
  elements.clear.addEventListener('click', () => {
    state.selectedIds.clear();
    render();
  });
  elements.delete.addEventListener('click', deleteSelected);
  render();
}());
