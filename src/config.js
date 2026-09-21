const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_OPTIONS = Object.freeze({
  navigationTimeoutMs: 60_000,
  scanTimeoutMs: 120_000,
  scrollDelayMs: 900,
  maxScrollAttempts: 150,
  stableScrollAttempts: 5,
});

function validateKeepList(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Keep list must be a JSON object.');
  }

  const fields = ['exactTitles', 'titlePrefixes', 'conversationIds'];
  for (const field of fields) {
    if (!Array.isArray(value[field]) || value[field].some((item) => typeof item !== 'string')) {
      throw new Error(`Keep list field "${field}" must be an array of strings.`);
    }
  }
  return value;
}

async function loadKeepList(filePath = path.join(__dirname, '..', 'config', 'keep-list.json')) {
  let content;
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Could not read keep list at ${filePath}: ${error.message}`);
  }

  try {
    return validateKeepList(JSON.parse(content));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`Invalid JSON in keep list at ${filePath}: ${error.message}`);
    throw error;
  }
}

module.exports = { DEFAULT_OPTIONS, loadKeepList, validateKeepList };
