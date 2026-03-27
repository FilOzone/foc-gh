# Tasks: FOC Project Board sidebar presentation

**Input**: Design documents from `/specs/002-foc-project-widget-ui/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/sidebar-widget-ui.md](./contracts/sidebar-widget-ui.md), [quickstart.md](./quickstart.md)

**Tests**: Per `.specify/memory/constitution.md`, automated tests are optional; one optional unit-test task is included. Manual verification in [quickstart.md](./quickstart.md) is merge-acceptable.

**UI**: All DOM/CSS work MUST satisfy Principle VI (native GitHub UI, light + dark). Mark manual theme checks in the PR using [quickstart.md](./quickstart.md).

**Organization**: Phases follow spec user stories (US1 P1, US2 P2, US3 P3).

## Format

`- [ ] Tnnn [P?] [USn?] Description with file path`

---

## Phase 1: Setup (shared infrastructure)

**Purpose**: Align repo layout and build outputs with [plan.md](./plan.md).

- [ ] T001 Ensure `extension/src/content/`, `extension/src/lib/`, and `extension/src/styles/` exist and match plan.md structure
- [ ] T002 Verify `extension/manifest.json` content scripts and `web_accessible_resources` reference built assets under `extension/dist/` after `scripts/build.mjs`
- [ ] T003 [P] Restore or update root `package.json` with `build` script targeting `scripts/build.mjs` so `extension/dist/` is reproducible
- [ ] T004 [P] Update `scripts/build.mjs` to bundle TypeScript entry(ies) and copy `extension/src/styles/sidebar.css` into `extension/dist/sidebar.css`

---

## Phase 2: Foundational (blocking)

**Purpose**: Placement helpers, field model, mutations, autosave, token CSS—required before any user story UI.

**Checkpoint**: Native mount point resolves on a real issue + PR page; field types map from GraphQL; CSS uses host variables only.

- [ ] T005 Implement `findProjectsSidebarMount()` returning an anchor **inside** Projects **after** native project cards and **before** Milestone in `extension/src/content/projects-sidebar-mount.ts` (see [contracts/sidebar-widget-ui.md](./contracts/sidebar-widget-ui.md))
- [ ] T006 [P] Add Projects v2 field-definition + item snapshot parsing aligned with [data-model.md](./data-model.md) in `extension/src/lib/project-v2-fields.ts`
- [ ] T007 [P] Add `normalizeFieldType()` and option-list helpers in `extension/src/lib/project-field-types.ts`
- [ ] T008 Add debounced autosave (~300 ms idle, flush on `blur`) in `extension/src/lib/autosave.ts`
- [ ] T009 Wrap `updateProjectV2ItemFieldValue` (or equivalent) with optimistic UI + user-safe errors in `extension/src/lib/project-item-mutations.ts`
- [ ] T010 Rebuild `extension/src/styles/sidebar.css` to use GitHub CSS variables / inherited colors only (no fixed light-only palette) per [research.md](./research.md)
- [ ] T011 Refactor `extension/src/content/issue-sidebar.ts` to consume `findProjectsSidebarMount()` from `extension/src/content/projects-sidebar-mount.ts` instead of ad-hoc sidebar roots
- [ ] T012 Load unpacked `extension/dist/` on a GitHub issue in **light** mode; confirm script runs without console errors; note result in PR (see [quickstart.md](./quickstart.md))

---

## Phase 3: User Story 1 — Recognizable FOC card in the right place (Priority: P1) 🎯 MVP

**Goal**: Card in **Projects** above **Milestone**; GitHub-like chrome; chevron expand/collapse; legible in **light + dark**.

**Independent Test**: Open linked issue/PR: widget sits in Projects above Milestone; chevron toggles body; both themes readable ([spec.md](./spec.md) US1).

### Implementation

- [ ] T013 [US1] Insert panel host at Projects mount from T005/T011 in `extension/src/content/issue-sidebar.ts`
- [ ] T014 [US1] Implement bordered card shell + header (Projects icon + configured title) in `extension/src/content/foc-project-card.ts`
- [ ] T015 [US1] Add chevron **button** with `aria-expanded` and accessible name in `extension/src/content/foc-project-card.ts` per [contracts/sidebar-widget-ui.md](./contracts/sidebar-widget-ui.md)
- [ ] T016 [US1] Toggle visibility of collapsible body (field rows container) with session-scoped expanded state in `extension/src/content/foc-project-card.ts`
- [ ] T017 [US1] Apply spacing/typography tokens for card + header in `extension/src/styles/sidebar.css` to match reference screenshots
- [ ] T018 [US1] Manual QA: issue + PR (conversation), **light + dark**, Milestone visible vs absent—record URLs in [quickstart.md](./quickstart.md) matrix

**Checkpoint**: US1 demoable without full field editing (placeholder body OK until US2).

---

## Phase 4: User Story 2 — Field editing like GitHub, autosave (Priority: P2)

**Goal**: Status + custom fields use native-like controls; **autosave**; no Save/Cancel; errors visible; unsupported types read-only.

**Independent Test**: Change Status + text + single select; full reload shows persisted values; no Save button ([spec.md](./spec.md) US2).

### Implementation

- [ ] T019 [P] [US2] Render **Status** / single-select pill + choice list in `extension/src/content/foc-field-renderer.ts`
- [ ] T020 [P] [US2] Render **TEXT** / **NUMBER** labeled inputs in `extension/src/content/foc-field-renderer.ts`
- [ ] T021 [P] [US2] Render **ITERATION** (and date-shaped fields) as select-style UI in `extension/src/content/foc-field-renderer.ts`
- [ ] T022 [US2] Persist select/status on change via `extension/src/lib/project-item-mutations.ts`
- [ ] T023 [US2] Persist text/number via `extension/src/lib/autosave.ts` + `extension/src/lib/project-item-mutations.ts`
- [ ] T024 [US2] Remove any Save/Cancel affordances from panel markup in `extension/src/content/issue-sidebar.ts` and `extension/src/content/foc-project-card.ts`
- [ ] T025 [US2] Render **UNSUPPORTED** fields as read-only text or omit with muted label in `extension/src/content/foc-field-renderer.ts` per [data-model.md](./data-model.md)
- [ ] T026 [US2] Show inline mutation errors next to controls; refetch item on hard failure per [research.md](./research.md) in `extension/src/content/foc-field-renderer.ts` or `extension/src/lib/project-item-mutations.ts`

**Checkpoint**: US2 independently testable on FilOzone / FOC-configured items.

---

## Phase 5: User Story 3 — Coexistence with native project cards (Priority: P3)

**Goal**: Native project cards remain visible; FOC card ordered correctly; no occlusion of required host UI.

**Independent Test**: PR with native FilOz-style card + FOC: both visible; Milestone order preserved ([spec.md](./spec.md) US3).

### Implementation

- [ ] T027 [US3] Verify insertion runs **after** last native `.discussion-sidebar-item` project entry (or host-equivalent) without removing siblings in `extension/src/content/projects-sidebar-mount.ts`
- [ ] T028 [US3] Manual QA multi-project PR (e.g. filecoin-project) using [quickstart.md](./quickstart.md); attach screenshots light+dark
- [ ] T029 [US3] Confirm `extension/src/lib/github-url.ts` still resolves issue/PR context on `/pull/{n}/files` and conversation tabs so panel syncs (extend if gap found)

**Checkpoint**: US3 passes cross-org/multi-card scenario.

---

## Phase 6: Polish & cross-cutting

**Purpose**: Docs, optional tests, build hygiene.

- [ ] T030 [P] Fill PR manual QA matrix with **real URLs** and pass/fail in `specs/002-foc-project-widget-ui/quickstart.md`
- [ ] T031 Add or update root `README.md` with install, build (`npm run build`), unpacked load path `extension/dist/`, and PAT/scopes pointer
- [ ] T032 [P] Optional: add `extension/tests/project-field-types.test.ts` for `extension/src/lib/project-field-types.ts` if Vitest/Jest exists; **skip** if no test runner wired
- [ ] T033 Run `npm run build` and resolve type/lint issues for touched files under `extension/src/`

---

## Dependencies & execution order

### Phase dependencies

- **Phase 1** → **Phase 2** → **Phases 3–5** (US1 → US2 → US3 recommended sequence) → **Phase 6**
- **US2** depends on US1 shell/mount (T013–T016) for integration, but field renderers (T019–T021) can start once T009–T010 exist if using a storybook-like stub—default: complete US1 first.

### User story dependencies

| Story | Depends on |
|-------|------------|
| US1 | Phase 2 |
| US2 | Phase 2 + US1 mount/shell (T013–T016) |
| US3 | US1 placement + US2 optional for realistic pages |

### Parallel opportunities

- T003 ∥ T004; T006 ∥ T007; T019 ∥ T020 ∥ T021; T030 ∥ T032 (when unblocked)
- After Phase 2, one developer can finish US1 while another prototypes field renderers **if** mount API is stable (coordination on `foc-project-card.ts` vs `foc-field-renderer.ts` file boundaries).

---

## Parallel example: User Story 2 field renderers

```text
# After T009–T010 complete, in parallel before T022–T023:
- T019 [US2] extension/src/content/foc-field-renderer.ts — Status/single select
- T020 [US2] extension/src/content/foc-field-renderer.ts — Text/number
- T021 [US2] extension/src/content/foc-field-renderer.ts — Iteration
# Then integrate sequentially: T022 → T023
```

---

## Implementation strategy

### MVP first (User Story 1 only)

1. Complete Phases 1–2  
2. Complete Phase 3 (US1)  
3. **Stop**: validate placement, chevron, light/dark shell per [quickstart.md](./quickstart.md)  
4. Demo before field editing

### Incremental delivery

1. US1 → ship/demo  
2. US2 → autosave field parity  
3. US3 → multi-card / cross-org polish  
4. Phase 6 → docs + optional unit tests

---

## Notes

- If `extension/src/` is missing in a shallow clone, restore from VCS before T001 ([plan.md](./plan.md)).  
- Any `manifest.json` or new host permission requires constitution smoke checklist in the PR.  
- Task format: every task line includes **checkbox**, **ID**, and **file path**.

---

## Summary

| Metric | Value |
|--------|------:|
| **Total tasks** | 33 |
| US1 tasks | 6 |
| US2 tasks | 8 |
| US3 tasks | 3 |
| Setup + foundational | 12 |
| Polish | 4 |
| **Suggested MVP** | Phase 1–3 (through **T018**) |
| **Parallel-friendly** | T003, T004, T006, T007, T019–T021, T030, T032 |
