# Implementation Plan: Enable Project Board Filtering with OR Conditions

**Branch**: `007-project-board-or-filter` | **Date**: 2026-05-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-project-board-or-filter/spec.md`

## Summary

Enable OR-condition filtering on GitHub project board views by intercepting filter submissions, parsing OR syntax, executing multiple calls to GitHub's internal paginated items API (one per branch), merging and deduplicating results, and rendering the combined data in the board's existing UI. The extension currently only targets issue/PR pages; this feature adds content scripts for project board pages.

## Technical Context

**Language/Version**: TypeScript (esbuild-compiled, Manifest V3 Chrome extension)
**Primary Dependencies**: Chrome Extensions API, GitHub internal memex API (`/memexes/{id}/paginated_items`)
**Storage**: `chrome.storage.local` (existing config — no new storage for this feature)
**Testing**: Manual verification (per constitution Principle IV); automated tests optional
**Target Platform**: Chromium browsers (Manifest V3)
**Project Type**: Browser extension (content scripts + service worker)
**Performance Goals**: OR query results within a few seconds for typical 2-3 branch queries
**Constraints**: Must not break existing extension features; must handle GitHub's internal API changes gracefully
**Scale/Scope**: Internal FilOzone team usage; 2-5 OR branches per query typical

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Gates derived from `.specify/memory/constitution.md` (TPM Utils GitHub Extension):

- **Least privilege**: New content script match `https://github.com/orgs/*/projects/*/views/*` is within existing `host_permissions` (`https://github.com/*`). No new permissions, OAuth scopes, or host permissions required. API calls use session cookies (same-origin) — no token access needed beyond existing auth. **PASS**
- **User credentials**: No new credential handling. Same-origin fetch to GitHub's internal API uses the user's existing session. No tokens stored or transmitted. **PASS**
- **API discipline**: Uses GitHub's internal `/memexes/{id}/paginated_items` API (same-origin, session-authenticated). Rate limiting handled by concurrent request throttling (max 5 branches). Partial failure shows successful branches + error notification. **PASS**
- **Verification (internal velocity)**: Manual verification steps documented below. No manifest/auth/host-permission changes beyond content_scripts match addition. Smoke checklist included for the new content script match. **PASS**
- **Incremental scope**: MVP is a single feature slice: OR query parsing + multi-fetch + merge + render. No speculative features. **PASS**
- **UI fidelity**: No custom UI injected — merged data is rendered by GitHub's own React app. No light/dark mode concerns. **PASS**

## Project Structure

### Documentation (this feature)

```text
specs/007-project-board-or-filter/
├── plan.md              # This file
├── research.md          # Phase 0 output — API and DOM research
├── data-model.md        # Phase 1 output — data structures
├── quickstart.md        # Phase 1 output — dev setup
├── contracts/           # Phase 1 output — internal interfaces
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
extension/
├── manifest.json                          # Add content_scripts match for project board pages
├── src/
│   ├── content/
│   │   ├── board-filter/                  # NEW — project board OR filter feature
│   │   │   ├── board-filter-main.ts       # Entry point: DOM observation, filter interception
│   │   │   ├── or-query-parser.ts         # Parse OR syntax into prefix + branches
│   │   │   ├── memex-api.ts              # Fetch paginated_items API, handle pagination
│   │   │   ├── result-merger.ts           # Merge + deduplicate items from multiple branches
│   │   │   ├── board-data-injector.ts     # Inject merged data into React app
│   │   └── ... (existing content scripts)
│   ├── lib/
│   │   └── messages.ts                    # Add message types if service worker relay needed
│   └── background/
│       └── service-worker.ts              # May need relay for API calls (if CORS issues)
```

**Structure Decision**: New code lives in `extension/src/content/board-filter/` as a self-contained module. The OR query parser is isolated for testability. The feature shares the existing service worker and message infrastructure but operates independently from the issue/PR sidebar features.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Internal API dependency (`/memexes/{id}/paginated_items`) | GitHub's public API doesn't support board filter syntax (cycle, last-updated, keyword) | Public GraphQL API lacks filter support; HTML parsing is more fragile than JSON API |
| Main-world script injection (for fetch interception) | Need to intercept/modify the React app's API calls transparently | Content-script-only approach can't interact with page's JS context for seamless rendering |

## Phase 0: Research (Complete)

See [research.md](research.md) for full findings. Key decisions:

1. **Data source**: GitHub's internal `GET /memexes/{memexId}/paginated_items?q={filter}` API
2. **Interception point**: Filter bar input (`#filter-bar-component-input`) Enter key event
3. **Rendering strategy**: Intercept the React app's fetch calls via main-world script to return merged data transparently (Option B from research)
4. **Pagination**: Cursor-based (`after` param); must follow all pages per branch before merging

