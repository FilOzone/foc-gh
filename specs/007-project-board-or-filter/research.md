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
