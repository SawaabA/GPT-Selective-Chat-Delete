# GPT Selective Chat Delete

GPT Selective Chat Delete is a local desktop-style tool for reviewing a ChatGPT conversation history and building a reliable list of conversations to keep.

It uses Playwright to open ChatGPT in a dedicated Google Chrome profile. You log in yourself, the app scans the conversation sidebar, and a local dashboard lets you search the results and tick the conversations you want to protect.

## Current status

The current release supports:

- Manual ChatGPT login in a local Chrome profile
- Scanning lazy-loaded conversation history
- Conversation ID, title, and URL collection
- Duplicate removal using conversation IDs or URLs
- Searchable HTML previews
- Keep-selection checkboxes
- ID-based keep-list export
- JSON and text reports
- Experimental, explicitly confirmed permanent deletion

**Permanent deletion is experimental and disabled by default in the dashboard.** ChatGPT's interface and rate limits can make bulk results ambiguous. Review the fresh scan carefully, preserve every required conversation, and understand that deletion cannot be undone before enabling it.

## Safety model

- Scanning does not modify ChatGPT data.
- The app never asks for your ChatGPT or Google password.
- Login happens directly in the browser.
- Credentials and session cookies remain in `data/browser-profile/` on your computer.
- Reports remain local and may contain conversation titles, IDs, and URLs.
- The browser profile and generated reports are ignored by Git.
- Delete mode requires a fresh scan, an explicit toggle, and an exact confirmation phrase containing the candidate count.
- Deletion is paced and stops on UI mismatches or rate-limit notices.

## Requirements

- Node.js 18 or newer
- Google Chrome installed locally
- Playwright and its Chromium support files

## Installation

```sh
npm install
npx playwright install chromium
```

## First-time login

Google may reject authentication inside a browser controlled by automation. The login helper opens ordinary Chrome, without Playwright control, using the app's dedicated profile:

```sh
npm run login
```

In the Chrome window that opens:

1. Visit or remain on ChatGPT.
2. Log in normally.
3. Confirm that your conversation sidebar appears.
4. Close every Chrome window using this dedicated profile.

The saved session will be reused by later scans. Do not copy or commit `data/browser-profile/` because it contains local session data.

## Recommended app flow

Start the integrated dashboard:

```sh
npm run app
```

The app opens two tabs in its dedicated Chrome session:

1. **ChatGPT tab** - confirms the account is logged in and gives the scanner access to the visible conversation history.
2. **Chat Cleanup dashboard** - controls scanning and displays the results.

In the dashboard:

1. Click **Open ChatGPT tab** if you need to confirm the session.
2. Return to the dashboard.
3. Click **Scan conversations**.
4. Wait while the app scrolls through lazy-loaded history.
5. Search or filter the resulting conversation table.
6. Tick every conversation you want to keep.
7. Click **Export keep-list.json**.
8. Replace `config/keep-list.json` with the downloaded file if you want those selections to become the default for future scans.

The dashboard's delete control starts off. Enabling it reveals the candidate count, permanent-deletion warning, and exact confirmation field.

## Read-only terminal scan

For a scan without the integrated dashboard, run:

```sh
npm run scan
```

After Chrome opens, confirm that ChatGPT is logged in and press Enter in the terminal. The app scans the sidebar and creates:

- `reports/latest-preview.html` - searchable visual report
- `reports/latest-preview.json` - structured scan data
- `reports/latest-preview.txt` - plain-text summary

The HTML report opens automatically in your default browser.

## Keep-list configuration

The keep list is stored in `config/keep-list.json`:

```json
{
  "exactTitles": ["An exact conversation title"],
  "titlePrefixes": ["Project prefix"],
  "conversationIds": ["conversation-id-from-the-url"]
}
```

Matching priority is:

1. `conversationIds`
2. `exactTitles`
3. `titlePrefixes`

Title matching is case-insensitive, trims surrounding whitespace, and collapses repeated spaces. Conversation IDs are strongly preferred because titles can be duplicated or renamed.

Every scanned conversation is classified as either:

- `KEEP`
- `DELETE_CANDIDATE`

`DELETE_CANDIDATE` means only that the conversation did not match the keep list. It does not cause deletion.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run login` | Open ordinary Chrome with the dedicated local profile for manual login |
| `npm run app` | Open the integrated scanning and keep-selection dashboard |
| `npm run scan` | Run the read-only terminal scanner and generate reports |
| `npm test` | Run unit tests |
| `npm run check` | Run JavaScript syntax checks |
| `npm run delete` | Run the experimental deletion flow with fresh scanning and typed confirmation |

## Local files and privacy

The following paths are intentionally excluded from Git:

- `node_modules/`
- `data/browser-profile/`
- `reports/*.json`
- `reports/*.txt`
- `reports/*.html`
- `.env`
- `*.log`

Treat the browser profile and reports as private. Reports can reveal conversation titles and direct ChatGPT conversation URLs.

## Testing

Run:

```sh
npm test
npm run check
```

Classifier tests cover exact-title matching, case-insensitive matching, whitespace normalization, prefix matching, duplicate titles, conversation-ID matching, and nonmatching conversations. Reporter tests cover counts, Unicode handling, HTML escaping, and dashboard controls.

## Project structure

```text
config/
  keep-list.json
reports/
  .gitkeep
src/
  actions/
  browser.js
  classifier.js
  config.js
  manual-login.js
  reporter.js
  scanner.js
  selectors.js
  utils.js
tests/
app.js
index.js
```

Scanning, classification, reporting, and browser management are separated so the interface can evolve without coupling keep-list logic to ChatGPT's DOM.

## ChatGPT interface changes

ChatGPT's interface and rate limits can change without notice. DOM assumptions are centralized in `src/selectors.js`. The scanner uses bounded scrolling, timeouts, and duplicate detection, and it stops with an understandable error when the sidebar cannot be identified reliably.

If a scan returns unexpectedly few conversations, stop and try again later. Do not treat a partial scan as evidence that conversations were deleted; ChatGPT may be rate-limiting or temporarily failing to load older history.

## Experimental deletion limitations

Deletion currently attempts to:

- Verify the exact conversation ID immediately before acting
- Stop when ChatGPT's expected controls are missing
- Detect rate-limit notices
- Pace requests and pause between small batches
- Preserve a local best-effort receipt
- Require explicit confirmation for the exact candidate count

ChatGPT does not always expose a reliable completion signal after a menu action. A receipt therefore records what the automation attempted and observed, but it should not be treated as proof that every listed chat disappeared. Rescan after each run and compare the live history before continuing.
