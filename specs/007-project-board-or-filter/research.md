# Research: Enable Project Board Filtering with OR Conditions

**Date**: 2026-05-27  
**Branch**: `007-project-board-or-filter`

## Key Findings

### 1. GitHub Project Board Data Architecture

**Decision**: The extension must intercept filter submission and use GitHub's internal memex API to fetch multiple filtered item sets.

**Rationale**: GitHub project boards (internally called "memex") use a two-phase data loading model:

- **Initial page load**: Data is server-rendered into a `<script id="memex-paginated-items-data">` tag (~190KB JSON blob). The board renders from this on first paint.
- **Subsequent interactions** (filter changes, view switches): The React app calls `GET /memexes/{memexId}/paginated_items?q={filter}&sortedBy[direction]=...&groupedBy[columnId]=...&fieldIds=[...]` — an internal API that returns filtered items. The embedded script tag becomes stale after the first interaction.
- Individual issue details are lazy-loaded via `GET /_graphql` (IssueViewerViewQuery) as rows scroll into view.
- The board is rendered by a `<projects-v2 id="memex-root">` custom element. GitHub uses **Turbo** for SPA navigation (no full page reloads on view/filter changes).

**Alternatives considered**:
- Intercepting GraphQL queries — rejected: the board uses `/memexes/{id}/paginated_items`, not GraphQL, for item listing.
- Using the public GitHub ProjectV2 GraphQL API — rejected: it doesn't support the board's filter syntax (`cycle:`, `last-updated:`, keyword matching, etc.).
- Parsing full HTML pages for each branch — rejected: now that we know the API endpoint, calling it directly is cleaner and more efficient.

### 2. The Memex Paginated Items API

**Decision**: Use `GET /memexes/{memexId}/paginated_items` as the primary data source for OR branches.

**Observed API contract** (reverse-engineered from browser network traffic):

```
GET /memexes/{memexId}/paginated_items
  ?q={filter-string}                    # The filter query (same syntax as filter bar)
  &sortedBy[direction]={asc|desc}       # Sort direction
  &sortedBy[columnId]={columnId}        # Sort field
  &groupedBy[columnId]={Status|...}     # Group-by field
  &sliceBy[columnId]={columnId}         # Slice field (optional)
  &fieldIds=[id1,id2,...]              # Which field values to return
  &after={base64-cursor}               # Pagination cursor (for subsequent pages)
```

**Pagination**: Uses cursor-based pagination via the `after` parameter (base64-encoded cursor). When loading the "All" view (360 items), 3 successive `paginated_items` calls were observed with different `after` cursors. All items for a view are fetched eagerly (not lazily on scroll).

**Authentication**: Same-origin requests use session cookies automatically. No additional auth needed from the extension.

**Key parameters**:
- `q`: The filter string, identical to what the user types in the filter bar
- `memexId`: Found in `#memex-item-get-api-data` script tag (`{"url":"/memexes/{memexId}/items"}`)
- View-specific params (`sortedBy`, `groupedBy`, `sliceBy`, `fieldIds`): Derived from the current view configuration in `#memex-views` script tag

### 3. Embedded Data Structure

The initial embedded JSON (`#memex-paginated-items-data`) and API responses share this structure:
```
{
  groups: { nodes: [{ groupValue, groupId, groupMetadata, totalCount, fieldMetrics }] },
  groupedItems: { 0: { groupId, nodes: [items...], pageInfo }, 1: {...}, ... },
  slices: { 0: { sliceId, sliceValue, totalCount }, ... },
  totalCount: { value, isApproximate }
}
```

Each item contains:
- `id` (numeric, unique project item ID — **deduplication key**)
- `contentId`, `contentType` (Issue/PullRequest), `contentRepositoryId`
- `updatedAt`, `createdAt`, `state`
- `memexProjectColumnValues` — array of field values (Title, Status, Assignees, Cycle, etc.)
- `content` — nested issue/PR metadata

