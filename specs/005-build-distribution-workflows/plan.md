# Implementation Plan: Build and distribution workflows

**Branch**: `005-build-distribution-workflows` | **Date**: 2026-03-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-build-distribution-workflows/spec.md`

## Summary

Deliver **documented** and **automated** paths so maintainers and contributors can (1) build an **unpacked** extension with a **stable extension ID** for shared dev OAuth, (2) build a **Chrome Web Store–safe ZIP** (no `manifest.key`), and (3) run the same steps in **GitHub Actions** with **channel-appropriate** `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` supplied from environment or repo secrets—never committed. The implementation extends existing `scripts/build.mjs`, `scripts/zip-dist.mjs`, docs, and adds a CI workflow; optional follow-up: explicit dual env var names per channel to reduce mix-ups.

## Technical Context

**Language/Version**: Node.js **24+** (align with repository convention / `AGENTS.md` if present; minimum **20** for `fs`/`glob` patterns in use)  
**Primary Dependencies**: **npm**, **esbuild**, **dotenv**, **archiver** (existing `package.json`); **GitHub Actions** for CI  
**Storage**: N/A (artifacts on disk: `extension/dist/`, `foc-gh-webstore.zip` gitignored)  
**Testing**: **`npm run typecheck`**, manual load of `extension/dist` and store ZIP validation; automated tests optional per constitution  
**Target Platform**: **Chromium** MV3 extension; **Chrome Web Store** ingestion rules  
**Project Type**: Browser extension + Node build/tooling scripts  
**Performance Goals**: CI completes in **under 15 minutes** for a typical shallow clone (per spec SC-003); local build in seconds  
**Constraints**: Store rejects **`key`** in uploaded `manifest.json`; OAuth secret embedded in **service-worker** bundle—release artifacts are sensitive  
**Scale/Scope**: Single repo, two distribution channels (local pinned vs store), one CI workflow MVP

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|--------|
| **Least privilege** | **Pass — N/A to feature** | No new `host_permissions`, content scripts, or OAuth **scopes**. This feature only changes **build**, **docs**, and **CI**. |
| **User credentials** | **Pass** | Builder OAuth app secrets via `.env.local` / GitHub **Secrets** only; end-user tokens unchanged (`chrome.storage`). No team user tokens baked into builds. |
| **API discipline** | **Pass — N/A** | No new GitHub API call paths. |
| **Verification** | **Pass** | PR checklist: run `npm run build`, confirm logged extension ID; run `npm run build:zip`, confirm zip manifest has no `key`; run workflow on fork or `act` optional. |
| **Incremental scope** | **Pass** | MVP: docs alignment + one workflow (build + optional typecheck); optional Phase 2: matrix jobs for dual-channel artifacts, publish workflow. |
| **UI fidelity (Principle VI)** | **Pass — N/A** | No `github.com` injection or options UI changes. |

**Complexity Tracking**: No constitution violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/005-build-distribution-workflows/
├── plan.md                 # This file
├── research.md             # Phase 0
├── data-model.md           # Phase 1
├── quickstart.md           # Phase 1
├── checklists/
│   └── requirements.md
└── contracts/
    └── build-channels.md   # Phase 1
```

### Source Code (repository root)

```text
extension/
├── manifest.json
├── manifest-id-public.b64  # stable local public key material
├── dist/                   # gitignored build output
├── icons/
└── src/

scripts/
├── build.mjs               # writes dist + manifest.key for local
├── zip-dist.mjs            # store zip without manifest.key
└── chrome-webstore.mjs     # optional publish/upload (existing)

docs/
├── github-oauth-app.md
└── ...

.github/
└── workflows/              # NEW: extension-ci.yml (or equivalent)

.env.example
README.md
extension/README.md
```

**Structure Decision**: Feature work lives in **`scripts/`**, **`.github/workflows/`**, and **`docs/`** / **`extension/README.md`** / root **`README.md`**; no new `extension/src` paths required for MVP.

## Phase 0: Research

**Output**: [research.md](./research.md) — all items resolved; no outstanding `NEEDS CLARIFICATION`.

**Summary**:

- Store upload **must not** include `manifest.key`; local **`extension/dist`** **should** include pinned key from committed `manifest-id-public.b64`.
- **Two GitHub OAuth apps** (or two callbacks if GitHub ever allows) when store extension ID ≠ local derived ID.
- CI should inject secrets as **environment variables** on the **build** step only; avoid `echo` / debug flags that leak values.

## Phase 1: Design and contracts

**Outputs**:

- [data-model.md](./data-model.md) — channel, artifact, credential binding.
- [contracts/build-channels.md](./contracts/build-channels.md) — env vars, npm scripts, artifacts.
- [quickstart.md](./quickstart.md) — contributor maintainer flows.
- Agent context updated via `.specify/scripts/bash/update-agent-context.sh cursor-agent`.

## Phase 2 (handoff)

**Not executed in `/speckit.plan`**: task breakdown in `tasks.md` via **`/speckit.tasks`**.

---

## Re-evaluation (post-design)

Constitution gates unchanged: still **Pass** / **N/A**; no new permissions or UI.
