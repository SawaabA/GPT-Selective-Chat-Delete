const readline = require('node:readline');
const { spawn } = require('node:child_process');

function normalizeTitle(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function waitForEnter(message) {
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => terminal.question(`${message}\nPress ENTER to start scanning. `, () => {
    terminal.close();
    resolve();
  }));
}

function prompt(message) {
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => terminal.question(message, (answer) => {
    terminal.close();
    resolve(answer.trim());
  }));
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function openLocalFile(filePath) {
  const command = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  return new Promise((resolve) => {
    const child = spawn(command, [filePath], { detached: true, stdio: 'ignore' });
    child.once('spawn', () => {
      child.unref();
      resolve(true);
    });
    child.once('error', () => resolve(false));
  });
}

module.exports = { normalizeTitle, waitForEnter, prompt, delay, openLocalFile };
