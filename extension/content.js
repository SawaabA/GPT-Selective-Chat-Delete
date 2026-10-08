(function startExtension() {
  if (window.top !== window.self || document.getElementById('gptsd-root')) return;

  const Core = globalThis.GPTSelectiveDeleteCore;
  const state = {
    conversations: [],
    selectedIds: new Set(),
    pendingDeleteIds: [],
    query: '',
    scope: 'active',
    lastSelectedId: null,
    renderLimit: 200,
    loadedAt: 0,
    syncing: false,
    processing: false,
    cooldownUntil: 0,
    cooldownTimer: null,
  };

  const root = document.createElement('div');
  root.id = 'gptsd-root';
  root.dataset.placement = 'floating';
  root.innerHTML = `
    <button id="gptsd-launcher" class="gptsd-launcher" type="button" aria-label="Manage history" aria-expanded="false" aria-controls="gptsd-panel" data-placement="floating">
      <img class="gptsd-launcher-mascot" alt="" aria-hidden="true">
      <span>Cloudy cleanup</span>
      <span class="gptsd-launcher-sparkle" aria-hidden="true">✦</span>
    </button>
    <section class="gptsd-panel" id="gptsd-panel" aria-label="ChatGPT history manager" hidden>
      <header class="gptsd-header">
        <div class="gptsd-heading">
          <img class="gptsd-mascot" alt="" aria-hidden="true">
          <div>
            <strong>Cloudy Chat Cleanup <span aria-hidden="true">✧</span></strong>
            <small>Tidy chats, keep happy thoughts ♡</small>
          </div>
        </div>
        <button class="gptsd-icon-button gptsd-close" type="button" aria-label="Close history manager">✕</button>
      </header>

      <div class="gptsd-tabs" role="tablist" aria-label="Conversation type">
        <button type="button" role="tab" class="gptsd-tab" data-scope="active" aria-selected="true">Active chats</button>
        <button type="button" role="tab" class="gptsd-tab" data-scope="archived" aria-selected="false">Archived</button>
      </div>

      <div class="gptsd-toolbar">
        <label class="gptsd-select-all">
          <input type="checkbox" aria-label="Select all filtered chats">
          <span>Select all</span>
        </label>
        <label class="gptsd-search-wrap">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>
          <input class="gptsd-search" type="search" placeholder="Search chats" aria-label="Search chats">
        </label>
        <button class="gptsd-icon-button gptsd-sync" type="button" aria-label="Refresh chats" title="Refresh chats">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5M4 18v-5h5M18.4 9A7 7 0 0 0 6.3 6.7L4 11m16 2-2.3 4.3A7 7 0 0 1 5.6 15"/></svg>
        </button>
      </div>

      <div class="gptsd-status" role="status" aria-live="polite">Open the manager to load your chats.</div>
      <div class="gptsd-list" role="list" aria-label="Conversations"></div>

      <footer class="gptsd-footer">
        <div class="gptsd-selection">
          <strong class="gptsd-count">0 selected</strong>
          <button class="gptsd-clear" type="button" disabled>Clear</button>
        </div>
        <div class="gptsd-actions">
          <button class="gptsd-secondary gptsd-archive" type="button" disabled>Archive</button>
          <button class="gptsd-danger gptsd-delete" type="button" disabled>Delete</button>
        </div>
      </footer>
    </section>

    <div class="gptsd-backdrop" hidden>
      <section class="gptsd-dialog" role="dialog" aria-modal="true" aria-labelledby="gptsd-dialog-title" aria-describedby="gptsd-dialog-copy">
        <img class="gptsd-dialog-mascot" alt="" aria-hidden="true">
        <h2 id="gptsd-dialog-title">Delete selected chats?</h2>
        <p id="gptsd-dialog-copy">Deleted chats cannot be restored.</p>
        <div class="gptsd-review-list"></div>
        <div class="gptsd-dialog-actions">
          <button class="gptsd-dialog-cancel" type="button">Cancel</button>
          <button class="gptsd-dialog-confirm" type="button">Delete chats</button>
        </div>
      </section>
    </div>`;
  document.documentElement.appendChild(root);

  const elements = {
    launcher: root.querySelector('.gptsd-launcher'),
    panel: root.querySelector('.gptsd-panel'),
    close: root.querySelector('.gptsd-close'),
    tabs: [...root.querySelectorAll('.gptsd-tab')],
    selectAll: root.querySelector('.gptsd-select-all input'),
    search: root.querySelector('.gptsd-search'),
    sync: root.querySelector('.gptsd-sync'),
    status: root.querySelector('.gptsd-status'),
    list: root.querySelector('.gptsd-list'),
    count: root.querySelector('.gptsd-count'),
    clear: root.querySelector('.gptsd-clear'),
    archive: root.querySelector('.gptsd-archive'),
    delete: root.querySelector('.gptsd-delete'),
    backdrop: root.querySelector('.gptsd-backdrop'),
    dialogTitle: root.querySelector('#gptsd-dialog-title'),
    reviewList: root.querySelector('.gptsd-review-list'),
    dialogCancel: root.querySelector('.gptsd-dialog-cancel'),
    dialogConfirm: root.querySelector('.gptsd-dialog-confirm'),
  };

  const mascotUrl = globalThis.chrome?.runtime?.getURL
    ? globalThis.chrome.runtime.getURL('assets/cloud-cleaner-mascot.png')
    : '';
  if (mascotUrl) {
    root.querySelectorAll('.gptsd-mascot, .gptsd-launcher-mascot, .gptsd-dialog-mascot')
      .forEach((image) => { image.src = mascotUrl; });
  }

  function setStatus(message, type = '') {
    elements.status.textContent = message;
    elements.status.dataset.type = type;
  }

  function visibleConversations() {
    return Core.filterConversations(state.conversations, state.query);
  }

  function formatConversationDate(value) {
    if (!value) return '';
    const date = new Date(value * 1000);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayDifference = Math.round((startToday - startDate) / 86_400_000);
    if (dayDifference === 0) return 'Today';
    if (dayDifference === 1) return 'Yesterday';
    if (dayDifference > 1 && dayDifference < 7) {
      return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date);
    }
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
  }

  function makeConversationRow(conversation) {
    const label = document.createElement('label');
    label.className = 'gptsd-row';
    label.setAttribute('role', 'listitem');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.selectedIds.has(conversation.id);
    checkbox.dataset.id = conversation.id;
    checkbox.setAttribute('aria-label', `Select ${conversation.title}`);

    const chatIcon = document.createElement('span');
    chatIcon.className = 'gptsd-chat-icon';
    chatIcon.setAttribute('aria-hidden', 'true');
    chatIcon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 5h14v10H9l-4 4V5Z"/></svg>';

    const title = document.createElement('span');
    title.className = 'gptsd-title';
    title.textContent = conversation.title;
    title.title = conversation.title;

    const time = document.createElement('time');
    time.textContent = formatConversationDate(conversation.updateTime || conversation.createTime);

    label.append(checkbox, chatIcon, title, time);
    return label;
  }

  function render() {
    const visible = visibleConversations();
    const displayed = visible.slice(0, state.renderLimit);
    elements.list.replaceChildren();

    for (const conversation of displayed) elements.list.appendChild(makeConversationRow(conversation));

    if (displayed.length < visible.length) {
      const loadMore = document.createElement('button');
      loadMore.className = 'gptsd-load-more';
      loadMore.type = 'button';
      const remaining = visible.length - displayed.length;
      loadMore.textContent = `Show ${Math.min(200, remaining)} more of ${remaining}`;
      loadMore.addEventListener('click', () => {
        state.renderLimit += 200;
        render();
      });
      elements.list.appendChild(loadMore);
    }

    if (!state.syncing && state.conversations.length && !visible.length) {
      const empty = document.createElement('div');
      empty.className = 'gptsd-empty';
      empty.innerHTML = '<strong>No matching chats</strong><span>Try a different search.</span>';
      elements.list.appendChild(empty);
    } else if (!state.syncing && state.loadedAt && !state.conversations.length) {
      const empty = document.createElement('div');
      empty.className = 'gptsd-empty';
      empty.innerHTML = state.scope === 'archived'
        ? '<strong>No archived chats</strong><span>Archived conversations will appear here.</span>'
        : '<strong>No active chats</strong><span>Your conversation list is already clear.</span>';
      elements.list.appendChild(empty);
    }

    const selectedVisible = visible.filter(({ id }) => state.selectedIds.has(id)).length;
    elements.selectAll.checked = visible.length > 0 && selectedVisible === visible.length;
    elements.selectAll.indeterminate = selectedVisible > 0 && selectedVisible < visible.length;
    elements.selectAll.disabled = state.processing || state.syncing || visible.length === 0;

    const selectionCount = state.selectedIds.size;
    elements.count.textContent = `${selectionCount} selected`;
    elements.clear.disabled = state.processing || selectionCount === 0;
    elements.search.disabled = state.processing || state.syncing;
    elements.sync.disabled = state.processing || state.syncing;
    elements.sync.classList.toggle('is-spinning', state.syncing);
    elements.tabs.forEach((tab) => {
      const selected = tab.dataset.scope === state.scope;
      tab.setAttribute('aria-selected', String(selected));
      tab.disabled = state.processing || state.syncing;
    });

    const coolingDown = state.cooldownUntil > Date.now();
    const actionDisabled = state.processing || state.syncing || coolingDown || selectionCount === 0;
    elements.archive.disabled = actionDisabled;
    elements.delete.disabled = actionDisabled;
    elements.archive.textContent = state.processing
      ? 'Working…'
      : state.scope === 'archived' ? 'Restore' : 'Archive';
    elements.delete.textContent = coolingDown ? 'Cooling down' : 'Delete';
  }

  async function getSession() {
    const response = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
    if (!response.ok) throw new Error(`ChatGPT session check failed (${response.status}).`);
    const session = await response.json();
    if (!session?.accessToken) throw new Error('No signed-in ChatGPT session was found. Refresh the page and sign in normally.');
    return session;
  }

  async function fetchConversationPage(accessToken, offset, scope) {
    const archived = scope === 'archived';
    const url = `/backend-api/conversations?offset=${offset}&limit=100&order=updated&is_archived=${archived}`;
    const response = await fetch(url, {
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
    if (state.syncing || state.processing) return;
    state.syncing = true;
    state.loadedAt = 0;
    render();
    setStatus(`Loading ${state.scope} chats…`);
    try {
      const session = await getSession();
      const found = new Map();
      let offset = 0;
      while (true) {
        const items = await fetchConversationPage(session.accessToken, offset, state.scope);
        for (const item of items) {
          const normalized = Core.normalizeConversation(item);
          if (normalized) found.set(normalized.id, { ...normalized, isArchived: state.scope === 'archived' });
        }
        setStatus(`Loading ${state.scope} chats… ${found.size} found`);
        if (items.length < 100) break;
        offset += items.length;
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      state.conversations = [...found.values()].sort((left, right) => (right.updateTime || 0) - (left.updateTime || 0));
      state.selectedIds = new Set([...state.selectedIds].filter((id) => found.has(id)));
      state.renderLimit = 200;
      state.loadedAt = Date.now();
      const chatWord = state.conversations.length === 1 ? 'chat' : 'chats';
      setStatus(`${state.conversations.length} ${state.scope} ${chatWord} loaded. Select individual chats, Shift-click a range, or select all.`, 'success');
    } catch (error) {
      setStatus(error instanceof Core.RateLimitError
        ? 'ChatGPT rate-limited the refresh. Wait a few minutes and try again.'
        : `${error.message} The extension cannot bypass a Cloudflare page.`, 'error');
    } finally {
      state.syncing = false;
      render();
    }
  }

  async function updateConversation(id, action, accessToken) {
    const body = action === 'delete'
      ? { is_visible: false }
      : { is_archived: action === 'archive' };
    const response = await fetch(`/backend-api/conversation/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (response.status === 429) {
      throw new Core.RateLimitError(Core.parseRetryAfterMs(response.headers.get('retry-after')));
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('Your ChatGPT session changed. Refresh, reload the list, and review the remaining selection.');
    }
    if (!response.ok) throw new Error(`ChatGPT rejected the ${action} action (${response.status}).`);
    if (response.status === 204) return;
    const payload = await response.json().catch(() => null);
    if (payload?.success === false) throw new Error(`ChatGPT did not confirm the ${action} action, so the batch was stopped.`);
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

  async function processSelected(action, explicitIds) {
    if (state.processing || state.cooldownUntil > Date.now()) return;
    const available = new Set(state.conversations.map(({ id }) => id));
    const ids = (explicitIds || [...state.selectedIds]).filter((id) => available.has(id));
    if (!ids.length) return;

    state.processing = true;
    render();
    setStatus(`${action === 'delete' ? 'Deleting' : action === 'archive' ? 'Archiving' : 'Restoring'} 0 of ${ids.length}… Keep this tab open.`);
    try {
      const session = await getSession();
      await Core.runDeleteQueue(ids, {
        deleteOne: (id) => updateConversation(id, action, session.accessToken),
        intervalMs: 1_200,
        batchSize: 20,
        batchCooldownMs: 12_000,
        onProgress: async ({ id, deleted, total }) => {
          state.selectedIds.delete(id);
          state.conversations = state.conversations.filter((conversation) => conversation.id !== id);
          setStatus(`${action === 'delete' ? 'Deleted' : action === 'archive' ? 'Archived' : 'Restored'} ${deleted} of ${total}. Keep this tab open.`);
          render();
        },
      });
      const verb = action === 'delete' ? 'Deleted' : action === 'archive' ? 'Archived' : 'Restored';
      setStatus(`${verb} ${ids.length} ${ids.length === 1 ? 'chat' : 'chats'} successfully.`, 'success');
    } catch (error) {
      if (error instanceof Core.RateLimitError) {
        startCooldown(error.retryAfterMs);
      } else {
        setStatus(`${error.message} The remaining chats are still selected.`, 'error');
      }
    } finally {
      state.processing = false;
      state.pendingDeleteIds = [];
      render();
    }
  }

  function openDeleteReview() {
    const selected = state.conversations.filter(({ id }) => state.selectedIds.has(id));
    if (!selected.length) return;
    state.pendingDeleteIds = selected.map(({ id }) => id);
    elements.dialogTitle.textContent = `Delete ${selected.length} ${selected.length === 1 ? 'chat' : 'chats'}?`;
    elements.dialogConfirm.textContent = `Delete ${selected.length} ${selected.length === 1 ? 'chat' : 'chats'}`;
    elements.reviewList.replaceChildren();
    selected.forEach(({ title }) => {
      const item = document.createElement('div');
      item.textContent = title;
      elements.reviewList.appendChild(item);
    });
    elements.backdrop.hidden = false;
    elements.dialogCancel.focus();
  }

  function closeDeleteReview() {
    elements.backdrop.hidden = true;
    state.pendingDeleteIds = [];
    elements.delete.focus();
  }

  function openPanel() {
    elements.panel.hidden = false;
    elements.launcher.setAttribute('aria-expanded', 'true');
    if (!state.loadedAt && !state.syncing) syncConversations();
    queueMicrotask(() => elements.search.focus({ preventScroll: true }));
  }

  function closePanel() {
    elements.panel.hidden = true;
    elements.launcher.setAttribute('aria-expanded', 'false');
  }

  function findChatSidebar() {
    const navigationElements = [...document.querySelectorAll('nav')];
    return navigationElements
      .map((navigation) => ({ navigation, chatLinks: navigation.querySelectorAll('a[href^="/c/"]').length }))
      .filter(({ chatLinks }) => chatLinks > 0)
      .sort((left, right) => right.chatLinks - left.chatLinks)[0]?.navigation || null;
  }

  function placeInSidebarWhenAvailable() {
    const sidebar = findChatSidebar();
    if (sidebar) {
      if (elements.launcher.parentElement !== sidebar) sidebar.insertBefore(elements.launcher, sidebar.firstChild);
      elements.launcher.dataset.placement = 'sidebar';
    } else if (!elements.launcher.isConnected) {
      root.insertBefore(elements.launcher, root.firstChild);
      elements.launcher.dataset.placement = 'floating';
    }
  }

  let placementFrame = null;
  const placementObserver = new MutationObserver(() => {
    if (placementFrame) return;
    placementFrame = requestAnimationFrame(() => {
      placementFrame = null;
      placeInSidebarWhenAvailable();
    });
  });
  placementObserver.observe(document.documentElement, { childList: true, subtree: true });
  placeInSidebarWhenAvailable();

  elements.launcher.addEventListener('click', () => {
    if (elements.panel.hidden) openPanel();
    else closePanel();
  });
  elements.close.addEventListener('click', closePanel);
  elements.sync.addEventListener('click', syncConversations);
  elements.search.addEventListener('input', () => {
    state.query = elements.search.value;
    state.lastSelectedId = null;
    state.renderLimit = 200;
    render();
  });
  elements.selectAll.addEventListener('change', () => {
    const visible = visibleConversations();
    if (elements.selectAll.checked) visible.forEach(({ id }) => state.selectedIds.add(id));
    else visible.forEach(({ id }) => state.selectedIds.delete(id));
    state.lastSelectedId = null;
    render();
  });
  elements.list.addEventListener('click', (event) => {
    const checkbox = event.target.closest('input[type="checkbox"][data-id]');
    if (!checkbox) return;
    const id = checkbox.dataset.id;
    const selecting = checkbox.checked;
    if (event.shiftKey && state.lastSelectedId) {
      Core.conversationRangeIds(visibleConversations(), state.lastSelectedId, id)
        .forEach((rangeId) => {
          if (selecting) state.selectedIds.add(rangeId);
          else state.selectedIds.delete(rangeId);
        });
    } else if (selecting) state.selectedIds.add(id);
    else state.selectedIds.delete(id);
    state.lastSelectedId = id;
    render();
  });
  elements.clear.addEventListener('click', () => {
    state.selectedIds.clear();
    state.lastSelectedId = null;
    render();
  });
  elements.tabs.forEach((tab) => tab.addEventListener('click', () => {
    if (tab.dataset.scope === state.scope) return;
    state.scope = tab.dataset.scope;
    state.conversations = [];
    state.selectedIds.clear();
    state.lastSelectedId = null;
    state.renderLimit = 200;
    state.loadedAt = 0;
    render();
    syncConversations();
  }));
  elements.archive.addEventListener('click', () => processSelected(state.scope === 'archived' ? 'restore' : 'archive'));
  elements.delete.addEventListener('click', openDeleteReview);
  elements.dialogCancel.addEventListener('click', closeDeleteReview);
  elements.dialogConfirm.addEventListener('click', () => {
    const ids = [...state.pendingDeleteIds];
    elements.backdrop.hidden = true;
    processSelected('delete', ids);
  });
  elements.backdrop.addEventListener('click', (event) => {
    if (event.target === elements.backdrop) closeDeleteReview();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!elements.backdrop.hidden) closeDeleteReview();
    else if (!elements.panel.hidden && !state.processing) closePanel();
  });

  render();
}());
