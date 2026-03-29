# Tasks: Cross-org FOC project controls on GitHub

**Input**: Design documents from `/specs/001-cross-org-board-ui/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/github-graphql.md](./contracts/github-graphql.md), [quickstart.md](./quickstart.md)

**Tests**: Not required by spec; manual verification per [quickstart.md](./quickstart.md) and constitution.

**Organization**: Phases follow user stories P1 → P2 → P3 from [spec.md](./spec.md).

## Format

`- [ ] Tnnn [P] [USn] Description with file path`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Repository layout and MV3 build toolchain.

- [x] T001 Create `extension/` tree per [plan.md](./plan.md): `extension/src/background/`, `extension/src/content/`, `extension/src/options/`, `extension/src/lib/`, `extension/styles/`
- [x] T002 Add root `package.json` with TypeScript, extension bundler (Vite or esbuild), and scripts to emit an unpacked load directory (e.g. `extension/dist/`)
- [x] T003 [P] Add `tsconfig.json` at repository root scoped to `extension/src/**/*.ts`
- [x] T004 Add `extension/manifest.json` (MV3) with `service_worker`, `options_page` or `options_ui`, `content_scripts` placeholder matches for `https://github.com/*/*`; declare `host_permissions` for `https://github.com/*` and `https://api.github.com/*` only

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: URL parsing, config defaults, GraphQL transport, storage-backed options. **No user story work until complete.**

**⚠️ CRITICAL**: Block all US1+ until this checkpoint passes.

- [x] T005 Implement URL + page-kind parsing in `extension/src/lib/github-url.ts` (`owner`, `name`, `number`, `issue` vs `pull_request`) from `window.location`
- [x] T006 Implement `extension/src/lib/project-config.ts`: defaults for `cross_org_board_urls` and `cross_org_target_repos` per [data-model.md](./data-model.md); `loadConfig()` / `normalizeRepoKey()` merging `chrome.storage.local`
- [x] T007 Implement `extension/src/lib/queries.ts`: exported query/mutation document strings for R1–R5 in [contracts/github-graphql.md](./contracts/github-graphql.md) (resolve `ProjectV2`, issue/PR `id`, `projectItems` / item fragment, `addProjectV2ItemById`, `updateProjectV2ItemFieldValue`)
- [x] T008 Implement `extension/src/background/service-worker.ts` (or `extension/src/background/graphql.ts` entry) with `fetch` to `https://api.github.com/graphql`, `Authorization: Bearer`, GraphQL error parsing per contract
- [x] T009 Wire `chrome.runtime.onMessage` handler in `extension/src/background/service-worker.ts` dispatching typed actions (`GRAPHQL_REQUEST` with `{ query, variables }`) and returning JSON or structured errors
- [x] T010 Implement `extension/src/options/options.html` + `extension/src/options/options.ts` to edit and save `github_api_token`, `github_token_kind`, `cross_org_board_urls`, `cross_org_target_repos` per [data-model.md](./data-model.md)
- [x] T011 Register `options_ui` + built service worker path in `extension/manifest.json`; ensure build copies HTML to output

**Checkpoint**: Options save/load works; background returns `{ data, errors }` for a trivial `viewer { login }` query with PAT.

---

## Phase 3: User Story 1 — See FOC project on external-org issues and PRs (Priority: P1) 🎯 MVP

**Goal**: On configured cross-org repos, show whether the item is on the tracked board and display key field values (or clear not-linked state) for issues and PRs.

