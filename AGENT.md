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

Load the extension via "Load unpacked" → `extension/dist/` in `chrome://extensions`.

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
- `extension/src/content/pr-expand/` — PR description auto-expand
- `extension/src/lib/` — shared config, GitHub auth
- `scripts/` — dev tooling (CDP reload, SW logs)
- `specs/` — feature specs and research docs

See `specs/007-project-board-or-filter/research.md` for detailed architecture of the OR filter feature, including the React Query cache invalidation approach.
