const fs = require('node:fs/promises');
const path = require('node:path');
const { delay } = require('../utils');

function escapeAttribute(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

async function deleteConversation(page, conversation, options = {}) {
  const { actionDelayMs = 900 } = options;
  if (!conversation.id) throw new Error(`Cannot delete "${conversation.title}" because it has no conversation ID.`);

  const id = escapeAttribute(conversation.id);
  const trigger = page.locator(`[data-conversation-options-trigger="${id}"]`).first();
  if (!await trigger.isVisible().catch(() => false)) {
    throw new Error(`Could not find the options button for "${conversation.title}" (${conversation.id}). No deletion was attempted for this chat.`);
  }

  await trigger.click();
  const deleteMenuItem = page.getByRole('menuitem', { name: /^Delete$/i }).last();
  if (!await deleteMenuItem.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape').catch(() => {});
    throw new Error(`The Delete menu item was not found for "${conversation.title}". The ChatGPT layout may have changed.`);
  }
  await deleteMenuItem.click();

  const dialog = page.getByRole('dialog').last();
  if (!await dialog.isVisible().catch(() => false)) {
    throw new Error(`ChatGPT did not show a confirmation dialog for "${conversation.title}". Deletion stopped.`);
  }
  const confirmButton = dialog.getByRole('button', { name: /^Delete$/i }).last();
  if (!await confirmButton.isVisible().catch(() => false)) {
    throw new Error(`The final Delete confirmation was not found for "${conversation.title}". Deletion stopped.`);
  }

  await confirmButton.click();
  await delay(actionDelayMs);
  const stillPresent = await page.locator(`[data-conversation-options-trigger="${id}"]`).count();
  if (stillPresent) throw new Error(`ChatGPT did not remove "${conversation.title}" after confirmation. Deletion stopped to avoid an unreliable run.`);
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

module.exports = { deleteConversation, saveDeletionReceipt };
