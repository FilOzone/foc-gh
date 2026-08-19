# Implementation Plan: Native Picker Data Injection

**Branch**: `008-native-picker-data-injection` | **Date**: 2026-08-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-native-picker-data-injection/spec.md` plus PoC-validated [research.md](research.md)

## Summary

Replace the custom global-boards picker UI on issue and PR pages with data-layer interception so GitHub renders everything. A new `document_start` main-world injector (pattern cloned from `extension/src/content/board-filter/`) augments GitHub's picker data feeds with configured global boards, seeds the picker's IndexedDB persister for first-open correctness, and commits membership edges into the issue page's Relay store so native sidebar display, checked state, and native add/remove work. On legacy PR pages the injector augments the `projects_suggestions` feed and intercepts the sidebar form POST for injected board ids, delegating the actual mutation to the existing service-worker GraphQL path (GitHub's PR endpoint silently ignores cross-org ids). The custom picker section (issue dialog), custom fourth tab (PR picker), and their CSS are then removed.

## Technical Context

**Language/Version**: TypeScript 5.x, ES2022 target, Chrome extension Manifest V3

**Primary Dependencies**: esbuild (bundling), no runtime libraries; GitHub page internals (fetch feeds, Relay store, React Query IndexedDB persister) as documented in research.md

**Storage**: Existing `chrome.storage` config (global boards, proactive repos); read/write of GitHub's own IndexedDB persister entry `offline_cache_v2::<login>::queries` for first-open seeding (page-owned data, augmented in place)

**Testing**: Manual verification per constitution Principle IV against docs/canonical-test-urls.md scenarios; `npm run lint` and `npm run typecheck` gate; live validation checkpoints listed in quickstart.md

**Target Platform**: Chromium (dev unpacked + org install), github.com issue and PR pages

**Project Type**: Browser extension content scripts + shared service worker (existing)

**Performance Goals**: No perceptible added latency; fetch patch is passthrough for non-matching URLs; augmentation is O(boards) per intercepted response

**Constraints**: Fail open on every interception path (native behavior untouched on any error); no new host permissions; no hashed GitHub class names; injector must install before GitHub's first fetch reference capture (document_start, main world)

**Scale/Scope**: 1-3 configured global boards, one item per page; net code delta is negative (about 740 lines of custom picker UI retired, smaller injector added)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Least privilege | PASS | No new hosts, scopes, or permissions. Adds one `web_accessible_resources` script and one content-script entry on already-matched URL patterns; called out for review. |
| II. User-owned credentials | PASS | Issue-page adds/removes ride the user's own GitHub session via GitHub's own UI actions. Extension-performed PR mutations reuse the existing consented PAT/OAuth path unchanged. |
| III. GitHub API discipline | PASS with recorded deviation | Extension-initiated calls remain supported GraphQL/REST. Page-data augmentation reads/rewrites GitHub's internal feeds, same accepted deviation class as spec 007 (see Complexity Tracking). All paths fail open with console warnings. |
| IV. Lightweight verification | PASS | quickstart.md defines manual scenarios mapped to canonical test URLs; manifest change includes smoke checklist in PR. |
| V. Simplicity | PASS | Removes a parallel UI system; single new injector module mirroring an existing pattern. |
| VI. Native UI fidelity | PASS | The feature's purpose: GitHub renders all picker rows and sidebar entries. No injected visuals remain in the picker. github-page-layout.md updated with new data-layer findings. |

Post-design re-check (after Phase 1): unchanged, all PASS.

## Project Structure

### Documentation (this feature)

```text
specs/008-native-picker-data-injection/
├── plan.md              # This file
├── research.md          # Phase 0 (PoC-validated 2026-08-19)
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1 (manual validation guide)
├── contracts/
│   ├── github-feeds.md  # Intercepted GitHub endpoints and payload shapes
│   └── messages.md      # Content script <-> main world <-> service worker contracts
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
extension/
├── manifest.json                          # + content script entry (document_start), + web_accessible_resource
├── src/
│   ├── content/
│   │   ├── native-picker/                 # NEW module (mirrors board-filter/)
│   │   │   ├── native-picker-main.ts      # isolated world: inject injector, resolve config+membership, bridge messages
│   │   │   ├── native-picker-injector.ts  # main world: fetch patch, feed augmentation, PR form interception
│   │   │   ├── feed-shapes.ts             # typed shapes for item-pickers, projects_suggestions, membership edges
│   │   │   ├── relay-membership.ts        # main world: Relay env discovery + projectItems connection commit
│   │   │   └── idb-seeder.ts              # main world: seed offline_cache_v2 item_picker entry
│   │   ├── global-boards-picker.ts        # RETIRED (deleted) after validation
│   │   └── issue-sidebar.ts               # drop initGlobalBoardsPicker wiring; FOC card untouched
│   ├── lib/
│   │   └── project-config.ts              # expose numeric databaseId per global board (needed by PR feed rows)
│   └── styles/sidebar.css                 # remove .filoz-global-board* rules
└── scripts/build.mjs or package.json      # + esbuild entry for native-picker-injector bundle
```

**Structure Decision**: One new content module `extension/src/content/native-picker/` cloned from the `board-filter/` two-world pattern; deletions in `global-boards-picker.ts` and `sidebar.css`; service worker membership/mutation handlers reused as-is.

## Design decisions (Phase 0 summary; full detail in research.md)

1. **Interception style**: `document_start` isolated-world script injects a main-world bundle via `web_accessible_resources` script src (CSP-safe, proven by board-filter). Injector patches `window.fetch` once, guarded against Turbo context reuse, keeping `originalFetch` for its own calls. Augmentation overrides `res.json`/`res.text` on the real Response (preserves `response.url`, headers; PoC-validated) instead of synthesizing a Response.
2. **Issue picker feed**: augment `data.repository.owner.recentProjects.edges` (renders in the picker's Recent group) with one node per configured global board, deduped by node id and skipped when board org equals repo owner. `viewerCanUpdate` reflects the user's real board access from existing membership resolution.
3. **First-open correctness**: seed GitHub's IndexedDB persister entry (`state.data.recentOwnerProjects`) at page load; fetch interception remains source of truth. Missing entry is a no-op (fresh fetch is augmented anyway).
4. **Membership display + checked state (issues)**: dual mechanism, both fail-open: (a) augment `IssueViewerViewQuery` `_graphql` GET responses with the membership edge when membership is already resolved; (b) commit the edge into the Relay store connection `client:<issueId>:__ProjectSection_projectItems_connection(allowSameEnterprise:true)` when the async membership answer arrives (covers hard navs and late resolution; GitHub's own mutation updater proves the connection renders). Edge shape captured in contracts/github-feeds.md.
5. **Native mutations (issues)**: GitHub's session-authenticated add is verified working cross-org; the injector observes intercepted `updateIssueProjectsRelayMutation` responses mentioning configured board ids to keep extension membership cache in sync (item id for later removal). Native delete is expected to work once the edge is in the connection; validation checkpoint with a contingency to intercept-and-delegate the delete like the PR path if it fails.
6. **PR pages (legacy)**: augment the `scope=recent` `projects_suggestions` feed with rows carrying the board's numeric `databaseId` and extension-computed `selected`. Intercept the sidebar form POST (`_method=put`, `issue_memex_project_ids[...]`): strip injected ids before passthrough (or skip the native call when only injected ids changed) and delegate add/remove to the existing service-worker GraphQL path. PR sidebar partial is NOT augmented; the existing FOC card already displays membership on PR pages, and GitHub's React PR rollout will obsolete this branch.
7. **Retirement**: `global-boards-picker.ts`, its CSS, and its wiring are deleted only after quickstart scenarios pass; service-worker state resolution (`GET_GLOBAL_BOARDS_STATE`, add/delete handlers) is kept as the membership source and PR mutation path.
8. **Docs**: docs/github-page-layout.md gains a data-layer section (feeds, persister, connection key) and drops retired DOM-anchoring notes; docs/global-boards-picker-status.md updated.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Reliance on undocumented GitHub internals (item-pickers feed, `_graphql` persisted queries, Relay store record ids, IndexedDB persister, PR suggestions/form endpoints) | Cross-org boards are server-side filtered out of every supported surface; only page-data augmentation can make GitHub's own UI render them | Custom-rendered UI (status quo, spec 006) is the rejected alternative: two divergent UI sets, documented drift/rough edges, ~740 lines to maintain. Public API cannot alter GitHub's page rendering. Same deviation class was accepted for spec 007; every interception fails open to native behavior. |
| Writing to a GitHub-owned IndexedDB entry | Picker renders first paint from the persister, so pure fetch interception leaves the row missing on the first open per page context | Accepting one-open lag was rejected: users judge the picker by first open; the write is a targeted augmentation of one cache entry, and corrupt/missing entries degrade to the fetch path. |
