# Chrome Extension Debug Loop

## Build → reload → verify cycle

```bash
# 1. Build
npm run build

# 2. Reload the FilOzone extension in Chrome
osascript scripts/reload-extension.applescript
```

**Prerequisite**: Chrome must have "Allow JavaScript from Apple Events" enabled.
Enable it: Chrome menu → View → Developer → Allow JavaScript from Apple Events.

The `chrome://extensions` tab must already be open. The script (`scripts/reload-extension.applescript`)
recurses through shadow DOMs to find `#dev-reload-button` inside the FilOzone `extensions-item`.

**Why a script file, not inline `-e`**: The Claude Code permission pattern `Bash(osascript:*)`
does not match multi-line inline AppleScript strings. Keeping the logic in a file means the
Bash invocation stays on one line and matches the allow rule cleanly.

## Verify the reload landed

After reloading, navigate to a GitHub issue or PR and check the page console for:

```
[FilOzone] content script loaded: <BUILD_MARKER>
[FilOzone] pr-expand-main-world running
```

The `BUILD_MARKER` constant is in `extension/src/content/issue-sidebar.ts`. Update it
to a new value before each debug session to confirm you're running the latest build.

## Reference URLs for manual testing

Use these GitHub pages when exercising the extension (same-org vs cross-org, issue vs PR):

| Context | URL |
|---------|-----|
| FilOzone PR | https://github.com/FilOzone/tpm-utils/pull/7 |
| FilOzone issue | https://github.com/FilOzone/tpm-utils/issues/1 |
| Non-FilOzone PR (cross-org) | https://github.com/filecoin-project/filecoin-pin/pull/386 |
| Non-FilOzone issue (cross-org) | https://github.com/filecoin-project/filecoin-pin/issues/385 |

## Why not `chrome.runtime.reload()`?

Calling `chrome.runtime.reload()` from the options page restarts the service worker
but does **not** reload already-injected content scripts in open tabs, so you need to
navigate to the page again anyway. Clicking `#dev-reload-button` reloads the full
extension from disk (equivalent to the manual reload icon in the Extensions UI).

## Why not the "Update" button?

The top-level "Update" button (`#updateNow` in `extensions-toolbar`) triggers a
Chrome Web Store update check — it does **not** reload locally-loaded unpacked
extensions from disk.
