const { launchBrowser } = require('./src/browser');
const { ACTIONS, classifyConversations } = require('./src/classifier');
const { DEFAULT_OPTIONS, loadKeepList } = require('./src/config');
const { deleteConversation, saveDeletionReceipt } = require('./src/actions/delete');
const { createExplicitDeletionPlan } = require('./src/deletion-plan');
const { createReport, formatAppLanding, formatHtmlReport, saveReport } = require('./src/reporter');
const { scanConversations } = require('./src/scanner');
const { delay } = require('./src/utils');

async function main() {
  const keepList = await loadKeepList();
  const browser = await launchBrowser(DEFAULT_OPTIONS);
  const { context, page: chatPage } = browser;
  const dashboard = await context.newPage();
  let latestReport = null;
  let deleting = false;

  await dashboard.exposeBinding('chatCleanupShowChat', async () => chatPage.bringToFront());
  await dashboard.exposeBinding('chatCleanupScan', async () => {
    await chatPage.bringToFront();
    const conversations = await scanConversations(chatPage, {
      ...DEFAULT_OPTIONS,
      onProgress: async (found) => dashboard.evaluate((value) => window.updateScanProgress?.(value), found).catch(() => {}),
    });
    latestReport = createReport(classifyConversations(conversations, keepList));
    await saveReport(latestReport);
    await dashboard.bringToFront();
    return formatHtmlReport(latestReport);
  });
  await dashboard.exposeBinding('chatCleanupDelete', async (_source, request) => {
    if (deleting) throw new Error('A deletion run is already in progress.');
    if (!latestReport) throw new Error('Run a scan first.');
    if (!request || !Array.isArray(request.deleteIds)) throw new Error('Invalid delete selection.');
    const expectedCount = Number(request.candidateCount);
    const expectedPhrase = `DELETE ${expectedCount} CHATS`;
    if (request.confirmation !== expectedPhrase) throw new Error('The confirmation phrase does not match.');

    deleting = true;
    const receipt = [];
    let receiptSaved = false;
    try {
      await chatPage.bringToFront();
      const freshScan = await scanConversations(chatPage, DEFAULT_OPTIONS);
      const candidates = createExplicitDeletionPlan(latestReport.conversations, freshScan, request.deleteIds, expectedCount);

      for (let index = 0; index < candidates.length; index += 1) {
        if (dashboard.isClosed()) throw new Error('The dashboard was closed.');
        const conversation = candidates[index];
        await dashboard.evaluate(({ current, total, title }) => window.updateDeletionProgress?.({ message: `Deleting ${current} of ${total}: ${title}` }), {
          current: index + 1, total: candidates.length, title: conversation.title,
        });
        try {
          await deleteConversation(chatPage, conversation);
          receipt.push({ ...conversation, status: 'DELETED', deletedAt: new Date().toISOString() });
          await dashboard.evaluate(({ title }) => window.updateDeletionProgress?.({ status: 'DELETED', title, message: `Verified deletion: ${title}` }), { title: conversation.title });
          if ((index + 1) % 5 === 0 && index + 1 < candidates.length) {
            await dashboard.evaluate(() => window.updateDeletionProgress?.({ message: 'Cooling down for 30 seconds to avoid ChatGPT rate limits...' }));
            await delay(30_000);
          }
        } catch (error) {
          receipt.push({ ...conversation, status: error.code === 'CHATGPT_RATE_LIMIT' ? 'RATE_LIMITED' : 'FAILED', error: error.message });
          await dashboard.evaluate(({ title, message }) => window.updateDeletionProgress?.({ status: 'FAILED', title, message }), { title: conversation.title, message: error.message }).catch(() => {});
          throw error;
        }
      }
      const receiptPath = await saveDeletionReceipt(receipt);
      receiptSaved = true;
      await dashboard.bringToFront();
      const deletedCount = receipt.filter(({ status }) => status === 'DELETED').length;
      return { deletedCount, message: `Verified deletion of ${deletedCount} chats. Receipt saved to ${receiptPath}` };
    } finally {
      if (receipt.length && !receiptSaved) await saveDeletionReceipt(receipt);
      deleting = false;
    }
  });

  await dashboard.setContent(formatAppLanding(), { waitUntil: 'domcontentloaded' });
  await dashboard.bringToFront();
  console.log('Chat Cleanup dashboard opened. Complete the flow in the browser.');
  await new Promise((resolve) => context.once('close', resolve));
}

main().catch((error) => {
  console.error(`Chat Cleanup stopped: ${error.message}`);
  process.exitCode = 1;
});
