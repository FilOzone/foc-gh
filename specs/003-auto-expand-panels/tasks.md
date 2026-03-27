---

description: "Task list for 003 — Auto-expand project panels"
---

# Tasks: Auto-expand project panels on issues and PRs

**Input**: Design documents from [`specs/003-auto-expand-panels/`](./)  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/issue-pr-panel-expansion.md](./contracts/issue-pr-panel-expansion.md), [quickstart.md](./quickstart.md)

**Tests**: Per constitution, automated tests are optional; manual verification follows [quickstart.md](./quickstart.md).

**UI**: Any options or injected sidebar behavior MUST keep Principle VI (light/dark); expansion uses existing card chrome (`body.hidden` only).

**Organization**: Phases follow user story priorities (P1 → P3) after shared storage exists.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependencies within the phase)
- **[Story]**: User story label for story phases only
- Descriptions include concrete file paths under `extension/`

## Path Conventions

Browser extension sources: `extension/src/` (content scripts, lib, options); build via `extension/package.json`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the workspace builds before touching feature code.

- [ ] T001 Run `npm install` (if needed) and `npm run build` in `extension/` to verify the TypeScript pipeline passes on branch `003-auto-expand-panels`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Persisted preference key and typed config **must** exist before content scripts read it.

**⚠️ CRITICAL**: Complete this phase before User Story implementation.

- [ ] T002 Add `issuePrProjectsAutoExpand` to `STORAGE_KEYS`, extend `StoredConfig`, and return default `true` when key missing in `loadConfig()` in `extension/src/lib/project-config.ts` (align key string with [data-model.md](./data-model.md))

**Checkpoint**: `loadConfig()` exposes a boolean suitable for `issue-sidebar.ts` without `undefined`.

---

## Phase 3: User Story 1 — Default expansion for project detail (Priority: P1) 🎯 MVP

**Goal**: Issue and PR pages show extension FOC card **field body** expanded when the preference is on; collapsed when off; after async panel load, preference **on** forces expanded if the user has not set a per-item session override.

**Independent Test**: With preference on, open a target-repo issue with FOC panel data; after load, body is expanded without clicking the chevron. With preference off, body starts collapsed. Status row remains visible in both cases.

### Implementation for User Story 1

- [ ] T003 [P] [US1] Implement `createFocProjectCard` options (`initialExpanded`, `sessionStorageKey`), per-item `sessionStorage` read/write on chevron toggle, and removal of the global-only key behavior in `extension/src/content/foc-project-card.ts` per [research.md](./research.md)
- [ ] T004 [US1] Derive session key from `ctx` (`owner`, `name`, `number`, `kind`), pass `cfg.issuePrProjectsAutoExpand` into `createFocProjectCard`, and after successful `GET_PANEL_STATE` apply `setExpanded(true)` when preference is true and session does not record an explicit collapse for this item in `extension/src/content/issue-sidebar.ts`
- [ ] T005 [P] [US1] Add checkbox + helper paragraph (initial copy) bound to the new storage key in `extension/src/options/options.html`
- [ ] T006 [US1] Load and persist the new key in `extension/src/options/options.ts` using `STORAGE_KEYS` from `extension/src/lib/project-config.ts` (mirror existing `load()` / `save()` patterns)

**Checkpoint**: User Story 1 acceptance scenarios (spec §US1) satisfied on issues and PRs for extension-managed card.

---

## Phase 4: User Story 2 — Same behavior in-org and cross-org (Priority: P2)

**Goal**: Auto-expand does not differ by whether the linked project’s org matches the repo org; behavior is driven only by shared config + session rules.

**Independent Test**: With preference on, verify one **cross-org** representative issue/PR (e.g. `filecoin-project/*` item with FilOzone board) and one **same-org** scenario behave identically regarding expanded body after load.

### Implementation for User Story 2