### 4. Page Structure and Entry Points

**Decision**: Add a new content script match for project board pages. Intercept the filter bar's submit event to detect OR syntax.

**Key DOM elements**:
- Filter input: `<input id="filter-bar-component-input" role="combobox" placeholder="Filter by keyword or by field">`
- Project root: `<projects-v2 id="memex-root">`
- Embedded data: `<script id="memex-paginated-items-data" type="application/json">`
- View metadata: `<script id="memex-views" type="application/json">` — contains filter, layout, groupBy, sortBy per view
- API endpoints: `<script id="memex-item-get-api-data">` → `{"url":"/memexes/{memexId}/items"}`

**Content script matching**: The extension currently only matches issue/PR pages. Project board pages are at `https://github.com/orgs/*/projects/*/views/*`. No new host_permissions needed (already has `https://github.com/*`).

**SPA behavior**: Filter changes and view switches are SPA transitions (Turbo + React). The fetch interceptor survives across these transitions — no full page reloads occur.

### 5. Implementation Approach

**Decision**: Intercept-fetch-merge strategy using the internal paginated items API.

When user submits an OR query:
1. **Intercept**: Content script listens for Enter key on `#filter-bar-component-input`. If OR syntax detected, prevent default behavior and intercept the React app's API call.
2. **Parse**: Split query into shared prefix + parenthesized branches per the OR syntax rules.
3. **Fetch**: For each branch, call `GET /memexes/{memexId}/paginated_items?q={prefix+branch}&...` with the current view's sort/group/slice/field params. Handle pagination (follow `after` cursors until all pages are fetched per branch).
4. **Merge**: Union items from all branches, deduplicate by item `id`. Reconstruct groups, groupedItems, slices, and totalCount from the merged set.
5. **Render**: Inject merged data into the React app. Two approaches to explore:
   - **Option A**: Replace `#memex-paginated-items-data` script content and force re-mount of `<projects-v2>` element
   - **Option B**: Intercept the React app's fetch call (monkey-patch `fetch` in main world) to return merged data transparently
   - **Option C**: Build a custom overlay table that replaces the native table with merged results

**Recommended**: Option B (fetch interception) is the most seamless — the React app renders naturally from what it thinks is a single API response. Research during implementation will determine if this is feasible or if Option A/C is needed as fallback.

### 6. Other Embedded Metadata Scripts

| Script ID | Purpose | Size |
|-----------|---------|------|
| `memex-data` | Project metadata (id, name, description) | ~700B |
| `memex-views` | View configs (filter, layout, groupBy, sortBy) | varies |
| `memex-columns-data` | Field/column definitions (types, options, names) | ~8KB |
| `memex-viewer-privileges` | User permissions (role, capabilities) | ~90B |
| `memex-paginated-items-data` | Board items (initial load only) | ~190KB |
| `memex-*-api-data` | Internal API endpoint URLs | ~30-60B each |

### 7. Chrome Dev Workflow

Existing tooling:
- **Build**: `npm run build` (esbuild)
- **Chrome launch**: `/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --remote-allow-origins='*' --user-data-dir="$HOME/.chrome-dev-profile"`
- **Reload**: `node scripts/cdp-reload.mjs` (reloads service worker + GitHub tabs via CDP)
- **SW logs**: `node scripts/sw-logs.mjs` (streams service worker console output)

## Open Risks

