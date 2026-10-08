# Cloudy Chat Cleanup for ChatGPT

Cloudy Chat Cleanup is a kawaii local Chrome extension for searching, selecting, archiving, restoring, and safely deleting multiple ChatGPT conversations from a normal signed-in browser session.

Its original cloud-cleaner mascot was generated specifically for this project. The remaining cloud shapes, pastel surfaces, sparkles, controls, and dark theme are implemented locally in CSS with no third-party design assets.

The previous Playwright desktop-style tool is preserved as **legacy mode**. None of its files or commands were removed; the explicit `legacy:*` command aliases make it easy to call again.

## Recommended: local Chrome extension

The extension does not launch or control Chrome. It runs inside the regular Chrome profile where you already use ChatGPT, which avoids the automation-controlled browser session that can provoke repeated Cloudflare human-verification challenges.

It cannot bypass Cloudflare. You must first be able to open `https://chatgpt.com` normally and complete any human check yourself.

### Install it locally

1. Open Chrome and visit `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository's `extension` folder.
5. Open or refresh `https://chatgpt.com` in your normal signed-in profile.
6. Click **Manage history** in the ChatGPT sidebar. It opens a dedicated selection mode over the left sidebar. If the sidebar is unavailable, the button appears as a small floating launcher.

### Extension workflow

1. Open **Manage history**. Active chats load automatically.
2. Search by title, select individual chats, Shift-click a range, or use **Select all** for the filtered list.
3. Click **Archive** for reversible cleanup, or **Delete** for permanent removal.
4. Before deletion, review every selected title in the confirmation dialog.
5. Use the **Archived** tab to search, restore, or permanently delete archived chats.
6. Leave the ChatGPT tab open while a batch is running.

Large histories are searched and selected as one collection, while the visible checklist renders in 200-chat chunks to keep the ChatGPT page responsive.

The extension sends requests only to the ChatGPT origin from the signed-in tab. It does not request an OpenAI API key, read message bodies, or send conversation metadata to an outside server.

### Cloudflare and rate limits

- The extension avoids Playwright and uses your normal browser session, so it removes the likely automation signal behind the Cloudflare loop.
- It does not and cannot bypass a Cloudflare challenge affecting normal Chrome. Resolve that challenge manually before using the extension.
- Bulk actions are sequential, with a 1.2-second interval and a 12-second break after every 20 successful actions.
- If ChatGPT returns HTTP 429, the batch stops immediately, honors `Retry-After` when present, applies a minimum two-minute cooldown, and keeps undeleted chats selected for review and resumption.
- Rate limiting is controlled by ChatGPT and cannot be guaranteed away. Use smaller batches if the account or network is being limited.

## Legacy Playwright tool

The original application remains available for recovery, comparison, and future debugging:

```sh
npm run legacy:login
npm run legacy:app
npm run legacy:scan
npm run legacy:delete
```

The original shorter command names (`npm run login`, `npm run app`, `npm run scan`, and `npm run delete`) remain aliases for backward compatibility.

The legacy tool uses Playwright to open ChatGPT in a dedicated Chrome profile. If that profile enters a repeating Cloudflare verification loop, close it and use the extension in normal Chrome instead.

## Legacy status

The preserved legacy release supports:

- Manual ChatGPT login in a local Chrome profile
- Scanning lazy-loaded conversation history
- Conversation ID, title, and URL collection
- Duplicate removal using conversation IDs or URLs
- Searchable HTML previews
- Keep-selection checkboxes
- ID-based keep-list export
- JSON and text reports
- Guarded, explicitly confirmed permanent deletion with post-action verification

**Permanent deletion is disabled by default in the dashboard.** Before acting, the app requires the fresh scan to contain exactly the same conversation IDs as the reviewed scan. It then verifies each deletion before continuing. Review every selection and understand that deletion cannot be undone before enabling it.

## Safety model

- Scanning does not modify ChatGPT data.
- The app never asks for your ChatGPT or Google password.
- Login happens directly in the browser.
- Credentials and session cookies remain in `data/browser-profile/` on your computer.
- Reports remain local and may contain conversation titles, IDs, and URLs.
- The browser profile and generated reports are ignored by Git.
- Delete mode requires a fresh scan, an explicit toggle, and an exact confirmation phrase containing the candidate count.
- Deletion is paced, verifies each result, and stops on changed history, UI mismatches, or rate-limit notices.

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

Nothing is preselected for deletion. Select conversations explicitly and use the deletion review dialog to inspect the exact list. Unselected conversations are never sent to the deletion workflow.

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
| `npm run delete` | Run the guarded deletion flow with fresh scanning and typed confirmation |

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

## Deletion safeguards and limitations

Deletion currently attempts to:

- Verify the exact conversation ID immediately before acting
- Require the reviewed and fresh scans to contain the exact same ID set
- Verify that ChatGPT navigates away from or reports the deleted conversation unavailable
- Stop when ChatGPT's expected controls are missing
- Detect rate-limit notices
- Pace requests and pause between small batches
- Preserve a local best-effort receipt
- Require explicit confirmation for the exact candidate count

ChatGPT remains an external interface that can change without notice. The app stops if it cannot verify a deletion, and its receipt distinguishes verified deletions from failures. Run a new scan after each deletion batch to refresh the dashboard and confirm the resulting live history.
