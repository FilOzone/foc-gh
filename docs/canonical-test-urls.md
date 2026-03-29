# Canonical test URLs (issue / PR / Project panel)

**Last updated:** 2026-03

Use these **fixed issue and pull request URLs** when manually checking **Project panel** and **FOC sidebar** behavior after code changes. They cover common combinations of:

- Whether the repo lives in the **FilOzone** org (same org as the global FOC Projects v2 board).
- Whether the issue/PR is a **member of the global FOC project** on that board.
- Whether the repo is listed under **Repos to proactively check for global project membership** in extension options.

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

FOC GH **should not** modify **Project** panel rendering, because the issue/PR is **not** on the global FOC project.

### 6 — Cross-org, not member, not proactive repo

FOC GH **should not** modify **Project** panel rendering: the item is **not** on the global FOC project **and** the repo is **not** in the proactive-check list.

## Related docs

- [Global boards picker status](global-boards-picker-status.md) — picker vs sidebar scope.
- [CONTRIBUTING.md](../CONTRIBUTING.md) — points here for pre-PR manual checks.
