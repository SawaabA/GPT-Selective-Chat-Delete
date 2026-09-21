const { launchBrowser } = require('./src/browser');
const { classifyConversations, ACTIONS } = require('./src/classifier');
const { DEFAULT_OPTIONS, loadKeepList } = require('./src/config');
const { deleteConversation, saveDeletionReceipt } = require('./src/actions/delete');
const { scanConversations } = require('./src/scanner');
const { prompt, waitForEnter } = require('./src/utils');

async function main() {
  const keepList = await loadKeepList();
  let context;
  const receipt = [];
  try {
    const browser = await launchBrowser(DEFAULT_OPTIONS);
    context = browser.context;
    console.log('\nDELETE MODE');
    console.log('Chat deletion is permanent and cannot be undone.');
    await waitForEnter('Confirm that ChatGPT is logged in and the sidebar is visible.');

    const scanned = await scanConversations(browser.page, DEFAULT_OPTIONS);
    const classified = classifyConversations(scanned, keepList);
    const keep = classified.filter(({ action }) => action === ACTIONS.KEEP);
    const candidates = classified.filter(({ action }) => action === ACTIONS.DELETE_CANDIDATE);

    console.log(`\nKeep protected: ${keep.length}`);
    console.log(`Permanent deletions proposed: ${candidates.length}`);
    if (!candidates.length) {
      console.log('Nothing to delete.');
      return;
    }

    const phrase = `DELETE ${candidates.length} CHATS`;
    const answer = await prompt(`\nType exactly "${phrase}" to enable deletion mode: `);
    if (answer !== phrase) {
      console.log('Confirmation did not match. No chats were modified.');
      return;
    }

    console.log('\nDeletion mode enabled. Do not close the browser.');
    for (let index = 0; index < candidates.length; index += 1) {
      const conversation = candidates[index];
      process.stdout.write(`[${index + 1}/${candidates.length}] ${conversation.title} ... `);
      try {
        await deleteConversation(browser.page, conversation);
        receipt.push({ ...conversation, status: 'DELETED', deletedAt: new Date().toISOString() });
        console.log('deleted');
      } catch (error) {
        receipt.push({ ...conversation, status: 'FAILED', error: error.message });
        console.log('stopped');
        throw error;
      }
    }
  } finally {
    if (receipt.length) {
      const receiptPath = await saveDeletionReceipt(receipt);
      console.log(`Deletion receipt: ${receiptPath}`);
    }
    if (context) await context.close().catch(() => {});
  }
}

main().then(() => {
  console.log('Cleanup command complete.');
}).catch((error) => {
  console.error(`\nDeletion stopped: ${error.message}`);
  console.error('Review the deletion receipt before trying again.');
  process.exitCode = 1;
});
