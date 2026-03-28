# Tasks: Build and distribution workflows

**Input**: Design documents from `/specs/005-build-distribution-workflows/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/build-channels.md](./contracts/build-channels.md), [quickstart.md](./quickstart.md)

**Tests**: Per constitution, automated tests are optional; manual steps live in [quickstart.md](./quickstart.md).

**UI**: No `github.com` injection for this feature — Principle VI N/A.

**Organization**: Phases follow user story priority (P1 → P3); MVP = complete through User Story 1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no ordering dependency)
- **[Story]**: User story label only on US phases ([US1], [US2], [US3])

## Path Conventions

Browser extension + Node tooling at repository root: `extension/`, `scripts/`, `docs/`, `.github/workflows/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Align on scope and current code vs design artifacts.

- [x] T001 Review `specs/005-build-distribution-workflows/spec.md` and `specs/005-build-distribution-workflows/contracts/build-channels.md` against existing `scripts/build.mjs` and `scripts/zip-dist.mjs` and list gaps in PR or working notes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared documentation and env contract so every story builds on the same assumptions.

**⚠️ CRITICAL**: Complete before merging story work that changes CI or cross-story docs.

- [x] T002 Extend `.env.example` at repository root with explicit **local (pinned ID)** vs **store listing** GitHub OAuth usage and recommended GitHub Actions secret names (no real secrets)
- [x] T003 [P] Add a short **Build & distribution** section to `README.md` at repository root linking to `extension/README.md`, `docs/github-oauth-app.md`, and `specs/005-build-distribution-workflows/quickstart.md`

**Checkpoint**: Env contract and entrypoints discoverable from root README.

---

## Phase 3: User Story 1 — Local build and test with stable identity (Priority: P1) 🎯 MVP

**Goal**: Contributors can build an unpacked `extension/dist/` load with a **stable extension ID** and know which GitHub OAuth callback to register.

**Independent Test**: Follow `extension/README.md` local path only; `npm run build` prints ID + redirect; two machines same revision → same ID; **Connect GitHub** succeeds when OAuth app matches.

### Implementation for User Story 1

- [x] T004 [US1] Add or refine a **Local / unpacked** subsection in `extension/README.md` covering `npm install`, `npm run build`, loading `extension/dist/` in `chrome://extensions`, reading **Stable extension ID** / **OAuth redirect** from build output, and pairing with the dev OAuth app
- [x] T005 [P] [US1] Verify `docs/github-oauth-app.md` states the pinned local ID / `manifest.key` policy and single-callback-per-OAuth-app constraint without contradicting `scripts/build.mjs` behavior

**Checkpoint**: US1 documentation alone is sufficient for a new teammate to complete local OAuth setup.

---

## Phase 4: User Story 2 — Production / Store-bound package (Priority: P2)

**Goal**: Maintainers produce a **store-ingestion-safe** ZIP (no `manifest.key`) using **production** OAuth credentials bound to the store extension ID.

**Independent Test**: `npm run build:zip`; `unzip -p foc-gh-webstore.zip manifest.json` has no `"key"`; store accepts upload; installed build uses production callback.

### Implementation for User Story 2

- [x] T006 [US2] Add or refine **Chrome Web Store ZIP** steps in `extension/README.md`: `npm run build:zip`, artifact path `foc-gh-webstore.zip` (gitignored), requirement to use **store-channel** `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET`, and reminder that store extension ID may differ from local ID
- [x] T007 [P] [US2] Ensure `docs/github-oauth-app.md` documents **two** OAuth apps when store ID ≠ local ID, with callback `https://<store-extension-id>.chromiumapp.org/` registered on the production app

**Checkpoint**: US2 docs sufficient to produce a compliant package and avoid channel mix-ups.

---

## Phase 5: User Story 3 — Automation from repository workflows (Priority: P3)

**Goal**: GitHub Actions runs the same install/build (and typecheck) as local dev; secrets are not logged; fork PRs do not leak org secrets.

**Independent Test**: Workflow green on default branch with secrets configured; fork PR workflow skips or uses safe fallback without exposing `GITHUB_OAUTH_CLIENT_SECRET` in logs.

### Implementation for User Story 3

- [x] T008 [US3] Create `.github/workflows/extension-ci.yml` with `actions/checkout`, Node setup, `npm ci`, `npm run typecheck`, and `npm run build` only when repository secrets for OAuth are available (or use documented placeholder behavior for fork PRs)
- [x] T009 [US3] Document workflow file name, branch triggers, and required GitHub Actions secret names in `extension/README.md`

**Checkpoint**: FR-006 satisfied; maintainers can see CI status on PRs.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Keep design artifacts executable and satisfy constitution PR expectations.

- [x] T010 [P] Update `specs/005-build-distribution-workflows/quickstart.md` to match final `.github/workflows/extension-ci.yml` filename, secret names, and any doc path changes
- [x] T011 Run manual validation from `specs/005-build-distribution-workflows/quickstart.md` and capture smoke checklist results in the PR description (per constitution for auth/build changes)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Start immediately
- **Phase 2 (Foundational)**: Depends on T001 gap review (can proceed in parallel once gaps are understood)
- **Phase 3–5 (US1–US3)**: Depend on Phase 2 for shared `.env.example` + root README pointers; US2/US3 may proceed after US1 docs land or in parallel if no file conflicts
- **Phase 6 (Polish)**: After T008–T009 exist if quickstart references CI

### User Story Dependencies

- **US1 (P1)**: No dependency on US2/US3 for **local** testing
- **US2 (P2)**: Logically after US1 documentation pattern exists (same `extension/README.md`) but independently testable
- **US3 (P3)**: Independent of US1/US2 functionally; touching **different files** than US1 story text (`.github/workflows/` vs prose)

### Parallel Opportunities

- **After T002**: T003, T005, T007, T010 can proceed in parallel (different target files) where content does not overlap—avoid editing the same subsection concurrently
- **US3**: T008 before T009 (workflow must exist to document accurately), or draft doc in description comments first

### Parallel Example: User Story 1

```bash
# After T004 starts: editor A on extension/README.md; editor B on docs/github-oauth-app.md (T005)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001 → T002 → T003  
2. T004 + T005  
3. **STOP**: Run local quickstart “Local / unpacked” only; demo MVP

### Incremental Delivery

1. Add T006 + T007 (store path)  
2. Add T008 + T009 (CI)  
3. T010 + T011 polish

---

## Task Summary

| Phase        | Task IDs | Count |
|-------------|----------|-------|
| Setup       | T001     | 1     |
| Foundational| T002–T003| 2     |
| US1         | T004–T005| 2     |
| US2         | T006–T007| 2     |
| US3         | T008–T009| 2     |
| Polish      | T010–T011| 2     |
| **Total**   |          | **11**|

**Parallel-ready tasks**: T003, T005, T007, T010 (mark **[P]**).

**Suggested MVP scope**: Complete through **T005** ([US1]).

**Format validation**: All tasks use `- [ ]`, sequential **T001–T011**, story labels only on US phases, and include at least one concrete repo path per task.