1. **Fetch interception feasibility**: Monkey-patching `fetch` in main world to intercept and modify the paginated_items response is the cleanest approach but requires a main-world script injection (similar to existing `pr-expand-main-world.ts`). The timing of the patch relative to the React app's module initialization is a risk.
2. **API response format**: The exact response format of `/memexes/{id}/paginated_items` needs to be captured during implementation (the research observed request parameters but not response bodies). It likely matches the `#memex-paginated-items-data` structure.
3. **Group reconstruction**: Merging items from different branches requires combining group metadata (new groups from one branch may not exist in another). The merged `groupedItems` must correctly assign items to their groups.
4. **Pagination across branches**: Each branch may require multiple paginated fetches. With 5 branches and 3 pages each, that's 15 API calls — acceptable but should show progress.
5. **Turbo snapshot cache**: Turbo may cache pages and restore stale data on back/forward. May need to handle cache invalidation for OR-filtered views.
6. **Internal API stability**: The `/memexes/{id}/paginated_items` endpoint is undocumented and internal to GitHub. It could change without notice. The extension should degrade gracefully if the API changes.

## React Hydration Cache Problem

**Status**: Open (workaround in place, no clean fix found)  
**Last investigated**: 2026-06-04

### The problem

When a saved view has an OR filter (e.g., `cycle:202606-1 (-status:"🎉 Done") OR (-last-updated:1days)`), the board loads with 0 results initially. This is because:

1. **Server-rendered data**: GitHub embeds board items in `<script id="memex-paginated-items-data">` (~190KB JSON blob). Since GitHub doesn't understand OR syntax, this blob has 0 matching items.
2. **React hydration**: React parses this embedded data at hydration and caches it in memory, keyed by the exact filter string K.
3. **No initial fetch**: React does NOT fetch from the network on initial page load — it uses the embedded data.
4. **Cache key stickiness**: Once React caches `{K → 0 results}`, any subsequent reference to filter K returns the cached 0-result data without fetching.

The fetch interceptor only works when React makes a real `fetch()` call — it cannot intercept the initial HTML-embedded data.

### Current workaround (trailing space nudge)

The extension adds a trailing space to the filter via `document.execCommand('insertText')`, which React sees as a new filter string `K + " "`. This is a cache miss, so React makes a real fetch, which the interceptor catches and returns merged OR data.

