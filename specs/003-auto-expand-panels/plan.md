# Implementation Plan: Auto-expand project panels on issues and PRs

**Branch**: `003-auto-expand-panels` | **Date**: 2026-03-27 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/003-auto-expand-panels/spec.md`

**Note**: This plan is produced by `/speckit.plan`. See `.specify/templates/plan-template.md` for workflow.

## Summary

Add a **persisted user preference** (default **on**) so extension **FOC project
cards** on **issue** and **pull request** pages load with the **field body
expanded or collapsed** according to the setting. Apply the same rule for
**same-org** and **cross-org** boards because behavior is purely client-side.
After **async** panel data loads, **force expanded** when the preference is on
and the user has not overridden state for **that** issue/PR in the tab, so late
hydration never leaves the body stuck collapsed.

Technical approach (see [research.md](./research.md)): extend **`chrome.storage.local`**
and the **options** page; thread **`initialExpanded`** + a **per-item
`sessionStorage` key** into **`createFocProjectCard`**; call **`setExpanded(true)`**
after successful **`GET_PANEL_STATE`** when appropriate. **Do not** automate
native GitHub project rows in MVP (DOM instability / Principle VI).

## Technical Context

**Language/Version**: TypeScript (ES modules), Node for build (align with repo)  
**Primary Dependencies**: Chromium Manifest V3, `chrome.storage.local`, content scripts (`issue-sidebar.ts`, `foc-project-card.ts`), options page script  
**Storage**: `chrome.storage.local` for boolean preference; `sessionStorage` for per–issue/PR chevron overrides  
**Testing**: Manual verification on real issue/PR URLs (see [quickstart.md](./quickstart.md)); optional small unit test for session key helper if cheap  
**Target Platform**: Chromium browsers, `https://github.com/*`  
**Project Type**: Browser extension (MV3 content + options UI)  
**Performance Goals**: No extra network; preference read once per render; O(1) storage  
**Constraints**: No new `host_permissions`, PAT scopes, or GitHub API calls; Principle VI styling unchanged (body `hidden` only)  
**Scale/Scope**: One primary FOC card today; preference applies to all extension cards using the shared shell

## Constitution Check

*GATE: Passed before Phase 0 completed; re-checked after Phase 1.*

| Gate | Status | Evidence |
|------|--------|----------|
| **Least privilege** | Pass | No manifest host or scope changes; storage key only. |
| **User credentials** | Pass | No token path changes; PAT remains user-owned in existing storage. |
| **API discipline** | Pass | No new GraphQL/REST; panel fetch path unchanged. |
| **Verification** | Pass | PR lists manual matrix: pref on/off, issue + PR, same + cross org, per-item session, light + dark. |
| **Incremental scope** | Pass | MVP = one boolean + card/options wiring; native GitHub rows explicitly deferred in [research.md](./research.md). |
| **UI fidelity** | Pass | Expansion uses existing card chrome; no new colors; verify light/dark per [quickstart.md](./quickstart.md). |

**Post-Phase 1 re-check**: [data-model.md](./data-model.md) and [contracts/issue-pr-panel-expansion.md](./contracts/issue-pr-panel-expansion.md) introduce no new permission or API surface. No Complexity Tracking rows required.

## Project Structure

### Documentation (this feature)

```text
specs/003-auto-expand-panels/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md      # Phase 1
├── quickstart.md      # Phase 1
├── contracts/
│   └── issue-pr-panel-expansion.md
├── checklists/
│   └── requirements.md  # from /speckit.specify
└── spec.md
```

### Source Code (repository root)

```text
extension/
├── src/
│   ├── content/
│   │   ├── foc-project-card.ts   # initialExpanded + session key + post-load expand
│   │   └── issue-sidebar.ts      # pass context into card; setExpanded after GET_PANEL_STATE
│   ├── lib/
│   │   └── project-config.ts     # STORAGE_KEYS + loadConfig default true
│   └── options/
│       ├── options.html          # checkbox + hint
│       └── options.ts            # load/save preference
└── manifest.json
```

**Structure Decision**: Ship in existing `extension/src` tree; no new packages.

## Complexity Tracking

No constitution violations requiring justification. (Native GitHub automation explicitly **not** in MVP — simpler alternative **accepted** per [research.md](./research.md).)

---

## Phase 0 — Research

**Output**: [research.md](./research.md) — storage default, per-item session key,
native row deferral, post-load `setExpanded(true)` rule.

## Phase 1 — Design

**Output**:

- [data-model.md](./data-model.md) — preference entity, session overlay, card options.
- [contracts/issue-pr-panel-expansion.md](./contracts/issue-pr-panel-expansion.md) — options ↔ storage ↔ content behavior.
- [quickstart.md](./quickstart.md) — build, load unpacked, manual QA.

**Agent context**: Updated via `.specify/scripts/bash/update-agent-context.sh cursor-agent`.
