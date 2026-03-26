# Implementation Plan: Cross-org FOC project controls on GitHub

**Branch**: `001-cross-org-board-ui` | **Date**: 2026-03-26 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-cross-org-board-ui/spec.md`  
**Note**: Re-synced via `/speckit.plan`; `setup-plan.sh` resets the template—this body is the active plan.

## Summary

Deliver a **Chromium MV3 extension** that, on `github.com` **issue and pull request**
pages for **configured cross-org repositories** (defaults:
**`filecoin-project/curio`**, **`filecoin-project/filecoin-pin`**), shows whether
the work item is on the **configured FilOzone FOC board** (default
[orgs/FilOzone/projects/14](https://github.com/orgs/FilOzone/projects/14)), allows **add**
and **field updates** using the same outcomes as the native sidebar when the repo
lives in-org. **GitHub’s GraphQL Projects API** supplies read/write
(`addProjectV2ItemById`, field updates); the UI is an **injected panel** aligned
with the right sidebar—**not** embedded in GitHub’s React tree (unsupported).

**Research** ([research.md](./research.md)) covers prior art, **hardcoded vs generic
project** tradeoffs, **“hook into” native UI** reality, and
[**Refined GitHub**](https://github.com/refined-github/refined-github) fit: MVP
stays in this repo; upstream contribution only after a **generic**, accepted
issue—not a gating assumption.

## Technical Context

**Language/Version**: TypeScript (Node LTS for build tooling, exact version pinned in `package.json` when scaffolded)  
**Primary Dependencies**: Chromium MV3 toolchain (e.g. Vite or esbuild + webextension polyfills if needed), `fetch` to GitHub GraphQL  
**Storage**: `chrome.storage.local` for OAuth/PAT bearer token + `cross_org_board_urls` + `cross_org_target_repos` (see [data-model.md](./data-model.md); encrypted storage not provided by platform—document threat model in README)  
**Testing**: Manual flows per constitution; optional unit tests for GraphQL payload builders  
**Target Platform**: Chromium desktop (`github.com`, `api.github.com`)  
**Project Type**: browser-extension  
**Performance Goals**: Initial panel paint < 2s after page idle on typical TPM issue pages; avoid N+1 GraphQL where one round-trip suffices  
**Constraints**: MV3: network from **service worker**; content script for DOM only; no secrets in repo; API auth via **OAuth token or PAT**, not browser session cookie → `api.github.com` (see [research.md](./research.md)); respect GitHub rate limits  
**Scale/Scope**: Internal TPM team; default board [projects/14](https://github.com/orgs/FilOzone/projects/14); default repos **curio** and **filecoin-pin**

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status |
|------|--------|
| **Least privilege** | `host_permissions`: `https://github.com/*`, `https://api.github.com/*` (and OAuth callback host if used); content scripts only on issue/PR routes for repos in **`cross_org_target_repos`**. No other hosts. |
| **User credentials** | **OAuth access token** (preferred) or **PAT** stored in `chrome.storage.local`; user can disconnect/clear; README lists scopes. **Session cookies** are not used as `api.github.com` bearer tokens. |
| **API discipline** | GraphQL only for Projects v2; errors mapped to UI per [contracts/github-graphql.md](./contracts/github-graphql.md). |
| **Verification** | PR template: manual steps on sample `filecoin-project` issue + FilOzone board; manifest/options changes include smoke checklist. |
| **Incremental scope** | MVP = **configured board URL(s)** + **configured repo list** (built-in defaults in [data-model.md](./data-model.md)); “all `projectItems`” readout deferred—see [research.md](./research.md). |

**Post-design re-check**: Pass. No complexity-tracking violations required.

## Project Structure

### Documentation (this feature)

```text
specs/001-cross-org-board-ui/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── github-graphql.md
├── checklists/
│   └── requirements.md
└── spec.md
```

### Source Code (repository root)

Proposed layout (create during implementation):

```text
extension/
├── manifest.json
├── src/
│   ├── background/
│   │   └── graphql.ts          # POST helper, error mapping
│   ├── content/
│   │   └── issue-sidebar.tsx   # or .ts: mount panel, wire buttons
│   ├── options/
│   │   └── options.html + options.ts
│   └── lib/
│       ├── github-url.ts       # parse owner/repo/number/kind
│       ├── project-config.ts   # defaults + storage keys
│       └── queries.ts          # GraphQL strings / builders
├── styles/
│   └── sidebar.css             # match GitHub spacing where practical
└── README.md                   # install, scopes, security notes

tests/                           # optional later
└── unit/
    └── queries.test.ts
```

**Structure Decision**: Single `extension/` package for MV3. Build output is the
unpacked load directory. No backend service; aligns with EXT-003 in [spec.md](./spec.md).

## Complexity Tracking

> No unjustified constitution violations.

## Phase 0 — Research (complete)

Output: [research.md](./research.md) — resolves:

- Cross-org **Projects v2** mutations and query patterns
- **Injected panel** vs native React integration
- **Browser session vs OAuth/PAT** for `api.github.com`
- **Configured board URLs + target repos** (defaults)
- **Refined GitHub** contribution expectations vs standalone MVP

## Phase 1 — Design (complete)

| Artifact | Path |
|-----------|------|
| Data model | [data-model.md](./data-model.md) |
| GraphQL contract | [contracts/github-graphql.md](./contracts/github-graphql.md) |
| Quickstart | [quickstart.md](./quickstart.md) |

## Phase 2 — Tasks

Use `/speckit.tasks` to expand [spec.md](./spec.md) + this plan into `tasks.md`.

## Agent context

Run from repo root after merging this plan:

`./.specify/scripts/bash/update-agent-context.sh cursor-agent`

### Absolute paths (this workspace)

- **FEATURE_SPEC**: `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/specs/001-cross-org-board-ui/spec.md`
- **IMPL_PLAN**: `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/specs/001-cross-org-board-ui/plan.md`
- **SPECS_DIR**: `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/specs/001-cross-org-board-ui`