- [ ] T007 [US2] Run the manual matrix in [quickstart.md](./quickstart.md) for cross-org vs same-org; confirm no org-specific branches are required—if gaps exist, fix only in `extension/src/content/issue-sidebar.ts` / `extension/src/content/foc-project-card.ts` without adding GitHub API calls; record verification notes in the PR

**Checkpoint**: User Story 2 acceptance scenarios satisfied without per-org settings.

---

## Phase 5: User Story 3 — Discoverable options copy (Priority: P3)

**Goal**: Options page control clearly states **issues and pull requests** and **initial** expansion of project **field sections** (FR-006 / contract).

**Independent Test**: A reviewer finds the control within one minute and understands scope without reading code.

### Implementation for User Story 3

- [ ] T008 [US3] Refine checkbox `label`, helper text, and any `aria` strings in `extension/src/options/options.html` to match FR-006 and [contracts/issue-pr-panel-expansion.md](./contracts/issue-pr-panel-expansion.md); keep tone consistent with existing options page

**Checkpoint**: User Story 3 acceptance scenarios satisfied.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Type safety, docs drift, merge readiness.

- [ ] T009 [P] Run `npm run typecheck` and `npm run build` in `extension/`; fix any TypeScript or bundler issues introduced by the feature
- [ ] T010 [P] Reconcile [quickstart.md](./quickstart.md) with final options labels and session-key behavior; update that file only if instructions or filenames drifted during implementation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No prerequisites.
- **Phase 2 (Foundational)**: Depends on Phase 1 (green build). **Blocks** all user stories.
- **Phase 3 (US1)**: Depends on **T002**. **T004** depends on **T003** and **T002**. **T006** depends on **T002** and **T005** (shared element ids). Recommended order: **T002 → T003, T005 (parallel) → T004, T006**.
- **Phase 4 (US2)**: Depends on Phase 3 (behavior shipped).
- **Phase 5 (US3)**: Depends on **T005/T006** existing (control to refine); can follow US2 or in parallel with verification if copy-only.
- **Phase 6 (Polish)**: Depends on desired user stories being complete.

### User Story Dependencies

- **US1**: Requires Foundational **T002**. Independently testable once **T003–T006** land.
- **US2**: Requires US1 behavior; primarily **verification** (**T007**).
- **US3**: Refines **T005** output; depends on options UI existing (**T005**, **T006**).

### Parallel Opportunities

- After **T002**: **T003** (`foc-project-card.ts`) and **T005** (`options.html`) touch different files — parallel.
- After US1 code complete: **T007** (manual) can overlap with drafting **T008** copy.
- **T009** and **T010** in Phase 6 can run in parallel once implementation is stable.

---

## Parallel Example: User Story 1 (after T002)

```bash
# Parallel implementation track A:
Task T003 — `extension/src/content/foc-project-card.ts`

# Parallel implementation track B:
Task T005 — `extension/src/options/options.html`

# Then serialize integration:
Task T004 — `extension/src/content/issue-sidebar.ts` (needs T003 + T002)
Task T006 — `extension/src/options/options.ts` (needs T005 + T002)
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1–2 (build + `project-config.ts`).
2. Complete Phase 3 (**T003–T006**).
3. **STOP and VALIDATE**: [quickstart.md](./quickstart.md) US1-style checks (pref on/off, issue + PR).

### Incremental Delivery

1. Add **US2** verification (**T007**) → record in PR.
2. Add **US3** copy polish (**T008**).
3. Polish (**T009–T010**) → merge.

### Parallel Team Strategy

- Developer A: **T003**, then **T004**
- Developer B: **T002**, then **T005**, then **T006**

---

## Notes

- Native GitHub project sidebar rows are **out of scope** for MVP ([research.md](./research.md)); tasks apply only to the extension FOC card shell.
- Do not add `manifest.json` host permissions or new GitHub API scopes for this feature.
- Total tasks: **10** (T001–T010). Count per story: **US1** = 4 tasks (**T003–T006**), **US2** = 1 (**T007**), **US3** = 1 (**T008**). Setup = 1, Foundational = 1, Polish = 2.