## Phase 1: Design

### Architecture

```
User types OR query → Enter key
        │
        ▼
[Content Script: board-filter-main.ts]
   Observes filter bar, detects OR syntax
        │
        ▼
[or-query-parser.ts]
   Parses: "prefix (branch1) OR (branch2)" → { prefix, branches: ["branch1", "branch2"] }
        │
        ▼
[Main-world script: board-data-injector.ts]
   Intercepts fetch("/memexes/{id}/paginated_items")
   For each branch:
     └── [memex-api.ts] fetches paginated_items?q=prefix+branch
          └── Follows pagination cursors
        │
        ▼
[result-merger.ts]
   Merges items from all branches
   Deduplicates by item.id
   Reconstructs groups, slices, totalCount
        │
        ▼
   Returns merged response to React app
   (React renders naturally — no DOM manipulation needed)
```

### Implementation Phases

**Phase 1a — OR Query Parser (P1, standalone)**
- Parse the filter string for OR syntax
- Validate syntax rules (no nesting, no trailing terms, etc.)
- Return structured result: `{ prefix: string, branches: string[] }` or `null` (no OR detected)
- Pure function, easily testable

**Phase 1b — Memex API Client (P1, standalone)**
- Fetch `GET /memexes/{id}/paginated_items` with given query params
- Handle cursor-based pagination (follow `after` until no more pages)
- Extract memexId from `#memex-item-get-api-data` script tag
- Extract view params (sort, group, slice, fields) from `#memex-views` script tag
- Return complete item set for a single filter query

**Phase 1c — Result Merger (P1, standalone)**
- Take multiple API responses (one per branch)
- Deduplicate items by `id`
- Merge group metadata (union of groups from all branches)
- Reconstruct `groupedItems` with items assigned to correct groups
- Recalculate `totalCount` and `slices`

**Phase 1d — Board Data Injector / Fetch Interceptor (P1, integration)**
- Main-world script that patches `window.fetch`
- Detects calls to `/memexes/{id}/paginated_items`
- When an OR query is active: intercepts the call, runs multi-branch fetch + merge, returns merged response
- When no OR query: passes through to original fetch unchanged
- Communication with content script via `CustomEvent` or `window.postMessage`

**Phase 1e — Content Script Entry Point (P1, integration)**
- New content script registered in manifest for `https://github.com/orgs/*/projects/*/views/*`
- Observes `#filter-bar-component-input` for Enter key submission
- Parses filter text for OR syntax
- If OR detected: signals main-world script to activate fetch interception for the upcoming API call
- If no OR: does nothing (full pass-through)

### Key Design Decisions

1. **Fetch interception over DOM manipulation**: By intercepting the React app's API calls and returning merged data, we let GitHub's own rendering code handle display. This is more robust than trying to manipulate the DOM or React state directly.

2. **Content script + main-world script**: The content script handles DOM observation and OR detection. A main-world script (injected like the existing `pr-expand-main-world.ts`) handles fetch interception, since content scripts can't access the page's JS context.

3. **Same-origin fetch**: API calls to `/memexes/{id}/paginated_items` are same-origin (github.com → github.com), so session cookies are sent automatically. No need to relay through the service worker.

4. **Graceful degradation**: If the internal API changes format or the fetch interception fails, the extension falls back to native filtering (the unmodified API call goes through).

### Manual Verification Plan

**Smoke checklist** (required for new content script match):
1. Load extension, navigate to `https://github.com/orgs/FilOzone/projects/14/views/20`
2. Verify content script loads (check console for log marker)
3. Verify existing issue/PR sidebar features still work on issue pages
4. Verify no errors on project board pages without OR queries

**Feature verification**:
1. Enter `cycle:202605-2 biglep (-status:"🎉 Done") OR (-last-updated:1days)` in filter bar
2. Verify merged results appear (items from both branches)
3. Verify no duplicates in results
4. Test with invalid OR syntax: `((nested))`, `(a) OR (b) trailing` — verify native filtering still works
5. Test without OR syntax: verify normal filtering unchanged
6. Test on views with different layouts (table, board) if applicable

**Test URLs** (for `docs/canonical-test-urls.md`):
- `https://github.com/orgs/FilOzone/projects/14/views/20` — "Current by Status" view (filtered, grouped)
- `https://github.com/orgs/FilOzone/projects/14/views/2` — "All" view (large item set, pagination)
- `https://github.com/orgs/FilOzone/projects/14/views/33` — "Recently Updated" view

## Phase 2: Task Breakdown

*To be generated by `/speckit.tasks`*
