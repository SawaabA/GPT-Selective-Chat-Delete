// Keep all assumptions about ChatGPT's changing DOM in this file.
module.exports = Object.freeze({
  conversationLinks: 'a[href^="/c/"], a[href*="chatgpt.com/c/"]',
  sidebarCandidates: 'nav, aside, [data-testid*="sidebar" i]',
  sidebarToggleButtons: [
    'button[aria-label*="sidebar" i]',
    'button[aria-label*="menu" i]',
  ],
  loginIndicators: [
    'a[href*="/auth/login"]',
    'button:has-text("Log in")',
    'button:has-text("Sign up")',
  ],
});
