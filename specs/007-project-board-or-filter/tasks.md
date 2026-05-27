# Tasks: Enable Project Board Filtering with OR Conditions

**Input**: Design documents from `/specs/007-project-board-or-filter/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Automated tests are optional per constitution Principle IV. Manual verification is the primary validation method.

**UI**: No custom UI injected — merged data is rendered by GitHub's own React app. No light/dark theme work needed.

**Manual verification URLs**: See Test URLs in plan.md and `docs/canonical-test-urls.md`.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Add project board content script match and create file structure for the new feature module.

- [ ] T001 Add content_scripts entry for project board pages (`https://github.com/orgs/*/projects/*/views/*`) in `extension/manifest.json`
- [ ] T002 Add new esbuild entry point for board-filter content script in `scripts/build.mjs`
- [ ] T003 Create directory `extension/src/content/board-filter/` and empty entry point `extension/src/content/board-filter/board-filter-main.ts`
- [ ] T004 Add `board-filter-main-world.js` to `web_accessible_resources` in `extension/manifest.json` (needed for main-world script injection)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement the three standalone modules that all user stories depend on. These are pure logic with no DOM or browser dependencies and can be built in parallel.

**CRITICAL**: No user story integration work can begin until these modules are complete.

- [ ] T005 [P] Implement OR query parser in `extension/src/content/board-filter/or-query-parser.ts` — parse filter string into `{ prefix, branches }` per contract in `specs/007-project-board-or-filter/contracts/or-query-parser.ts`; handle valid OR syntax, plain queries (no OR), and return structured `ORParseResult`
- [ ] T006 [P] Implement memex API client in `extension/src/content/board-filter/memex-api.ts` — extract `memexId` from `#memex-item-get-api-data` script tag, extract view params (sort, group, slice, fields) from `#memex-views` script tag, fetch `GET /memexes/{memexId}/paginated_items` with query params, follow cursor-based pagination via `after` parameter until all pages fetched
- [ ] T007 [P] Implement result merger in `extension/src/content/board-filter/result-merger.ts` — take array of API responses (one per OR branch), deduplicate items by `item.id`, union group metadata from all branches, reconstruct `groupedItems` with items in correct groups, recalculate `totalCount` and merge `slices`

**Checkpoint**: All three standalone modules are complete and can be exercised via console/unit tests.

---

## Phase 3: User Story 1 — Standup View with OR Filter (Priority: P1) MVP

**Goal**: A TPM can enter an OR query in the project board filter bar and see merged results from all branches in a single view — eliminating the need to switch between multiple board views during standup.

**Independent Test**: Navigate to `https://github.com/orgs/FilOzone/projects/14/views/20`, enter `cycle:202605-2 biglep (-status:"🎉 Done") OR (-last-updated:1days)` in filter bar, verify merged results from both branches appear with no duplicates.

### Implementation for User Story 1

- [ ] T008 [US1] Implement main-world fetch interceptor in `extension/src/content/board-filter/board-data-injector.ts` — monkey-patch `window.fetch` to detect calls to `/memexes/{id}/paginated_items`; when an OR query is active, intercept the call, invoke multi-branch fetch (one call per branch using `memex-api.ts`), merge results (using `result-merger.ts`), and return merged response as if it were a single API response; when no OR query is active, pass through to original fetch unchanged
- [ ] T009 [US1] Implement content script entry point in `extension/src/content/board-filter/board-filter-main.ts` — observe `#filter-bar-component-input` for Enter key and form submission events; parse filter text using `or-query-parser.ts`; if OR detected, signal main-world script (via `window.postMessage` or `CustomEvent`) with the parsed query; inject main-world script (`board-data-injector.ts`) into the page on load (following the pattern in `extension/src/content/pr-expand-main-world.ts`)
- [ ] T010 [US1] Wire content script and main-world script communication in `extension/src/content/board-filter/board-filter-main.ts` and `extension/src/content/board-filter/board-data-injector.ts` — define message protocol for: (a) content script → main-world: "OR query active with these branches", (b) content script → main-world: "no OR query, pass through", (c) handle SPA navigation (view switches) by re-detecting filter bar and re-attaching listeners
- [ ] T011 [US1] Build and manually verify end-to-end on `https://github.com/orgs/FilOzone/projects/14/views/20` — run `npm run build && node scripts/cdp-reload.mjs`, enter OR query, confirm merged results appear, confirm no duplicates, confirm non-OR queries still work, confirm existing issue/PR sidebar features are unaffected

