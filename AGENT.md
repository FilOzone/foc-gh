# AGENT.md

## Project Overview

Chrome extension (Manifest V3) that adds utilities for the FOC team working in GitHub. Key feature: OR filter support for GitHub project board views.

## Build & Test

```bash
npm run build          # esbuild → extension/dist/
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
```

## Chrome Dev Workflow

### Launch dev Chrome

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --remote-allow-origins='*' \
  --user-data-dir="$HOME/.chrome-dev-profile"
```

Load the extension via "Load unpacked" → `extension/dist/` in `chrome://extensions` (or launch with `--load-extension="$(pwd)/extension/dist"` appended to the command above, which loads it non-interactively on every launch).

**Verify before proceeding** — do this every time before driving the dev Chrome instance, not just on first launch:

1. Confirm CDP is actually up: `curl -s http://127.0.0.1:9222/json/version`. If this fails, the browser either isn't running or wasn't launched with `--remote-debugging-port=9222` — relaunch it; don't assume a stale window is already wired up.
2. Confirm the extension is loaded and enabled — `chrome.management.getAll()` should include id `akbchnphednohmffplmejpefockadcbg` with `enabled: true` (see the CDP script pattern under "Reloading the extension" below; run the same `Runtime.evaluate` against any open tab).
3. Confirm the dev profile is actually **signed in to GitHub** before testing anything auth-gated (the picker, add/remove, membership state). Navigate to `https://github.com` and check for a real signed-in page (dashboard/feed, avatar in the top nav) rather than a "Sign in" prompt. `$HOME/.chrome-dev-profile` persists cookies across launches once you've signed in there once, but a fresh profile (or one created in a different `$HOME`, e.g. a sandboxed agent environment) starts logged out — sign in manually in that window if so. **Do not** fall back to a different Chrome/Brave instance or profile to "fix" this — a personal/work browser may be signed in but is out of scope for automated testing here; ask the user to sign in in the dev profile window instead.
4. Only after all three checks pass, proceed with navigation, screenshots, or DOM inspection against GitHub pages.

**Avoid stealing window focus while driving the dev browser.** `PUT http://127.0.0.1:9222/json/new?<url>` creates a brand-new tab (and can raise/focus the whole Chrome window), which yanks focus away from whatever else the user is doing on their machine — annoying mid-session. Prefer reusing one existing tab's CDP target for the whole session:

- Get its target id once (e.g. from `GET /json`, or the id returned by your first `/json/new` call).
- Navigate it repeatedly via `Page.navigate` over its `webSocketDebuggerUrl` (`Page.enable` once, then `Page.navigate({url})`) instead of opening a new tab per URL.
- Only call `PUT /json/new` again if you specifically need a second tab open concurrently (e.g. comparing two pages) or the reused tab's target has gone away.
- Never call `Page.bringToFront` / `Target.activateTarget` on the dev browser unless the user explicitly asks to see it live — driving it via CDP does not require the window to be foregrounded, and raising it interrupts the user's other work.

### Extension IDs

- **Unpacked (dev)**: `akbchnphednohmffplmejpefockadcbg` (stable via manifest key)
- **Chrome Web Store**: `haicdejjcnecapheflpdpdngflffejpf`

### Reloading the extension

**When Claude-in-Chrome is active** (the typical agent workflow), use the `chrome.management` API via the `chrome://extensions` page. This avoids disconnecting Claude-in-Chrome:

```javascript
// Run via CDP Runtime.evaluate on the chrome://extensions tab:
const id = 'akbchnphednohmffplmejpefockadcbg';
await chrome.management.setEnabled(id, false);
await new Promise(r => setTimeout(r, 500));
await chrome.management.setEnabled(id, true);
```

Full CDP script for agent use (Node.js, zero dependencies):
```javascript
const CDP_BASE = 'http://127.0.0.1:9222';
const res = await fetch(CDP_BASE + '/json');
const targets = await res.json();
const extPage = targets.find(t => t.url?.startsWith('chrome://extensions') && t.webSocketDebuggerUrl);
const ws = new WebSocket(extPage.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: {
  expression: `(async () => {
    const id = 'akbchnphednohmffplmejpefockadcbg';
    await chrome.management.setEnabled(id, false);
    await new Promise(r => setTimeout(r, 500));
    await chrome.management.setEnabled(id, true);
    return 'ok';
  })()`,
  awaitPromise: true
}}));
```

After reloading the extension, navigate the GitHub tab to pick up new content scripts.

**Without Claude-in-Chrome** (manual dev): `node scripts/cdp-reload.mjs` reloads the extension and refreshes GitHub tabs. Do NOT use this when Claude-in-Chrome is connected — it calls `chrome.runtime.reload()` which kills the service worker and disconnects Claude-in-Chrome.

### Build-reload-test cycle

```bash
npm run build  # then reload extension via chrome.management, then navigate tab
```

### Test URLs

- **OR filter (saved view)**: `https://github.com/orgs/FilOzone/projects/14/views/44`

## Architecture

- `extension/src/content/board-filter/` — OR filter feature (fetch interceptor, parser, merger)
- `extension/src/content/native-picker/` — global boards as native rows in GitHub's Projects picker via data injection (fetch interception, Relay store commits, IndexedDB persister seeding)
- `extension/src/content/pr-expand/` — PR description auto-expand
- `extension/src/lib/` — shared config, GitHub auth
- `scripts/` — dev tooling (CDP reload, SW logs)
- `specs/` — feature specs and research docs

See `specs/007-project-board-or-filter/research.md` for detailed architecture of the OR filter feature (React Query cache invalidation) and `specs/008-native-picker-data-injection/research.md` for the native picker data injection (GitHub feed shapes, Relay membership commits, legacy PR form semantics).
