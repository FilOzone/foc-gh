# Research: Native Picker Data Injection (2026-08-19)

Investigation of replacing the custom global-boards picker UI (spec 006) with data-layer interception, mirroring the OR filter pattern (spec 007). All findings below were verified live against github.com in the dev Chrome profile on 2026-08-19 via CDP-driven proof-of-concept scripts (fetch patching equivalent to a `document_start` main-world injection). Board mutations performed during testing were reverted; canonical test URL states are unchanged.

## Verdict

Feasible and validated end to end on issue pages, including the decisive unknown: GitHub's own session-authenticated add mutation accepts a cross-org project id. PR pages (legacy UI) support native rendering via injection but require the extension to perform the mutation itself. Recommended: proceed.

## How GitHub's issue-page picker works (React UI)

### Data feed

Opening the sidebar "Edit Projects" picker fires:

```
GET https://github.com/_ghui/item-pickers/projects?owner=<org>&repo=<repo>&queryId=<sha>
```

Response is GraphQL-shaped JSON. Note that `owner` is nested INSIDE `repository`:

```
data.repository.projectsV2.nodes            -> "Repository" group
data.repository.recentProjects.edges        -> parsed but NOT rendered (recentRepositoryProjects)
data.repository.owner.projectsV2.edges      -> "Organization" group
data.repository.owner.recentProjects.edges  -> "Recent" group
```

Each project node shape (all fields required by a client-side shape validator; extra fields are fine):

```json
{ "id": "PVT_...", "title": "FOC", "closed": false, "number": 14,
  "url": "https://github.com/orgs/FilOzone/projects/14",
  "viewerCanUpdate": true, "hasReachedItemsLimit": false, "__typename": "ProjectV2" }
```

The consumer is in webpack chunk `19248-*.js` (module 731231, `ProjectPicker` / `ItemPickerFetcher` / `SelectPanelWrapper`). Pipeline: `fetch -> res.json() -> envelope check -> transform to {repositoryProjects, recentRepositoryProjects, ownerProjects, recentOwnerProjects} -> React Query cache under key ["item_picker","projects",{owner,repo,query,count}]`. Rows are filtered client-side only by `closed === false` and search text; there is NO org/owner filter client-side. Server-side, cross-org projects are simply never included in the feed.

### IndexedDB persistence (the stale-first gotcha)

GitHub persists React Query results per user in IndexedDB `offline_cache_v2::<login>::queries` (store `queries`, keys like `key-["item_picker","projects",{...}]`). On picker open, the persister serves the stored copy for first paint and refetches in the background; the (intercepted, augmented) network response is then persisted. Consequences:

- With a pre-existing cache, the injected row appears on the SECOND open, not the first.
- Steady state converges after one open because our augmented response is what gets persisted.
- Options: accept one-open lag, or seed/patch the IndexedDB entry directly at page load (fields above are the full stored shape; `state.data` holds the transformed lists).

### Search typing

Typing in the picker debounces then refetches the same endpoint with a `query` param via React Query `fetchQuery`; same interception point covers it. With an empty query the filter is applied client-side over the already-fetched list.

### Native add mutation (validated cross-org)

Checking a row and closing the panel fires GitHub's internal persisted mutation over cookies (no PAT involved):

```
POST https://github.com/_graphql
{"persistedQueryName":"updateIssueProjectsRelayMutation","query":"b695a1b44dfc6808873f990340430ce1",
 "variables":{"connections":["client:<issueNodeId>:__ProjectSection_projectItems_connection(allowSameEnterprise:true)"],
              "input":{"contentId":"<issueNodeId>","projectId":"PVT_kwDOBwtpYM4A5lZw"}}}
```

Verified on filecoin-pin#56: the server ACCEPTED the cross-org add (`addProjectV2ItemById` returned the new item, id `PVTI_...`), and the native sidebar immediately rendered "FOC / Status: No status" via the Relay connection update. The add is idempotent: re-adding an existing membership returns `projectEdge: null` and changes nothing.

The mutation response embeds the full projectItems edge shape (item id, `isArchived`, `fieldValueByName`, full project object with Status field definition and options). This is the exact shape needed for membership injection below.

### Membership display and checked state (the remaining work)

GitHub server-side filters cross-org memberships out of ALL issue-page data:

