# Tasks: Global boards in Projects gear menu

**Input**: Design documents from [`specs/006-outside-org-projects-picker/`](.)  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [data-model.md](./data-model.md), [contracts/global-boards-picker-ui.md](./contracts/global-boards-picker-ui.md), [research.md](./research.md), [quickstart.md](./quickstart.md)

**Tests**: Per [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md), automated tests are **optional**; this list emphasizes **manual** verification from [quickstart.md](./quickstart.md).

**UI**: Injected DOM MUST satisfy **Principle VI** (native fidelity, light/dark, **no** hashed GitHub CSS module classes).

**Organization**: Phases follow **User Story** priority from [spec.md](./spec.md) (US1 P1, US2 P1, US3 P2).

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Different files, no dependency on incomplete tasks in the same batch
- **[USn]**: User story label for story phases only

## Path conventions

Browser extension root: [`extension/`](../../extension/) (see [plan.md](./plan.md)).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Align on artifacts and repo layout before code.

- [x] T001 Read [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md), [contracts/global-boards-picker-ui.md](./contracts/global-boards-picker-ui.md), and [quickstart.md](./quickstart.md) end-to-end

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, GraphQL, and service worker handlers **before** content script UI.

**⚠️ CRITICAL**: User story phases MUST NOT start until this phase completes.

