const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

function chromeCandidates() {
  if (process.platform === 'win32') {
    return [
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ].filter(Boolean);
  }
  if (process.platform === 'darwin') return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  return ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'];
}

function findChrome() {
  return chromeCandidates().find((candidate) => fs.existsSync(candidate));
}

function main() {
  const executable = findChrome();
  if (!executable) {
    throw new Error('Google Chrome was not found. Install Chrome, or log in with email/password in the Playwright browser instead of using Google sign-in.');
  }

  const profilePath = path.join(__dirname, '..', 'data', 'browser-profile');
  fs.mkdirSync(profilePath, { recursive: true });
  const browser = spawn(executable, [`--user-data-dir=${profilePath}`, 'https://chatgpt.com/'], {
    detached: true,
    stdio: 'ignore',
  });
  browser.unref();

  console.log('Opened ordinary Google Chrome with the scanner\'s local browser profile.');
  console.log('Log into ChatGPT, then close every Chrome window using this profile before running npm run scan.');
  console.log('The tool does not receive or store your password.');
}

try {
  main();
} catch (error) {
  console.error(`Could not open Chrome: ${error.message}`);
  process.exitCode = 1;
}