**Trade-offs of this approach:**
- Trailing space is visible in the filter bar (minor cosmetic issue)
- React treats the filter as "modified" from the saved view → "Discard" button appears, URL gains `?filterQuery=` param
- Clicking "Discard" resets filter to K → React uses cached 0-result data → board goes blank
- The user can recover by: (a) manually re-typing the filter, or (b) switching away from and back to the browser tab (triggers GitHub's internal refetch-on-focus)

### React's internal state management

GitHub's project board does NOT use React Query (TanStack Query). There is no `QueryClient` in the React fiber tree. GitHub uses a custom data-fetching and caching layer.

Key behaviors observed:
- **Cache keyed by exact filter string**: Any whitespace or character difference creates a new cache key.
- **Embedded data cached at hydration**: `#memex-paginated-items-data` is parsed once into in-memory state. Modifying the DOM element after hydration has no effect.
- **`groupedBy[columnId]` derived from embedded data**: React reads the group structure from the embedded JSON and includes `groupedBy[columnId]` in subsequent fetch URLs. Clearing the embedded data removes this param, causing the API to return a flat response instead of grouped — which breaks the board layout.
- **`#memex-views` is the source of truth for the "saved" view state**: Modifying it before hydration causes React to treat the view as "modified" (URL changes, discard button appears).
- **Refetch-on-focus**: GitHub's custom code refetches board data when the browser tab regains real focus (via `visibilitychange` / `focus` events). This is what allows recovery after cmd+tab.

### Approaches tried

| Approach | Result |
|----------|--------|
| **Trailing space nudge** (current) | ✅ Works but cosmetic issues (visible space, "Discard" button) |
| **Zero-width space (U+200B) nudge** | ✅ Invisible in filter bar, but same "Discard" button problem and adds ZWS-stripping complexity in the interceptor |
| **Clear `#memex-paginated-items-data` before React reads it** | ❌ React sends fetch WITHOUT `groupedBy[columnId]` — API response shape changes, board layout breaks |
| **Overwrite `#memex-paginated-items-data` after interceptor returns** | ❌ React already parsed it at hydration; overwriting the DOM element has no effect |
| **Poison cache key via `#memex-views`** (change saved filter before React reads it) | ❌ React treats view as "modified" — shows discard button, changes URL |
| **Double nudge** (add space → wait → replace with clean text) | ❌ Returning to the original string K hits the in-memory cached 0-result data |
| **Synthetic `visibilitychange` events** (override `Document.prototype.visibilityState`, dispatch on both `document` and `window`) | ❌ GitHub's focus handling requires real (trusted) browser events; synthetic events do not trigger refetch |
| **Synthetic `window.focus` events** | ❌ Same issue — not trusted events |
| **Find and patch React's cache directly** (traverse fiber tree) | ❌ GitHub doesn't use React Query; no `QueryClient` found. Internal cache not accessible. |
| **ZWS nudge + URL-polling Discard recovery** | ✅ Detects Discard via URL change, re-nudges automatically. Works but adds polling overhead and still has "Discard" button. |

### What might work (not yet tried)

- **Monkey-patch `JSON.parse`** to intercept when React parses `#memex-paginated-items-data`. Modify the parsed result before React caches it (e.g., keep groups but set items to empty + `hasNextPage: true` to trigger eager pagination). Risk: React may not auto-paginate from hydrated data the same way it does after a fetch.
- **Intercept `textContent` getter** on the script element via `Object.defineProperty` to return modified JSON. Same idea as `JSON.parse` interception but at the DOM read level. Risk: timing — need to intercept before React reads, which happens very early.
- **Synchronous XHR in `textContent` getter** to fetch merged data before React reads embedded data. Would block the main thread for 2–3 seconds but would give React the correct data on first read with no cache key issues. Risk: terrible UX (page freezes during load).
- **Intercept `document.getElementById`** to return a modified element when React looks up `memex-paginated-items-data`. Similar timing constraints as textContent interception.

### Architecture notes for future agents

```
Page load timeline for a saved view with OR filter:

  document_start
    ├─ content script injects main-world <script> into <head>
    ├─ main-world script runs:
    │   ├─ monkey-patches window.fetch (interceptor installed)
    │   └─ sets up MutationObserver to wait for filter input
    │
  HTML parsing continues...
    ├─ <script id="memex-views"> parsed (view configs including filter)
    ├─ <script id="memex-paginated-items-data"> parsed (0 items for OR)
    ├─ React scripts load and execute
    │   ├─ React reads #memex-paginated-items-data → parses JSON
    │   ├─ Caches {K → 0 results} in internal state
    │   └─ Renders board with 0 items
    │
  React hydration complete
    ├─ Filter input appears in DOM
    ├─ MutationObserver fires → maybeNudge()
    │   └─ After 500ms delay:
    │       ├─ Adds trailing space to filter via execCommand
    │       ├─ React sees K+" " → cache miss → calls fetch()
    │       ├─ Interceptor catches fetch → branch fetches → merge
    │       └─ Returns merged response → React renders 124 items
    │
  User interaction
    ├─ Removing the trailing space → React uses cached {K → 0} → blank
    ├─ Re-adding a space → React fetches K+" " again (or uses cache if same key)
    └─ Tab switch (cmd+tab away then back) → GitHub's focus handler
        → refetches active query → interceptor returns merged data
```

The interceptor (`board-data-injector.ts`) lives in the page's main world (not the content script sandbox) so it can monkey-patch `window.fetch`. It uses `originalFetch` (saved reference) for its own branch fetches, so they bypass the monkey-patch and go directly to GitHub's API.

Turbo SPA navigations preserve the JavaScript context (including the monkey-patched `fetch`), but replace the DOM. The `__filozFetchInterceptorInstalled` guard prevents double-installation. The nudge logic needs to re-run on Turbo navigations since the filter input element is replaced.
