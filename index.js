const { launchBrowser } = require('./src/browser');
const { classifyConversations } = require('./src/classifier');
const { DEFAULT_OPTIONS, loadKeepList } = require('./src/config');
const { createReport, saveReport } = require('./src/reporter');
const { scanConversations } = require('./src/scanner');
const { openLocalFile, waitForEnter } = require('./src/utils');

async function main() {
  const keepList = await loadKeepList();
  let context;
  try {
    const browser = await launchBrowser(DEFAULT_OPTIONS);
    context = browser.context;
    console.log('Please log into ChatGPT in the browser if necessary.');
    await waitForEnter('The scanner is read-only and will only inspect conversation links.');

    const conversations = await scanConversations(browser.page, DEFAULT_OPTIONS);
    const report = createReport(classifyConversations(conversations, keepList));
    const reportPaths = await saveReport(report);
    const reportOpened = await openLocalFile(reportPaths.html);
    console.log('\nPreview ready:');
    console.log(`  Total conversations: ${report.total}`);
    console.log(`  Keep: ${report.keepCount}`);
    console.log(`  Delete candidates: ${report.deleteCandidateCount}`);
    console.log(`  ${reportOpened ? 'Opened local report' : 'Open this local report'}: ${reportPaths.html}\n`);
    console.log('SCAN COMPLETE — NO CHATS WERE MODIFIED.');
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`\nScan failed: ${error.message}`);
  console.error('SCAN COMPLETE — NO CHATS WERE MODIFIED.');
  process.exitCode = 1;
});
