# Canonical test URLs (issue / PR / Project panel)

**Last updated:** 2026-03

Use these **fixed issue and pull request URLs** when manually checking **Project panel** and **FOC sidebar** behavior after code changes. They cover common combinations of:

- Whether the repo lives in the **FilOzone** org (same org as the global FOC Projects v2 board).
- Whether the issue/PR is a **member of the global FOC project** on that board.
- Whether the repo is listed under **Repos to proactively check for global project membership** in extension options.

A separate block below covers **auto-expand** of GitHub’s native **Projects** sidebar when the item is on **other** (non–global FOC) boards only.

Replace **TBD** PR links when you have stable pull requests for the FilOzone scenarios.

## Scenario matrix

| Scenario | FilOzone org | Member of global FOC project | Proactive-check repo | Issue URL | PR URL |
|----------|:------------:|:----------------------------:|:--------------------:|-----------|--------|
| [1 — FilOzone, not on board](#1-filozone-not-on-board) | Yes | No | n/a | [FilOzone/foc-gh#1](https://github.com/FilOzone/foc-gh/issues/1) | TBD |
| [2 — FilOzone, on board](#2-filozone-on-board) | Yes | Yes | n/a | [FilOzone/foc-gh#2](https://github.com/FilOzone/foc-gh/issues/2) | TBD |
| [3 — Cross-org, member, proactive repo](#3-cross-org-member-proactive-repo) | No | Yes | Yes | [filecoin-project/filecoin-pin#42](https://github.com/filecoin-project/filecoin-pin/issues/42) | [filecoin-project/filecoin-pin#371](https://github.com/filecoin-project/filecoin-pin/pull/371) |
| [4 — Cross-org, member, not proactive repo](#4-cross-org-member-not-proactive-repo) | No | Yes | No | [ipld/frisbii#170](https://github.com/ipld/frisbii/issues/170) | [filecoin-project/go-fil-commp-hashhash#31](https://github.com/filecoin-project/go-fil-commp-hashhash/pull/31) |
| [5 — Cross-org, not member, proactive repo](#5-cross-org-not-member-proactive-repo) | No | No | Yes | [filecoin-project/filecoin-pin#56](https://github.com/filecoin-project/filecoin-pin/issues/56) | [filecoin-project/filecoin-pin#1](https://github.com/filecoin-project/filecoin-pin/pull/1) |
| [6 — Cross-org, not member, not proactive repo](#6-cross-org-not-member-not-proactive-repo) | No | No | No | [filecoin-project/community#4](https://github.com/filecoin-project/community/issues/4) | [filecoin-project/community#2](https://github.com/filecoin-project/community/pull/2) |

## Expectations

### 1 — FilOzone, not on board

FOC GH **should not** modify **Project** panel rendering, because the repo is in the **same org** as the global FOC board (FilOzone).

### 2 — FilOzone, on board

FOC GH **should not** modify **Project** panel rendering for the same reason as scenario 1. The **FOC project should still appear** via normal GitHub UI for items that are on the board.

### 3 — Cross-org, member, proactive repo

FOC GH **should** add the **FOC project** to the **Project** panel (sidebar integration for the global board on cross-org items you care about).

### 4 — Cross-org, member, not proactive repo

FOC GH **should not** modify **Project** panel rendering, because the repo is **not** one you configure for proactive global-project membership checks.

### 5 — Cross-org, not member, proactive repo

FOC GH **should not** modify **Project** panel rendering, because the issue/PR is **not** on the global FOC project. The **inline** FOC program-board card MUST **not** appear and MUST **not** **flash** briefly while membership resolves (see [spec 002 FR-008](../specs/002-foc-project-widget-ui/spec.md) and [spec 006](../specs/006-outside-org-projects-picker/spec.md) Session 2026-03-27).

### 6 — Cross-org, not member, not proactive repo

FOC GH **should not** modify **Project** panel rendering: the item is **not** on the global FOC project **and** the repo is **not** in the proactive-check list.

## Auto-expand native Projects (non–global boards)

Use this when validating **Options → expand Project panel** (and related content in [`native-projects-expand`](../extension/src/content/native-projects-expand.ts)): GitHub’s own project rows should **auto-expand** on issue/PR pages **even when** the work item is **not** on a configured **Global** FOC board—e.g. it only appears on **repo** or **org** Projects v2 boards that are **not** the FilOzone program board.

| Kind | URL | Notes |
|------|-----|--------|
| Pull request | [filecoin-project/core-devs#192](https://github.com/filecoin-project/core-devs/pull/192) | Member of **non–global** project board(s); use with **auto-expand** enabled to confirm native rows expand without relying on global FOC membership. |
| Issue | [filecoin-project/filecoin-ffi#530](https://github.com/filecoin-project/filecoin-ffi/issues/530) | Same intent on **issue** layout: item on a **non–global** project (e.g. org/repo board); confirms auto-expand on issue DOM. |

**Expectation**: With auto-expand on, native **Projects** sections **expand** as implemented for this feature ([spec 003](../specs/003-auto-expand-panels/spec.md)); the **inline FOC** card from scenarios 3–6 still follows global-board / target-repo rules and is unrelated to this check.

## Project Board OR Filter (spec 007)

Use these URLs when verifying the **OR query filter** on project board views ([spec 007](../specs/007-project-board-or-filter/spec.md)).

| View | URL | Notes |
|------|-----|-------|
| Current by Status | [FilOzone/projects/14/views/20](https://github.com/orgs/FilOzone/projects/14/views/20) | Grouped by Status, filtered by cycle. Primary test view. |
| All | [FilOzone/projects/14/views/2](https://github.com/orgs/FilOzone/projects/14/views/2) | Large item set (~360 items), exercises pagination. |
| Recently Updated | [FilOzone/projects/14/views/33](https://github.com/orgs/FilOzone/projects/14/views/33) | Different sort/filter configuration. |

### Test queries

| Query | Expected |
|-------|----------|
| `cycle:202605-2 biglep (-status:"🎉 Done") OR (-last-updated:1days)` | Merged results from both branches, no duplicates |
| `(-status:"🎉 Done") OR (-last-updated:1days)` | Two branches with no shared prefix |
| `cycle:202605-2 -status:"🎉 Done"` | Non-OR query — native pass-through, unchanged behavior |
| `((nested))` | Invalid OR — native pass-through, console warning |
| `(a) OR (b) trailing` | Invalid OR — native pass-through, console warning |
| `(a OR b)` | Invalid OR — native pass-through, console warning |

## Related docs

- [Global boards picker status](global-boards-picker-status.md) — picker vs sidebar scope.
- [spec 003 — Auto-expand project panels](../specs/003-auto-expand-panels/spec.md) — preference and native row expansion.
- [CONTRIBUTING.md](../CONTRIBUTING.md) — points here for pre-PR manual checks.
