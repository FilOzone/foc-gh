# Quickstart: Project Board OR Filter Development

**Branch**: `007-project-board-or-filter`

## Prerequisites

- Node.js installed
- Chrome browser
- GitHub account with access to FilOzone org projects

## Setup

```bash
# 1. Clone and switch to feature branch
git checkout 007-project-board-or-filter
npm install

# 2. Build the extension
npm run build

# 3. Launch Chrome with remote debugging (required for reload scripts)
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --remote-allow-origins='*' \
  --user-data-dir="$HOME/.chrome-dev-profile"

# 4. Load the extension in Chrome
#    - Navigate to chrome://extensions
#    - Enable "Developer mode"
#    - Click "Load unpacked" → select the extension/dist/ directory

# 5. Navigate to a project board to test
#    https://github.com/orgs/FilOzone/projects/14/views/20
```

## Development Loop

```bash
# Make code changes, then:
npm run build && node scripts/cdp-reload.mjs

# To stream service worker logs:
node scripts/sw-logs.mjs
```

## Key Files to Edit

| File | Purpose |
|------|---------|
| `extension/manifest.json` | Add content_scripts match for project board pages |
| `extension/src/content/board-filter/board-filter-main.ts` | Entry point: observe filter bar, detect OR syntax |
| `extension/src/content/board-filter/or-query-parser.ts` | Parse OR syntax into structured query |
| `extension/src/content/board-filter/memex-api.ts` | Call paginated_items API with pagination handling |
| `extension/src/content/board-filter/result-merger.ts` | Merge + deduplicate items from multiple branches |
| `extension/src/content/board-filter/board-data-injector.ts` | Main-world fetch interception |

## Test Queries

**Valid OR queries**:
- `cycle:202605-2 biglep (-status:"🎉 Done") OR (-last-updated:1days)`
- `(-status:"🎉 Done") OR (-last-updated:1days)`

**Invalid OR queries** (should fall back to native filter):
- `((nested))` — nested parentheses
- `(a) OR (b) trailing` — terms after final group
- `(a OR b)` — OR inside parentheses

**Non-OR queries** (should pass through unchanged):
- `cycle:202605-2 -status:"🎉 Done"`
- `biglep`

## Key API Endpoint

```
GET /memexes/{memexId}/paginated_items
  ?q={filter-string}
  &sortedBy[direction]={asc|desc}
  &sortedBy[columnId]={columnId}
  &groupedBy[columnId]={columnId}
  &sliceBy[columnId]={columnId}
  &fieldIds=[...]
  &after={cursor}        # for pagination
```

- `memexId`: Extract from `#memex-item-get-api-data` script tag on the page
- View params: Extract from `#memex-views` script tag
- Auth: Session cookies (same-origin, automatic)

## Browser Debugging Tips

- Open DevTools on the project board page
- Network tab: filter by `paginated_items` to see API calls
- Console: look for `[FilOz]` prefix from extension logs
- Elements: search for `#memex-paginated-items-data` to see embedded data
- Sources: check content script is loaded under `chrome-extension://` sources
