# Implementation Plan: FOC Project Board sidebar presentation

**Branch**: `002-foc-project-widget-ui` | **Date**: 2026-03-27 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/002-foc-project-widget-ui/spec.md`

**Note**: This plan is produced by `/speckit.plan`. See `.specify/templates/plan-template.md` for workflow.

## Summary

Deliver the **FOC Project Board** as a **native-looking GitHub Projects card** inside
the right-hand **Projects** region—**above Milestone** when present—on supported
issue and pull request pages. Match FilOzone reference visuals: bordered card,
project icon + title, Status row, custom field rows with **GitHub-like**
controls (select/pill, text, number, iteration), **autosave** (no Save button),
and a **chevron** expand/collapse for the field body. Styling MUST follow host
**light/dark** (constitution Principle VI) via GitHub CSS variables / Primer
alignment, not a fixed custom theme.

Technical approach (see [research.md](./research.md)): **relocate** the injected
host from append-only sidebar roots to a dedicated slot **inside** the Projects
sidebar (before Milestone), **rebuild** the panel markup to mirror GitHub’s
project card patterns, map Projects v2 **field types** to controls, and route
edits through existing **GraphQL** `updateProjectV2ItemFieldValue`-style
mutations with debounced autosave, optimistic UI, and user-visible errors.

## Technical Context

**Language/Version**: TypeScript (ES modules), Node.js for build (align with repo; 20+ recommended)  
**Primary Dependencies**: Chromium Manifest V3, `chrome.*` APIs, GitHub GraphQL (Projects v2), `fetch`; esbuild (or repo’s existing bundler) for content/background bundles  
**Storage**: `chrome.storage.local` / `sync` for PAT and extension settings only; optional `sessionStorage` for expand/collapse if desired (spec assumes session default)  
**Testing**: Manual verification on real issue/PR URLs (light + dark); optional unit tests for field-mapping helpers if cheap  
**Target Platform**: Chromium browsers (Chrome/Edge) loading unpacked MV3 extension on `https://github.com/*`  
**Project Type**: Browser extension (content scripts + service worker messaging)  
**Performance Goals**: Panel interactive within ~500 ms of sidebar paint; autosave debounce ~250–400 ms after last keystroke for text fields; no blocking UI during network  
**Constraints**: No new broad host permissions without justification; must not scrape unrelated DOM; must respect rate limits (`403`/`429` messaging)  
**Scale/Scope**: Single FOC (and configured related) project card per item; coexist with native project cards; supported field types limited to MVP set in [data-model.md](./data-model.md) with graceful read-only fallback

## Constitution Check

*GATE: Passed before Phase 0; re-checked after Phase 1.*

| Gate | Status | Evidence |
|------|--------|----------|
| **Least privilege** | Pass | No new hosts planned: reuse `https://github.com/*` content scripts and existing GitHub API origin. If `manifest.json` changes, document in PR smoke checklist. |
| **User credentials** | Pass | PAT (or existing auth) remains user-initiated, stored in extension storage only; no new server token storage. |
| **API discipline** | Pass | Projects v2 GraphQL for field reads/updates; retry/backoff for rate limit; surfaced errors in-widget per [research.md](./research.md). |
| **Verification** | Pass | PR includes manual matrix: 3 URLs (incl. PR), light + dark, Status + two field types, expand/collapse; multi-project coexistence URL. |
| **Incremental scope** | Pass | MVP = placement + card chrome + Status + text + single select + number + iteration (if already in config); other types read-only or hidden with label. |
| **UI fidelity** | Pass | CSS uses document `data-color-mode` / GitHub variables (`--fgColor-*`, `--borderColor-*`, spacing tokens); verify FilOzone + filecoin-project pages in both themes. |

**Post-Phase 1 re-check**: Design artifacts ([data-model.md](./data-model.md), [contracts/](./contracts/)) introduce no new permission surface; UI contract reinforces Principle VI. No Complexity Tracking violations.

## Project Structure

### Documentation (this feature)

```text
specs/002-foc-project-widget-ui/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── sidebar-widget-ui.md
├── checklists/
│   └── requirements.md
└── spec.md
```

### Source Code (repository root)

```text
extension/
├── src/
│   ├── content/           # e.g. issue-sidebar.ts — mount, sync, DOM placement
│   ├── lib/               # GitHub URL parse, GraphQL client, field mapping, messages
│   └── styles/            # e.g. sidebar.css — token-aligned rules only
├── manifest.json          # MV3 manifest (may live at extension root)
dist/                      # build output (gitignored)
scripts/
└── build.mjs              # bundle content + copy assets (if present)

package.json
```

**Structure Decision**: Single MV3 extension under `extension/` with TypeScript
sources in `extension/src/`, built to `extension/dist/` for unpacked loading.
If the repository snapshot omits `src/` (only `dist/`), restore sources from
version control history or feature branch before implementation.

## Complexity Tracking

No constitution violations requiring justification. No rows.

---

## Phase 0 — Research

**Output**: [research.md](./research.md) (decisions on placement, styling,
autosave/concurrency, field types).

## Phase 1 — Design

**Output**:

- [data-model.md](./data-model.md) — entities, field types, presentation state.
- [contracts/sidebar-widget-ui.md](./contracts/sidebar-widget-ui.md) — UI/DOM
  contract and autosave behavior.
- [quickstart.md](./quickstart.md) — build, load unpacked, manual QA URLs.

**Agent context**: Updated via `.specify/scripts/bash/update-agent-context.sh cursor-agent`.