- SSR JSON island (hard nav) contains `projectItems: {edges: []}` for a cross-org member (verified on filecoin-pin#42, which IS on FOC).
- `IssueViewerViewQuery` / `IssueViewerSecondaryViewQuery` `_graphql` responses (soft nav and lazy loads) are filtered the same way. Requests are GETs with the persisted query in the `body` URL param.
- The connection key `__ProjectSection_projectItems_connection(allowSameEnterprise:true)` suggests the server includes same-enterprise cross-org memberships only; FilOzone and filecoin-project evidently do not qualify.

Because the picker's `selectedProjects` derives from this filtered data, an injected row always renders unchecked, even for members. Verified failure mode: "unchecking" a member actually fires another idempotent add, and removal is impossible natively. Therefore the implementation MUST inject the membership edge (fetched via the extension's existing membership resolution) into the issue's project items data. Two candidate mechanisms:

1. Intercept `_graphql` GET responses for `IssueViewerViewQuery` (and the SSR island via pre-hydration rewrite of the `<script type="application/json">` payload on hard navs) and append the projectItems edge.
2. Post-hydration Relay store commit: walk to the Relay environment (same fiber-walk family as the OR filter's QueryClient discovery) and insert the edge into the connection. This also live-updates the sidebar.

Option 1 for soft navs plus either mechanism for hard navs is the likely shape; needs a timing experiment for the SSR island (membership answer is async from the service worker, hydration may win the race, in which case option 2 is the fallback).

Native remove for a checked row is expected to work once the edge (with real item id) is in the connection, but the delete mutation variant was not exercised; validate during implementation.

## How GitHub's PR-page picker works (legacy Rails UI)

### Data feed (validated injectable)

Opening the sidebar Projects gear fetches an HTML partial (`show_partial?partial=issues/sidebar/projects_menu_content`) containing a `<project-picker>` Catalyst element whose three tabs each load JSON:

```
GET /<owner>/<repo>/projects/issues/projects_suggestions?access_level=write&issue_number=<n>&scope=recent|repository|organization
{"projects":[{"id":24536552,"name":"Solstice","owner":"Filecoin","type":"memex_project",
  "template":false,"selected":true,"search_slug":"filecoin-project/143"}, ...]}
```

Rows use the project's NUMERIC database id (FOC = 15095408, from GraphQL `databaseId`) and include server-computed `selected`. Injecting a FOC entry via fetch interception rendered a native row immediately (verified on filecoin-pin PR#1). `selected` for injected rows must be computed by the extension from its own membership check.

### Native toggle does NOT work cross-org

Toggling a row and closing the menu POSTs a multipart form:

```
POST /<owner>/<repo>/projects/issues/<n>
_method=put, authenticity_token=<csrf>, query=, issue_memex_project_ids[15095408]=on
```

Verified: the server returns 200 with a refreshed sidebar partial but SILENTLY IGNORES the cross-org project id (board unchanged, confirmed via API). So on PR pages the extension must intercept this POST (or the row click), strip/handle the injected id itself, and perform add/remove through its existing service-worker GraphQL path, then refresh its injected sidebar state. The rest of the rendering stays native.

Note: GitHub is rolling out the issue-style React viewer to PR pages. When that lands, the issue-side path covers PRs and this legacy branch can be deleted.

### PR sidebar membership display

The PR sidebar Projects section is a server-rendered partial and also excludes cross-org memberships ("None yet" on a member PR when viewed natively). Cross-org membership display on legacy PR pages needs DOM-level augmentation of that partial (small, still simpler than today's custom tab) or acceptance of picker-only visibility until GitHub's React PR rollout. Decide in plan.

## Access-control constraints discovered

- GitHub renders NO picker at all when the viewer lacks repo write/triage access (e.g. ipld/frisbii for this user): nothing to inject into. Today's custom UI has the same constraint on issue pages (it injects into GitHub's dialog), so no regression, but the spec must state it.
- `viewerCanUpdate` in injected nodes should reflect the user's real board permission (the extension already resolves board access) so GitHub renders non-actionable rows correctly.

## What this replaces (from the current-code survey)

- Custom picker UI proper: `global-boards-picker.ts` (356 lines), about 85 lines of CSS, plus roughly 300 lines of service-worker state resolution it drives; total picker surface about 740 lines.
- Rough-edge class eliminated: fragile DOM anchoring documented in docs/github-page-layout.md (FilteredActionList sibling hack, PR tab-container pairing workarounds, filter-input mis-selection, attribute-observer requirements).
- Kept: FOC field card and its service-worker paths, membership resolution (REST fallback and GraphQL), OAuth/PAT plumbing; the picker feed injection consumes the same membership answers.
- The OR filter's injector (`board-filter/board-data-injector.ts`) is the pattern template: `document_start` main-world script via `web_accessible_resources`, original-fetch preservation, fail-open on any error. Prefer overriding `res.json`/`res.text` on the real Response (keeps `response.url` and headers intact) over constructing a synthetic Response; the PoC used this successfully.

## Learnings applied from spec 007 (OR filter): initial load vs followup updates

The OR filter project established a two-phase pattern that this feature adopts (decision confirmed with the user 2026-08-19):

- **Followup requests are the easy case.** A `document_start` main-world fetch patch (via `web_accessible_resources` script src injection, guarded by an install flag because Turbo preserves the JS context across SPA navs) catches every post-load request. Here that covers the picker feed, picker search, `IssueViewerViewQuery` on soft navs, and PR `projects_suggestions`.
- **Initial page load never goes through fetch.** GitHub server-renders JSON islands and hydrates client caches from them; for an augmented view of that data, do NOT fight the SSR payload (spec 007's failed-approaches table: clearing or overwriting islands breaks layout or is a no-op). Instead, mutate the client cache after hydration through the framework's own API, which triggers GitHub's own re-render.
  - Spec 007 did this with React Query: fiber-walk from the app root to a context provider exposing the QueryClient, then `invalidateQueries` so active queries refetch through the patched fetch.
  - Here the issue page membership data lives in a **Relay** store, and invalidation is not enough because the server filters cross-org memberships out of any refetch. So the analog is a **Relay store commit**: locate the Relay environment (same fiber-walk family, or via the mutation-observed root), then insert the membership edge into `client:<issueNodeId>:__ProjectSection_projectItems_connection(allowSameEnterprise:true)` once the extension's membership answer arrives. The PoC observed GitHub's own mutation updater do exactly this insert live, updating both sidebar and picker state, so the store path is proven renderable.
  - This also resolves the async race: the membership answer arrives whenever it arrives, and the commit works at any time after hydration; no pre-hydration rewrite needed.
- **Fail open everywhere** (spec 007 discipline): any error in patching, augmenting, fiber-walking, or committing must leave native behavior untouched, with a console warning.
- **Response identity matters**: override `res.json`/`res.text` on the real Response rather than constructing a synthetic Response (GitHub code paths can depend on `response.url`/headers; the PoC validated the override approach).
- **Picker first-open staleness**: the picker's React Query cache is backed by an IndexedDB persister (`offline_cache_v2::<login>::queries`). Decision: seed/patch the persisted `key-["item_picker","projects",{...}]` entry at page load (its `state.data` holds the transformed lists whose exact shape is documented above), so the injected row appears on the very first open. Fetch interception remains the source of truth; the IDB seed only fixes first paint.

## Open questions for the plan

1. Resolved (see learnings above): hard-nav membership display uses a post-hydration Relay store commit, not SSR island rewriting.
2. Native delete mutation variant on issue pages: confirm it fires and succeeds cross-org once the membership edge is injected with a real item id.
3. Resolved (see learnings above): seed the IndexedDB persister entry at page load for first-open correctness.
4. PR pages: how far to go (picker-only vs also augmenting the sidebar partial) given GitHub's pending React PR rollout.
5. De-duplication guard for same-org repos where the board is already in the feed (scenarios 1 and 2).
6. Whether `manifest.json` content-script matches need widening from `issues/*`/`pull/*` for the `document_start` injector (current picker scripts already run there; the injector must run at `document_start` like the OR filter's).

## PoC artifacts

Probe and PoC scripts live in the session scratchpad (`probe-projects-picker.mjs`, `probe2.mjs` through `probe4.mjs`, `poc2.mjs` through `poc8.mjs`, `poc-mutate.mjs`, `poc-revert.mjs`, `poc-pr.mjs`, `poc-pr2.mjs`); they are throwaway CDP drivers, not extension code. Test mutations performed and reverted: filecoin-pin#56 added to and removed from FOC; filecoin-pin PR#1 toggle attempted (server ignored it, no state change).