**Independent Test**: Open a `filecoin-project/curio` or `filecoin-project/filecoin-pin` issue/PR that is linked vs not linked to [orgs/FilOzone/projects/14](https://github.com/orgs/FilOzone/projects/14); panel reflects state without opening the board.

- [x] T012 [US1] Implement `extension/src/content/issue-sidebar.ts` entry: `init()` runs once per navigation, subscribes to GitHub `turbo:load` / `pjax:end` or `popstate` as needed for SPA navigation
- [x] T013 [US1] In `extension/src/content/issue-sidebar.ts`, gate injection when `owner/repo` ∈ loaded `cross_org_target_repos`; no-op otherwise
- [x] T014 [US1] Inject host element for the FOC panel adjacent to the layout sidebar (selector strategy documented in file comment); attach `extension/styles/sidebar.css`
- [x] T015 [US1] On panel mount, send message to background to run **R1** (resolve `projectId`) then **R2** + **R3** for current issue/PR; map errors to inline banner text per [contracts/github-graphql.md](./contracts/github-graphql.md)
- [x] T016 [US1] Render linked vs not-linked UI in `extension/src/content/issue-sidebar.ts` with project title URL(s) from config; show Status + other fields returned by R3 (graceful omit if field absent)
- [x] T017 [US1] If `github_api_token` missing, show configure CTA linking to `chrome.runtime.openOptionsPage` from `extension/src/content/issue-sidebar.ts`

**Checkpoint**: US1 dogfood passes scenarios 1–3 in [spec.md](./spec.md) for default repos/board.

---

## Phase 4: User Story 2 — Add cross-org issue or PR to the board (Priority: P2)

**Goal**: From the same panel, add the current issue/PR to the primary tracked project when not linked; surface permission errors.

**Independent Test**: From an unlinked cross-org issue, use **Add to FOC project**; item appears on board; insufficient scope shows a clear error.

- [x] T018 [US2] Add primary action button + loading state in `extension/src/content/issue-sidebar.ts` when R3 reports not linked
- [x] T019 [US2] Implement **R4** caller in `extension/src/background/service-worker.ts` using `addProjectV2ItemById` from `extension/src/lib/queries.ts`; refresh R3 after success
- [x] T020 [US2] Map GraphQL/auth failures for add to user-facing strings in `extension/src/content/issue-sidebar.ts` (per FR-004 / spec acceptance scenario 2)

**Checkpoint**: US2 acceptance scenarios in [spec.md](./spec.md) pass manually.

---

## Phase 5: User Story 3 — Update board fields from the item page (Priority: P3)

**Goal**: Edit at least one high-value field (e.g. Status single-select) from the panel; explain read-only / unsupported cases.

**Independent Test**: Change Status from the panel; board matches after refresh; read-only path shows explanation.

- [x] T021 [US3] Extend `extension/src/lib/queries.ts` + background fetch to load field **metadata** (single-select `ProjectV2Field` id + options) for the configured Status column name
- [x] T022 [US3] Add dropdown UI bound to **R5** in `extension/src/content/issue-sidebar.ts`; disable with reason when field or PR kind unsupported
- [x] T023 [US3] After update, re-query R3 or patch local state; show toast/inline confirmation on success

**Checkpoint**: US3 acceptance scenarios in [spec.md](./spec.md) pass manually.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T024 [P] Flesh out `extension/README.md` with load-unpacked steps, required PAT/OAuth scopes, and link to [quickstart.md](./quickstart.md)
- [x] T025 Refine `extension/styles/sidebar.css` for GitHub light theme spacing and focus states
- [x] T026 Add `docs/manual-verification.md` or PR template snippet listing smoke steps (manifest change, options token, three repos, add, field edit) for constitution IV checklist
- [x] T027 [P] Document OAuth placeholder / follow-up in `extension/README.md` if MVP ships PAT-only in options

---

## Implementation notes (post–tasks generation)

Shipped behavior **after** T001–T027 includes (not originally broken out as tasks):

- **REST** `GET .../orgs/{org}/projectsV2/{n}/items?q=...` for resolving the
  project item when GraphQL `projectItems` is incomplete, using row
  **`content_type`** matching.
- **No** expensive GraphQL full-board pagination as a fallback for “on board?”
  detection.
- **`ProjectV2.fields` discovery** (column names, `dataType`, single-select
  options, iteration samples) for options + sidebar + diagnostics.
- **Diagnostics** options page: streaming request log over `runtime.connect`.
- **`project-board-fields.ts`**: normalize field definitions for UI.

Follow-up UX (e.g. native sidebar parity) → track under a **new spec** / tasks
file when scoped.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 → 2 → 3** strictly sequential.
- **Phase 4** depends on Phase 3 (needs linked-state detection and panel).
- **Phase 5** depends on Phase 3 (needs item id + rendered panel); can follow Phase 4 or interleave after add works.
- **Phase 6** last.

### User story dependencies

- **US1**: After foundation only.
- **US2**: After US1 (uses same panel + content id).
- **US3**: After US1; **item id** required—logically after add path exists OR when item already linked.

### Parallel opportunities

- **T003** ∥ **T004** (after T001–T002).
- **T024** ∥ **T027** during polish.
- **T005** ∥ **T006** ∥ **T007** after Phase 1 if interfaces agreed (optional team parallel).

---

## Parallel Example: Foundation

```bash
# After T004, two devs can split:
Task: "T005 github-url.ts"
Task: "T006 project-config.ts"
# Then converge on T007–T011 in order.
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Complete Phases 1–2.
2. Complete Phase 3 (US1).
3. Stop and dogfood per **Independent Test** for US1.

### Incremental delivery

1. Add Phase 4 (US2) → dogfood add flow.
2. Add Phase 5 (US3) → dogfood field edit.
3. Phase 6 documentation and polish.

---

## Summary

| Metric | Value |
|--------|--------|
| **Total tasks** | 27 |
| **Phase 1** | 4 |
| **Phase 2** | 7 |
| **US1** | 6 (T012–T017) |
| **US2** | 3 (T018–T020) |
| **US3** | 3 (T021–T023) |
| **Polish** | 4 (T024–T027) |
| **Suggested MVP scope** | Complete through **T017** (US1) |
| **Format** | All tasks use `- [ ]`, sequential `Tnnn`, file paths in descriptions |

**Generated path**: `/Users/sal/Documents/Code/FilOz Projects/foc-gh/specs/001-cross-org-board-ui/tasks.md`
