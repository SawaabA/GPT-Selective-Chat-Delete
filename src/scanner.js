const selectors = require('./selectors');
const { delay } = require('./utils');

function extractConversationId(href) {
  try {
    const url = new URL(href, 'https://chatgpt.com');
    const match = url.pathname.match(/^\/c\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function normalizeConversationUrl(href) {
  try {
    const url = new URL(href, 'https://chatgpt.com');
    return `${url.pathname}${url.search}`;
  } catch {
    return href;
  }
}

async function isLoginScreen(page) {
  if (/\/auth\//i.test(page.url())) return true;
  for (const selector of selectors.loginIndicators) {
    if (await page.locator(selector).first().isVisible().catch(() => false)) return true;
  }
  return false;
}

async function tryOpenSidebar(page) {
  for (const selector of selectors.sidebarToggleButtons) {
    const button = page.locator(selector).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => {});
      await delay(500);
      if (await page.locator(selectors.conversationLinks).count()) return true;
    }
  }
  return false;
}

async function findScrollContainer(page) {
  const link = page.locator(selectors.conversationLinks).first();
  return link.evaluateHandle((element) => {
    let current = element.parentElement;
    while (current) {
      const style = getComputedStyle(current);
      const scrollable = /(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight;
      if (scrollable) return current;
      current = current.parentElement;
    }
    return document.scrollingElement;
  });
}

async function collectVisibleConversations(page, conversations) {
  const items = await page.locator(selectors.conversationLinks).evaluateAll((links) => links.map((link) => ({
    href: link.getAttribute('href') || link.href,
    title: (link.getAttribute('aria-label') || link.textContent || '').trim().replace(/\s+/g, ' '),
  })));

  for (const item of items) {
    const id = extractConversationId(item.href);
    const url = normalizeConversationUrl(item.href);
    const key = id ? `id:${id}` : `url:${url}`;
    if (!conversations.has(key)) conversations.set(key, { id, title: item.title || '(Untitled conversation)', url });
  }
}

async function scanConversations(page, options) {
  if (page.isClosed()) throw new Error('The browser was closed before scanning began.');
  if (await isLoginScreen(page)) throw new Error('ChatGPT does not appear to be logged in. Log in in the browser, then run the scan again.');

  let linkCount = await page.locator(selectors.conversationLinks).count();
  if (!linkCount) {
    await tryOpenSidebar(page);
    linkCount = await page.locator(selectors.conversationLinks).count();
  }
  if (!linkCount) {
    throw new Error('Could not locate ChatGPT conversation links or the conversation sidebar. The account may have no chats, or the ChatGPT layout may have changed.');
  }

  const conversations = new Map();
  const scrollContainer = await findScrollContainer(page);
  const startedAt = Date.now();
  let stableAttempts = 0;
  let previousCount = 0;

  console.log('Scanning conversations...');
  for (let attempt = 0; attempt < options.maxScrollAttempts; attempt += 1) {
    if (page.isClosed()) throw new Error('The browser was closed while scanning.');
    if (Date.now() - startedAt > options.scanTimeoutMs) throw new Error(`Scanning timed out after ${options.scanTimeoutMs} ms.`);

    await collectVisibleConversations(page, conversations);
    if (conversations.size !== previousCount) {
      if (conversations.size === 1 || conversations.size % 25 === 0 || conversations.size - previousCount >= 25) {
        console.log(`Found ${conversations.size} unique conversations...`);
      }
      previousCount = conversations.size;
      stableAttempts = 0;
    } else {
      stableAttempts += 1;
    }

    const state = await scrollContainer.evaluate((element) => {
      const before = element.scrollTop;
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event('scroll', { bubbles: true }));
      return { before, after: element.scrollTop, height: element.scrollHeight };
    });
    await delay(options.scrollDelayMs);
    const afterState = await scrollContainer.evaluate((element) => ({ top: element.scrollTop, height: element.scrollHeight }));
    const atEnd = afterState.top + 2 >= afterState.height - await scrollContainer.evaluate((element) => element.clientHeight);
    const didNotMove = state.before === afterState.top && state.height === afterState.height;

    if (stableAttempts >= options.stableScrollAttempts && (atEnd || didNotMove)) {
      console.log('Reached end of conversation history.');
      await collectVisibleConversations(page, conversations);
      return [...conversations.values()];
    }
  }

  throw new Error(`Scan stopped after the safety limit of ${options.maxScrollAttempts} scroll attempts before a reliable end was detected.`);
}

module.exports = { collectVisibleConversations, extractConversationId, normalizeConversationUrl, scanConversations };
