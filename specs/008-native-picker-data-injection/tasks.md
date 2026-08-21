# Tasks: Native Picker Data Injection

**Input**: Design documents from `/specs/008-native-picker-data-injection/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not requested; per constitution Principle IV each story ends with a live manual validation checkpoint mapped to quickstart.md. Checkpoints require the dev Chrome workflow from AGENT.md.

**Organization**: Tasks grouped by user story; US1 alone is a viable MVP (native add on issue pages).

## Phase 1: Setup

- [X] T001 Create `extension/src/content/native-picker/` module skeleton with `feed-shapes.ts` containing the types from data-model.md and contracts/github-feeds.md (InjectedBoard, MembershipState, item-pickers feed payload, projects_suggestions payload, ProjectItemsEdge)
- [X] T002 [P] Add esbuild entries in `scripts/build.mjs` for `native-picker/native-picker-main.ts` -> `dist/native-picker.js` and `native-picker/native-picker-injector.ts` -> `dist/native-picker-injector.js` (mirror the board-filter pair at scripts/build.mjs:167-181)
- [X] T003 [P] Update `extension/manifest.json`: add `document_start` content script entry for `native-picker.js` on the existing issue/PR matches, and add `native-picker-injector.js` to `web_accessible_resources`

## Phase 2: Foundational (blocking prerequisites)

- [X] T004 Implement `extension/src/content/native-picker/native-picker-injector.ts` core: install-once fetch patch (Turbo guard flag, preserved `originalFetch`), dormant-until-config state keyed by page context, `res.json`/`res.text` override helper, fail-open wrapper that logs `[FilOz:native-picker]` warnings and always returns the original response on error (pattern: `board-filter/board-data-injector.ts`)
- [X] T005 Implement `extension/src/content/native-picker/native-picker-main.ts`: synchronous main-world injection at document_start (pattern: `board-filter/board-filter-main.ts:22-31`); async config load deriving InjectedBoard list; dispatch `filoz-np-config`; resolve membership via `GET_GLOBAL_BOARDS_STATE` and dispatch `filoz-np-membership`; re-dispatch both on `turbo:load`/`popstate`; listen for `filoz-np-native-mutation` and `filoz-np-pr-toggle` per contracts/messages.md
- [X] T006 Extend config/service worker: resolve and cache each global board's `databaseId` (GraphQL `databaseId`) alongside existing node id/title/number/org in `extension/src/lib/project-config.ts` + `extension/src/lib/queries.ts`, and add idempotent `NOTE_MEMBERSHIP_CHANGE` handler to `extension/src/background/service-worker.ts` so observed native mutations update the membership cache

**Checkpoint**: `npm run build && npm run typecheck` clean; injector loads dormant on an issue page with zero behavior change (console shows injected + dormant)

## Phase 3: User Story 1 - Native add from the picker on issue pages (P1) - MVP

**Goal**: Configured global boards render as native picker rows on cross-org issue pages; checking a row adds via GitHub's own mutation.

**Independent Test**: quickstart.md V1 + V2 on filecoin-project/filecoin-pin#56 (restore state after).

- [X] T007 [US1] In `native-picker-injector.ts`, augment `_ghui/item-pickers/projects` responses per contracts/github-feeds.md section 1: unshift injected nodes into `data.repository.owner.recentProjects.edges`, dedupe by node id across the whole feed, skip boards whose org equals the repo owner, honor `query=` search matching, set `viewerCanUpdate` from config/membership state
- [X] T008 [US1] In `native-picker-injector.ts`, observe `updateIssueProjectsRelayMutation` POST responses touching injected board ids (contracts section 3): capture added `itemId` (or removal), update in-injector membership state, dispatch `filoz-np-native-mutation`; in `native-picker-main.ts`, forward to `NOTE_MEMBERSHIP_CHANGE`
- [X] T009 [P] [US1] Implement `extension/src/content/native-picker/idb-seeder.ts` (main world, invoked from injector on config arrival): seed `offline_cache_v2::<login>::queries` entry `key-["item_picker","projects",{owner,query:"",repo}]` per contracts section 5; no-op when DB/entry absent; never throw
- [X] T010 [US1] CHECKPOINT: build, reload extension via chrome.management, run quickstart V1 (row renders natively on first open, light+dark) and V2 (native add succeeds, board updated); revert board state; record results in quickstart or PR notes

## Phase 4: User Story 2 - Native membership display, checked state, and remove (P1)

**Goal**: Existing cross-org membership shows in the native sidebar and as a checked picker row; unchecking removes.

**Independent Test**: quickstart.md V3 + V4 (frisbii#170 read-only; filecoin-pin#56 add/reload/remove cycle).

- [X] T011 [US2] In `native-picker-injector.ts`, augment `IssueViewerViewQuery` `_graphql` GET responses with the ProjectItemsEdge for member boards (contracts section 2); requires membership already resolved, otherwise skip (Relay commit covers late arrival)
- [X] T012 [US2] Implement `extension/src/content/native-picker/relay-membership.ts`: discover the Relay environment via React fiber walk (bounded depth, pattern family: `board-data-injector.ts` findQueryClient), then `commitUpdate` inserting the edge into `client:<issueNodeId>:__ProjectSection_projectItems_connection(allowSameEnterprise:true)`; idempotent by item id; triggered on `filoz-np-membership` when status is member; fail-open with warning
- [X] T013 [US2] Validate the native delete path live: with the edge injected, uncheck the row and confirm the delete mutation fires and succeeds cross-org; capture its persistedQueryName and extend T008 observation to removals. RESULT: native delete verified working cross-org (2026-08-19); no contingency needed
- [X] T014 [US2] CHECKPOINT: run quickstart V3 (reload persistence + remove) and V4 (no-picker page shows no extension picker, no state flash); restore board state

## Phase 5: User Story 3 - PR pages (legacy UI) (P2)

**Goal**: Same behavior on PR pages; extension performs the mutation since GitHub's endpoint ignores cross-org ids.

**Independent Test**: quickstart.md V5 on filecoin-project/filecoin-pin/pull/1 (restore state after).

- [X] T015 [US3] In `native-picker-injector.ts`, augment `projects_suggestions?scope=recent` responses per contracts section 6 (numeric `databaseId` rows, extension-computed `selected`, skip same-org, skip boards without databaseId with a warning)
- [X] T016 [US3] In `native-picker-injector.ts`, intercept the PR sidebar form POST per contracts section 7: diff injected-board form fields against MembershipState, strip injected ids before passthrough (skip native call if only injected ids changed), dispatch `filoz-np-pr-toggle`; in `native-picker-main.ts`, execute via `ADD_TO_PROJECT`/`DELETE_PROJECT_ITEM` and answer with `filoz-np-pr-toggle-result`
- [X] T017 [US3] CHECKPOINT: run quickstart V5 (native row + toggle on/off with board verification); restore state

## Phase 6: User Story 4 - Retire the custom picker UI (P2)

**Goal**: No extension-rendered picker UI remains; behavior parity confirmed first.

**Independent Test**: quickstart.md V6 + full V1-V8 sweep.

- [X] T018 [US4] Remove `initGlobalBoardsPicker`/`destroyGlobalBoardsPicker` wiring from `extension/src/content/issue-sidebar.ts` (lines ~8-9, 323-336) and delete `extension/src/content/global-boards-picker.ts`; keep `showGlobalBoardsSection` config logic for the injector's board-list derivation if still referenced
- [X] T019 [P] [US4] Remove the global-boards picker CSS block from `extension/src/styles/sidebar.css` (~lines 271-350, `.filoz-global-board*` rules); keep FOC card styles
- [X] T020 [US4] CHECKPOINT: run quickstart V6 (same-org no duplicate row) and the full V1-V8 regression sweep in light and dark modes

## Phase 7: Polish & cross-cutting

- [X] T021 [P] Update `docs/github-page-layout.md`: add a data-layer section (item-pickers feed shape and owner nesting, IndexedDB persister, Relay connection key, PR suggestions/form endpoints, mutation names) and prune retired DOM-anchoring guidance; refresh the last-verified date
- [X] T022 [P] Update `docs/global-boards-picker-status.md` and `AGENT.md` architecture list to describe the native-picker module and retired custom UI
- [X] T023 Final gates: `npm run build`, `npm run lint`, `npm run typecheck`; confirm quickstart exit criteria; draft PR description with manifest smoke checklist (new content script + web_accessible_resource) per constitution Principle IV

## Dependencies & execution order

- Phase 1 -> Phase 2 -> user stories. US1 (Phase 3) is the MVP gate.
- US2 depends on US1's mutation observation (T008) and membership plumbing; run after US1.
- US3 (PR) is independent of US2; it can start after Phase 2 + T007's injector patterns exist (recommended after US1 checkpoint).
- US4 strictly last among stories (requires V1-V5 passing).
- Parallel opportunities: T002/T003; T009 alongside T007/T008; T019 alongside T018; T021/T022.

## Implementation strategy

Ship in story order with a live checkpoint after each phase; every checkpoint uses the dev Chrome + CDP workflow and restores board state. Stop-and-validate points: after T010 (MVP demonstrable), after T014 (issue pages complete), after T017 (PR parity), after T020 (retirement safe).
