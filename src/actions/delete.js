const fs = require('node:fs/promises');
const path = require('node:path');
const { delay } = require('../utils');

async function clickVerifiedElement(locator, description) {
  await locator.waitFor({ state: 'visible' });
  await locator.evaluate((element, label) => {
    const disabled = element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true';
    if (disabled) throw new Error(`${label} is disabled.`);
    element.click();
  }, description);
}

async function clickVisibleMenuItem(page, label) {
  const clicked = await page.evaluate((itemLabel) => {
    const isVisible = (element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && box.width > 0 && box.height > 0;
    };
    const openMenus = [...document.querySelectorAll('[role="menu"]')].filter(isVisible);
    const menu = openMenus.at(-1);
    if (!menu) return { ok: false, reason: 'No visible conversation menu was found.' };
    const item = [...menu.querySelectorAll('[role="menuitem"]')]
      .find((element) => element.textContent.trim().toLocaleLowerCase() === itemLabel.toLocaleLowerCase());
    if (!item) return { ok: false, reason: `The ${itemLabel} menu item was not found in the open conversation menu.` };
    if (item.getAttribute('aria-disabled') === 'true') return { ok: false, reason: `The ${itemLabel} menu item is disabled.` };
    item.click();
    return { ok: true };
  }, label);
  if (!clicked.ok) throw new Error(clicked.reason);
}

async function deleteConversation(page, conversation, options = {}) {
  const { actionDelayMs = 6_000 } = options;
  if (!conversation.id) throw new Error(`Cannot delete "${conversation.title}" because it has no conversation ID.`);

  const conversationUrl = `https://chatgpt.com/c/${encodeURIComponent(conversation.id)}`;
  await page.goto(conversationUrl, { waitUntil: 'domcontentloaded' });
  await delay(500);
  const currentPath = new URL(page.url()).pathname;
  if (currentPath !== `/c/${conversation.id}`) {
    throw new Error(`ChatGPT did not open the exact conversation ID ${conversation.id}. No deletion was attempted.`);
  }

  const trigger = page.getByTestId('conversation-options-button');
  if (!await trigger.isVisible().catch(() => false)) {
    throw new Error(`Could not find the active conversation options for "${conversation.title}" (${conversation.id}). No deletion was attempted.`);
  }

  await clickVerifiedElement(trigger, `The options button for "${conversation.title}"`);
  await clickVisibleMenuItem(page, 'Delete');
  await delay(400);

  // ChatGPT currently deletes immediately from this menu, but some layouts
  // still show a confirmation surface. Support both without assuming one.
  const confirmationSurface = page.locator('[role="dialog"], [role="alertdialog"]').last();
  if (await confirmationSurface.isVisible().catch(() => false)) {
    const confirmationText = await confirmationSurface.textContent().catch(() => '');
    if (/too many requests|temporarily limited|requests too quickly/i.test(confirmationText)) {
      const error = new Error('ChatGPT temporarily rate-limited conversation access. Wait several minutes before starting a new deletion run.');
      error.code = 'CHATGPT_RATE_LIMIT';
      throw error;
    }
    const confirmButton = confirmationSurface.getByRole('button', { name: /^Delete$/i }).last();
    if (!await confirmButton.isVisible().catch(() => false)) {
      throw new Error(`A confirmation appeared without an exact Delete button for "${conversation.title}". Deletion stopped.`);
    }
    await clickVerifiedElement(confirmButton, `The final Delete button for "${conversation.title}"`);
  }
  await delay(actionDelayMs);
}

async function saveDeletionReceipt(entries, reportsDirectory = path.join(__dirname, '..', '..', 'reports')) {
  const receipt = {
    generatedAt: new Date().toISOString(),
    deletedCount: entries.filter(({ status }) => status === 'DELETED').length,
    entries,
  };
  await fs.mkdir(reportsDirectory, { recursive: true });
  const receiptPath = path.join(reportsDirectory, 'latest-deletion-receipt.json');
  await fs.writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return receiptPath;
}

module.exports = { clickVerifiedElement, clickVisibleMenuItem, deleteConversation, saveDeletionReceipt };
