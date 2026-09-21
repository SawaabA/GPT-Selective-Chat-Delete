# GPT Selective Chat Delete

A local, open-source utility for scanning ChatGPT conversation history and previewing which conversations match a user-maintained keep list.

## Current status

**Scanning is always read-only. Permanent deletion is available only through a separate, explicitly confirmed delete mode.**

The tool opens ChatGPT in a persistent Playwright Chromium profile, lets you log in manually, scans conversation links in the sidebar, classifies each conversation as `KEEP` or `DELETE_CANDIDATE`, and writes local JSON and text reports. A delete candidate is only a preview label; no modification action exists in V0.1.

## Requirements

- Node.js 18 or newer
- Chromium installed through Playwright

## Setup

```sh
npm install
npx playwright install chromium
```

## Configure the keep list

Edit `config/keep-list.json`:

```json
{
  "exactTitles": ["An exact conversation title"],
  "titlePrefixes": ["Project prefix"],
  "conversationIds": ["conversation-id-from-the-url"]
}
```

Matching is case-insensitive and ignores repeated or surrounding title whitespace. Conversation IDs have first priority, followed by exact titles and then title prefixes. Titles are not used to identify unique conversations because different conversations can share a title.

## Run

If you use **Continue with Google**, first establish the session in ordinary Chrome, outside Playwright:

```sh
npm run login
```

Log into ChatGPT in the Chrome window that opens, then close every window using that profile. Google may reject OAuth sign-in in browsers controlled by automation; this command opens Chrome without Playwright control and stores the resulting session only in `data/browser-profile/`.

Then start the scanner:

```sh
npm run scan
```

ChatGPT opens in Google Chrome under Playwright control. If needed, complete login first with `npm run login`; then return to the scanner terminal and press Enter. The scanner scrolls the conversation history and creates:

- `reports/latest-preview.json`
- `reports/latest-preview.txt`
- `reports/latest-preview.html` (opens automatically with search and filters)

In the HTML preview, tick every conversation you want to keep and choose **Export keep-list.json**. Replace `config/keep-list.json` with the downloaded file before the next scan. The exported configuration uses conversation IDs rather than titles, so duplicate or renamed conversations remain unambiguous.

Run the unit tests and syntax checks with:

```sh
npm test
npm run check
```

## Privacy and safety

- The tool never asks for or stores a ChatGPT username or password.
- Login credentials and session data remain in the local Playwright browser profile.
- Reports remain local and may contain conversation titles and URLs.
- The browser profile and generated reports are excluded from Git and should never be committed.
- Normal scans and HTML reports are always read-only. Only the separate `npm run delete` command can modify chats, and only after its exact typed confirmation.

## Optional permanent deletion

First run `npm run scan` and verify the HTML preview and `config/keep-list.json`. Then run:

```sh
npm run delete
```

The delete command rescans ChatGPT, protects every configured keep ID, shows the exact deletion count, and requires an exact typed confirmation before clicking anything destructive. It stops on the first UI mismatch and writes `reports/latest-deletion-receipt.json` containing every successful or failed action.

Deletion is permanent and cannot be undone. Never enable delete mode until the preview is correct.

## Selector maintenance

ChatGPT's interface can change. DOM assumptions are centralized in `src/selectors.js`. If scanning reports that it cannot locate the sidebar, verify those selectors against the current ChatGPT interface before relying on a preview.