- [x] T002 [P] Add and export `showGlobalBoardsSection(repoOwner: string, boardUrls: string[]): boolean` in [`extension/src/lib/project-config.ts`](../../extension/src/lib/project-config.ts) per [data-model.md](./data-model.md#visibility) (reuse [`parseOrgProjectUrl`](../../extension/src/lib/project-config.ts))
- [x] T003 [P] Add `MUTATION_DELETE_PROJECT_ITEM` (`deleteProjectV2Item`) in [`extension/src/lib/queries.ts`](../../extension/src/lib/queries.ts) matching GitHub Projects v2 schema
- [x] T004 [P] Add `GetGlobalBoardsStateMessage` and `DeleteProjectItemMessage` types to union in [`extension/src/lib/messages.ts`](../../extension/src/lib/messages.ts) with payloads per [contracts/global-boards-picker-ui.md](./contracts/global-boards-picker-ui.md)
- [x] T005 Implement `GET_GLOBAL_BOARDS_STATE` handler in [`extension/src/background/service-worker.ts`](../../extension/src/background/service-worker.ts) (resolve `contentNodeId`, each board’s `projectId`, `itemId` via patterns aligned with [`getPanelState`](../../extension/src/background/service-worker.ts); parallelize per-board work where safe per [plan.md](./plan.md))
- [x] T006 Implement `DELETE_PROJECT_ITEM` handler in [`extension/src/background/service-worker.ts`](../../extension/src/background/service-worker.ts) calling the new delete mutation (map errors for UI per [research.md](./research.md))

**Checkpoint**: From options page or temporary logging, `GET_GLOBAL_BOARDS_STATE` returns coherent rows for a known issue/PR before picker UI exists.

---

## Phase 3: User Story 1 — Issue page: Global boards + checkbox (Priority: P1) 🎯 MVP

**Goal**: On **issues** where [visibility](./data-model.md#visibility) applies, **Projects** gear menu shows **Global boards** with **checkbox**, **link**, **add/remove** via service worker.

**Independent Test**: [quickstart.md](./quickstart.md) sections **A**, **D** (issue), **F** — checkbox matches board; check adds; uncheck removes.

### Implementation for User Story 1

- [x] T007 [US1] Create [`extension/src/content/global-boards-picker.ts`](../../extension/src/content/global-boards-picker.ts) — detect open picker (`role="dialog"` / accessible name per [research.md](./research.md)), inject `[data-filoz-global-boards="1"]` section **Issue** layout, idempotent cleanup, **no** hashed GitHub classes
- [x] T008 [US1] In [`extension/src/content/global-boards-picker.ts`](../../extension/src/content/global-boards-picker.ts), call `showGlobalBoardsSection` + [`loadConfig`](../../extension/src/lib/project-config.ts); **early-return** when false or no boards (supports [US3](./spec.md#user-story-3---no-redundant-section-when-already-in-org-priority-p2))
- [x] T009 [US1] Wire `GET_GLOBAL_BOARDS_STATE` from [`global-boards-picker.ts`](../../extension/src/content/global-boards-picker.ts); render rows with **checkbox** (disabled while loading per [spec.md](./spec.md#edge-cases)) and **plain-text label** (board's actual project title — no `<a>` link per FR-003 removed)
- [x] T010 [US1] On checkbox **check**, call existing [`ADD_TO_PROJECT`](../../extension/src/lib/messages.ts); on **uncheck**, call `DELETE_PROJECT_ITEM`; revert + show error text on failure in [`global-boards-picker.ts`](../../extension/src/content/global-boards-picker.ts)
- [ ] T011 [US1] In [`extension/src/content/issue-sidebar.ts`](../../extension/src/content/issue-sidebar.ts), move `initGlobalBoardsPicker` call **before** the `isTargetRepo` guard so gear picker runs on **all** pages; call `destroyGlobalBoardsPicker` in the else branch when `showGlobalBoardsSection` is false
- [x] T012 [P] [US1] Add Primer-token styles for Global boards rows in [`extension/src/styles/sidebar.css`](../../extension/src/styles/sidebar.css) (or document inline decision in picker module)

**Checkpoint**: US1 works on a **filecoin-project** issue with FilOzone board configured.

---

## Phase 4: User Story 2 — Pull request layout parity (Priority: P1)

**Goal**: Same behavior on **PR** **Projects** gear menu (tabbed or grouped); shared SW messages.

**Independent Test**: [quickstart.md](./quickstart.md) section **B** + **F**.

### Implementation for User Story 2

- [x] T013 [US2] Extend [`extension/src/content/global-boards-picker.ts`](../../extension/src/content/global-boards-picker.ts) with **PR** layout branch ([`PageKind`](../../extension/src/lib/github-url.ts) / URL) so **Global boards** mounts correctly when GitHub uses tabs
- [x] T014 [US2] Verify [`extension/manifest.json`](../../extension/manifest.json) content_scripts include **pull request** paths for [`issue-sidebar.ts`](../../extension/src/content/issue-sidebar.ts); adjust `matches` if PRs are excluded

**Checkpoint**: US1 + US2 both pass manual flows independently.

---

## Phase 5: User Story 3 — In-org suppression (Priority: P2)

**Goal**: No **Global boards** injection when **every** configured board org equals repo owner ([FR-006](./spec.md)).

**Independent Test**: [quickstart.md](./quickstart.md) section **C**.

### Implementation for User Story 3

- [x] T015 [US3] Audit [`extension/src/content/global-boards-picker.ts`](../../extension/src/content/global-boards-picker.ts) + [`showGlobalBoardsSection`](../../extension/src/lib/project-config.ts) on a **FilOzone** (or matching-org) issue/PR; ensure **no** observers/DOM when predicate is false

**Checkpoint**: In-org pages show **native menu only**.

---

## Phase 5b: Fix picker detection and injection (Issues + PRs)

**Purpose**: Correct the implementation defects identified during code review and live DOM inspection.

- [ ] T020 [P] In [`global-boards-picker.ts`](../../extension/src/content/global-boards-picker.ts): fix `findProjectPickerDialog` / `findMountPoint` to detect **both** picker types — walk up from `input[placeholder*="Filter project"]` to find either `[role="dialog"]` (issue SelectPanel) or `project-picker` element (PR legacy custom element); return a typed `{ dialog, kind }` pair
- [ ] T021 [P] Fix **issue picker mount point**: query dialog for `[class*="FilteredActionList-Container"]` instead of walking up from the filter input (scrollable container is a sibling of the header, not an ancestor of the input)
- [ ] T022 [P] Fix **PR picker mount point**: insert Global boards `<section>` **after** `<tab-container>` inside `<project-picker>` (not appended to the dialog/menu root)
- [ ] T023 [P] Fix **label**: in [`service-worker.ts`](../../extension/src/background/service-worker.ts) `resolveGlobalBoardRow`, change `label` from `\`Global board — ${parsed.org} #${parsed.number}\`` to `project.title` (already fetched in `QUERY_PROJECT_V2` response)
- [ ] T024 [P] Fix **row rendering**: in `renderRow` in [`global-boards-picker.ts`](../../extension/src/content/global-boards-picker.ts), replace the `<a>` link wrapper with plain text in the `<label>` element; remove `filoz-global-board-row-link` anchor and any corresponding link styles in [`sidebar.css`](../../extension/src/styles/sidebar.css)

**Checkpoint**: After T020–T024, gear picker injects correctly on both issue and PR pages; label shows actual project title; no link in row.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Options copy, build, documentation.

- [x] T016 [P] Replace user-visible **cross-org** / **outside organization** board wording with **Global** in [`extension/src/options/options.html`](../../extension/src/options/options.html) per [FR-009](./spec.md)
- [x] T017 [P] Update any user-visible strings for board/repo labels in [`extension/src/options/options.ts`](../../extension/src/options/options.ts) to match **Global** vocabulary
- [x] T018 Run `npm run typecheck` and `npm run build` from [`package.json`](../../package.json) repository root
- [ ] T019 Complete all steps in [`quickstart.md`](./quickstart.md); paste summary + **light/dark** screenshots or notes into PR description

---

## Dependencies & Execution Order

### Phase dependencies

| Phase | Depends on |
|-------|------------|
| 1 Setup | — |
| 2 Foundational | Phase 1 |
| 3 US1 | Phase 2 |
| 4 US2 | Phase 3 (shared module stable; may start after T007–T009 if branched carefully) |
| 5 US3 | Phase 3 (**T008** implements predicate; T015 is audit) |
| 6 Polish | US1–US3 done or PR-ready |

**Recommended order**: T001 → T002–T004 (parallel) → T005 → T006 → T007–T012 → T013–T014 → T015 → T016–T019.

### User story dependencies

- **US1**: Requires Foundational (Phase 2).
- **US2**: Builds on US1 [`global-boards-picker.ts`](../../extension/src/content/global-boards-picker.ts); manifest task independent.
- **US3**: Predicate from **T002** + **T008**; **T015** validates end-to-end.

### Parallel opportunities

- **Phase 2**: T002, T003, T004 in parallel.
- **Phase 3**: T012 can proceed in parallel once T007 creates styling hooks.
- **Phase 6**: T016, T017 in parallel.

---

## Parallel Example: Foundational (Phase 2)

```text
T002  extension/src/lib/project-config.ts
T003  extension/src/lib/queries.ts
T004  extension/src/lib/messages.ts
```

Then sequentially: **T005** → **T006**.

---

## Implementation Strategy

### MVP (issue pages first)

1. Complete **Phase 1–2** (T001–T006).
2. Complete **Phase 3** through **T012** (US1).
3. **STOP**: Run [quickstart.md](./quickstart.md) **A**, **D**, **F** on an issue.

### Full feature

4. **Phase 4** (T013–T014) for PRs.
5. **Phase 5** (T015) in-org audit.
6. **Phase 6** options + build + full quickstart.

### Task summary

| Metric | Value |
|--------|------|
| **Total tasks** | 19 |
| **US1 tasks** | 6 (T007–T012) |
| **US2 tasks** | 2 (T013–T014) |
| **US3 tasks** | 1 (T015) |
| **Setup + Foundational + Polish** | 10 (T001–T006, T016–T019) |
| **Parallel-friendly** | T002–T004, T012, T016–T017 |

---

## Notes

- Commit scope: conventional commits; do not push without maintainer approval.
- If `deleteProjectV2Item` shape differs from GitHub’s current schema, adjust **T003** first, then **T006**.
- Re-run [`update-agent-context.sh`](../../.specify/scripts/bash/update-agent-context.sh) `cursor-agent` after large plan changes (optional).
