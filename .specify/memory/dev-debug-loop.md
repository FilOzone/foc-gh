# Chrome Extension Debug Loop

## Build → reload → verify cycle

```bash
# 1. Build
npm run build

# 2. Reload the FilOzone extension in Chrome (osascript, shadow-DOM aware)
osascript -e 'tell application "Google Chrome"
  repeat with w in windows
    repeat with t in tabs of w
      if URL of t starts with "chrome://extensions" then
        return execute t javascript "(function() {
          function findAndReload(root) {
            var items = root.querySelectorAll(\"extensions-item\");
            for (var i = 0; i < items.length; i++) {
              var s = items[i].shadowRoot;
              var name = s && s.querySelector(\"#name\");
              if (name && name.textContent.indexOf(\"FilOzone\") !== -1) {
                var btn = s.querySelector(\"#dev-reload-button\");
                if (btn) { btn.click(); return \"reloaded\"; }
              }
            }
            var all = root.querySelectorAll(\"*\");
            for (var j = 0; j < all.length; j++) {
              if (all[j].shadowRoot) { var r = findAndReload(all[j].shadowRoot); if (r) return r; }
            }
            return null;
          }
          return findAndReload(document) || \"not found\";
        })()"
      end if
    end repeat
  end repeat
end tell'
```

**Prerequisite**: Chrome must have "Allow JavaScript from Apple Events" enabled.
Enable it: Chrome menu → View → Developer → Allow JavaScript from Apple Events.

The `chrome://extensions` tab must already be open. The osascript recurses through
shadow DOMs to find `#dev-reload-button` inside the FilOzone `extensions-item`.

## Verify the reload landed

After reloading, navigate to a GitHub issue or PR and check the page console for:

```
[FilOzone] content script loaded: <BUILD_MARKER>
[FilOzone] pr-expand-main-world running
```

The `BUILD_MARKER` constant is in `extension/src/content/issue-sidebar.ts`. Update it
to a new value before each debug session to confirm you're running the latest build.

## Why not `chrome.runtime.reload()`?

Calling `chrome.runtime.reload()` from the options page restarts the service worker
but does **not** reload already-injected content scripts in open tabs, so you need to
navigate to the page again anyway. Clicking `#dev-reload-button` reloads the full
extension from disk (equivalent to the manual reload icon in the Extensions UI).

## Why not the "Update" button?

The top-level "Update" button (`#updateNow` in `extensions-toolbar`) triggers a
Chrome Web Store update check — it does **not** reload locally-loaded unpacked
extensions from disk.
