(function attachCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GPTSelectiveDeleteCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createCore() {
  class RateLimitError extends Error {
    constructor(retryAfterMs) {
      super('ChatGPT temporarily rate-limited deletion requests.');
      this.name = 'RateLimitError';
      this.retryAfterMs = retryAfterMs;
    }
  }

  function parseRetryAfterMs(value, now = Date.now(), maximumMs = 15 * 60 * 1000) {
    if (!value) return 2 * 60 * 1000;
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, maximumMs);
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return 2 * 60 * 1000;
    return Math.min(Math.max(0, timestamp - now), maximumMs);
  }

  function normalizeConversation(value) {
    const id = String(value?.id || '').trim();
    if (!id) return null;
    const title = String(value?.title || '').trim().replace(/\s+/g, ' ') || '(Untitled conversation)';
    return {
      id,
      title,
      createTime: Number(value?.create_time) || null,
      updateTime: Number(value?.update_time) || null,
      url: `/c/${encodeURIComponent(id)}`,
    };
  }

  function filterConversations(conversations, query) {
    const needle = String(query || '').trim().toLocaleLowerCase();
    if (!needle) return [...conversations];
    return conversations.filter(({ title }) => title.toLocaleLowerCase().includes(needle));
  }

  async function runDeleteQueue(ids, options) {
    const {
      deleteOne,
      delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      intervalMs = 3_000,
      batchSize = 10,
      batchCooldownMs = 30_000,
      onProgress = () => {},
    } = options || {};
    if (!Array.isArray(ids) || typeof deleteOne !== 'function') throw new TypeError('A deletion list and deleteOne function are required.');

    const deletedIds = [];
    for (let index = 0; index < ids.length; index += 1) {
      if (index > 0) {
        const atBatchBoundary = batchSize > 0 && index % batchSize === 0;
        await delay(atBatchBoundary ? batchCooldownMs : intervalMs);
      }
      const id = ids[index];
      await deleteOne(id);
      deletedIds.push(id);
      await onProgress({ id, deleted: deletedIds.length, total: ids.length });
    }
    return deletedIds;
  }

  return {
    RateLimitError,
    filterConversations,
    normalizeConversation,
    parseRetryAfterMs,
    runDeleteQueue,
  };
}));