**Checkpoint**: User Story 1 is fully functional. OR queries work on project board pages. Non-OR queries pass through unchanged. Existing features unaffected.

---

## Phase 4: User Story 3 — Graceful Fallback for Invalid OR Syntax (Priority: P3)

**Goal**: Invalid OR syntax (nested parens, trailing terms, OR inside parens) is detected, and the extension falls back to native GitHub filtering without breaking the board.

**Independent Test**: Enter `((nested))` or `(a) OR (b) trailing` in filter bar and verify the board filters normally (native behavior) with no errors.

### Implementation for User Story 3

- [ ] T012 [US3] Add invalid OR syntax detection to `extension/src/content/board-filter/or-query-parser.ts` — handle all invalid patterns: nested parentheses `((…))`, filter terms after final `)`, `OR` keyword inside parentheses, single branch `(…)` without OR; return `{ kind: 'invalid_or', error }` with specific error type
- [ ] T013 [US3] Handle `invalid_or` parse result in `extension/src/content/board-filter/board-filter-main.ts` — when parser returns `invalid_or`, do nothing (let native filtering proceed); log a console warning with the parse error for debugging
- [ ] T014 [US3] Manually verify fallback behavior — enter each invalid pattern on `https://github.com/orgs/FilOzone/projects/14/views/20`, confirm native GitHub filtering works normally, confirm no console errors beyond the debug warning

**Checkpoint**: All invalid OR patterns degrade gracefully to native filtering. No user-visible errors.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentation updates, edge case hardening, and verification across multiple views.

- [ ] T015 [P] Update `docs/canonical-test-urls.md` with project board OR filter test URLs and scenarios per plan.md verification section
- [ ] T016 [P] Add `extension/src/content/board-filter/` module overview comment in `board-filter-main.ts` explaining architecture (content script → main-world script → fetch interception → merge)
- [ ] T017 Verify on multiple views: test OR queries on "All" view (`/views/2`, large item set with pagination), "Recently Updated" view (`/views/33`), and a board-layout view if available
- [ ] T018 Verify cancellation behavior: change filter while OR query is in-flight, confirm no stale results or errors appear

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001-T004) — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (T005-T007) — core feature
- **User Story 3 (Phase 4)**: Depends on Foundational (T005) for parser — can run in parallel with US1 since T012 extends the parser independently
- **Polish (Phase 5)**: Depends on US1 completion (T011)

### User Story Dependencies

- **User Story 1 (P1)**: Requires all three foundational modules (parser, API client, merger). This is the MVP.
- **User Story 3 (P3)**: Requires only the parser module (T005). Parser edge-case work (T012) can proceed in parallel with US1 integration work.

### Within Each User Story

- Foundational modules before integration
- Integration before verification
- Each story is independently testable at its checkpoint

### Parallel Opportunities

- T005, T006, T007 can all run in parallel (different files, no shared dependencies)
- T012 (US3 parser edge cases) can run in parallel with T008-T010 (US1 integration) since they touch different parts of the parser
- T015, T016 can run in parallel (different files)

---

## Parallel Example: Foundational Phase

```
# These three modules are independent and can be built simultaneously:
T005: OR query parser in extension/src/content/board-filter/or-query-parser.ts
T006: Memex API client in extension/src/content/board-filter/memex-api.ts
T007: Result merger in extension/src/content/board-filter/result-merger.ts
```

## Parallel Example: US1 + US3

```
# After foundational phase, these can proceed in parallel:
Developer A (US1): T008 → T009 → T010 → T011
Developer B (US3): T012 → T013 → T014
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T007) — build in parallel
3. Complete Phase 3: User Story 1 (T008-T011) — integration and verification
4. **STOP and VALIDATE**: Test OR query on project board, confirm merged results
5. Deploy if ready — this delivers the core standup use case

### Incremental Delivery

1. Setup + Foundational → modules ready
2. Add User Story 1 → Test → Deploy (MVP — standups unblocked!)
3. Add User Story 3 → Test → Deploy (invalid syntax handled gracefully)
4. Polish → Docs, multi-view verification

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- No automated tests required per constitution; manual verification at each checkpoint
- Commit after each task or logical group
- The main-world script injection follows the existing pattern in `extension/src/content/pr-expand-main-world.ts`
- The internal `/memexes/{id}/paginated_items` API is undocumented; if GitHub changes it, the extension degrades to native filtering (pass-through)
