# Implementation Plan: Global boards in Projects gear menu

**Branch**: `006-outside-org-projects-picker` | **Date**: 2026-03-28 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from [`specs/006-outside-org-projects-picker/spec.md`](./spec.md)

## Summary

Implement **[Global boards](./spec.md)** in the native **Projects** gear menu on **any** GitHub issue or pull request page: when the [visibility predicate](./data-model.md#visibility) holds, inject a **Global boards** section with one row per configured org project. Each row shows the board's **actual project title** (fetched via GraphQL, e.g. "FOC") as **plain text** — no navigation link — plus a **checkbox** bound to **Projects v2 membership**. **Checking** calls **`addProjectV2ItemById`** ([`ADD_TO_PROJECT`](../../extension/src/lib/messages.ts)); **unchecking** calls **`deleteProjectV2Item`**. Membership is resolved per board URL via REST+GraphQL patterns aligned with existing [`getPanelState`](../../extension/src/background/service-worker.ts).

**Two distinct picker UIs** require separate detection + injection code paths (shared service-worker messages and row rendering):
- **Issue picker**: React/Primer `SelectPanel` — `<div role="dialog">` — flat scrollable `FilteredActionList`. Mount Global boards section inside the scrollable container.
- **PR picker**: legacy `<project-picker>` custom element inside `<div role="menu">` — `<tab-container>` with Recent/Repository/Organization tabs. Mount Global boards after `<tab-container>`.

The **gear picker runs on all pages** regardless of target repos. Target repos (`cross_org_target_repos`) control **inline page-load display** of global board cards only — a separate concern. For that inline card, **`issue-sidebar.ts`** MUST mount the FOC program-board widget **only after** panel state confirms a **non-null** project item (no transient program-board chrome for non-members; see [spec clarifications](./spec.md) Session 2026-03-27). **Options** copy adopts **Global** terminology ([FR-009](./spec.md)).

See [`docs/github-page-layout.md`](../../docs/github-page-layout.md) for full issue vs PR DOM reference.

## Technical Context

**Language/Version**: TypeScript, Node LTS for build ([`package.json`](../../package.json))  
**Primary Dependencies**: Chromium MV3, esbuild; GitHub GraphQL (`api.github.com`); existing [`queries.ts`](../../extension/src/lib/queries.ts) (`MUTATION_ADD_PROJECT_ITEM`, `QUERY_PROJECT_V2`, item discovery)  
**Storage**: `chrome.storage.local` — `cross_org_board_urls`, `cross_org_target_repos` (user-facing label **Global board URLs** in options)  
**Testing**: Manual per constitution IV + [quickstart.md](./quickstart.md); optional unit tests for visibility + URL parsing  
**Target Platform**: Chromium desktop, `github.com` issue/PR pages (gear picker runs on **all** pages; inline display limited to target repos)
**Project Type**: browser extension — content script (DOM) + service worker (GraphQL)  
**Performance Goals**: Membership for **N** boards completes within **10s** total per [SC-001](./spec.md); parallelize per-board queries where safe; avoid redundant full-board scans  
**Constraints**: Constitution VI — no hashed GitHub CSS modules; Primer **CSS variables**; **MV3** — GraphQL only from **service worker**  
**Scale/Scope**: Typically **1–5** board URLs; internal TPM use

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status |
|------|--------|
| **Least privilege** | **Pass.** Same `host_permissions` and content matches as today; **no** new OAuth scopes if **`project`** (read/write) already covers `addProjectV2ItemById` / `deleteProjectV2Item`. **Verify** in PR if GitHub introduces stricter requirements. |
| **User credentials** | **Pass.** PAT/OAuth via `resolveGithubBearer` + [`loadConfig`](../../extension/src/lib/project-config.ts); user disconnect path unchanged. |
| **API discipline** | **Pass (with work).** Reuse existing GraphQL transport and error mapping. **New** paths: batch/project-scoped **membership** resolution; **delete** mutation. Handle rate limit and permission errors with **user-visible** strings ([constitution III](../../.specify/memory/constitution.md)). **Idempotency**: add safe to retry when GitHub reports already exists if applicable. |
| **Verification** | **PR** includes manual **checklist**: issue + PR, **non-board-org** repo, checkbox true/false matches board; **check** adds, **uncheck** removes; **permission denied** path; **light/dark**; **options** **Global** copy (**SC-004**). |
| **Incremental scope** | **Pass.** MVP = inject UI + membership + add/remove + options strings. **Defer**: fancy project title fetch per row (use **Global board — {org} #{n}** heuristic). |
| **UI fidelity** | **Pass** when rows use **native-like** controls, **focus** rings, and **token**-based colors; checkbox **disabled/indeterminate** during load per spec edge cases. |

**Post-design re-check**: **Pass.** No Complexity Tracking table required.

## Project Structure

### Documentation (this feature)

```text
specs/006-outside-org-projects-picker/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── global-boards-picker-ui.md
├── checklists/
│   └── requirements.md
└── spec.md
```

### Source Code (repository root)

```text
extension/
├── src/
│   ├── background/
│   │   └── service-worker.ts     # GET_GLOBAL_BOARDS_MEMBERSHIP, ADD_TO_PROJECT (existing), DELETE_PROJECT_ITEM (new), GraphQL helpers
│   ├── content/
│   │   ├── issue-sidebar.ts      # init global-boards picker
│   │   └── global-boards-picker.ts   # dialog observe, inject rows, wire checkbox
│   ├── lib/
│   │   ├── messages.ts           # new message types
│   │   ├── queries.ts            # MUTATION_DELETE_PROJECT_ITEM, optional batch queries
│   │   └── project-config.ts     # shouldShowGlobalBoardsSection (exported helper)
│   └── options/
│       ├── options.html          # Global terminology
│       └── options.ts
```

**Structure Decision**: Extend **service worker** for all GitHub IO; **content script** stays DOM-only, messaging the SW for membership/mutations.

## Complexity Tracking

> No unjustified constitution violations.

## Phase 0 — Research (complete)

Output: [research.md](./research.md) — DOM anchoring, membership strategy, delete mutation, loading/error UX.

## Phase 1 — Design (complete)

| Artifact | Path |
|----------|------|
| Data model | [data-model.md](./data-model.md) |
| UI + message contracts | [contracts/global-boards-picker-ui.md](./contracts/global-boards-picker-ui.md) |
| Quickstart | [quickstart.md](./quickstart.md) |

## Phase 2 — Tasks

Use `/speckit.tasks` to expand [spec.md](./spec.md) + this plan into `tasks.md`.

## Agent context

From repo root:

```bash
./.specify/scripts/bash/update-agent-context.sh cursor-agent
```

### Absolute paths (this workspace)

- **FEATURE_SPEC**: `/Users/sal/Documents/Code/FilOz Projects/foc-gh/specs/006-outside-org-projects-picker/spec.md`
- **IMPL_PLAN**: `/Users/sal/Documents/Code/FilOz Projects/foc-gh/specs/006-outside-org-projects-picker/plan.md`
- **SPECS_DIR**: `/Users/sal/Documents/Code/FilOz Projects/foc-gh/specs/006-outside-org-projects-picker`
