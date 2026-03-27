# Research: Auto-expand project panels (003)

**Branch**: `003-auto-expand-panels`  
**Date**: 2026-03-27

## 1. Current behavior (baseline)

- **`extension/src/content/foc-project-card.ts`** implements expand/collapse for the
  **field body** (custom fields). The **Status** row stays visible in the header per
  spec 002.
- Initial expanded state comes from **`sessionStorage`** key `filoz-foc-card-expanded`:
  `'1'` → expanded, `'0'` → collapsed, **missing** → **expanded** (`true`).
- **`issue-sidebar.ts`** creates one **`createFocProjectCard`** per mounted host and
  loads panel state asynchronously; the card exists in **expanded** or **collapsed**
  state before network completes.

## 2. Native GitHub project rows

- GitHub’s own project sidebar entries use host-controlled markup (`<details>`,
  React internals). Expanding them via DOM would depend on **unstable** selectors
  and conflicts with Principle VI (no hashed class reliance).
- **Decision**: MVP applies auto-expand only to **extension-owned** panels (the
  FilOzone FOC card and any future extension cards using the same shell). Native
  rows stay untouched; feasibility revisited only if GitHub exposes a stable,
  supported hook (unlikely).

## 3. Preference storage and UX

- **Decision**: Add a **boolean** in **`chrome.storage.local`** alongside existing
  keys in `project-config.ts` / options page, e.g. `issue_pr_projects_auto_expand`.
- **Default `true`**: Preserves today’s effective behavior (missing session key →
  expanded) so existing users are not surprised.
- **Label** (options copy): Clear that it affects **issues and pull requests** and
  the **initial** state of the **project field section** (body), not Status (FR-006).

## 4. Session vs preference vs “visit”

- Spec edge cases require:
  - **Auto-expand on**: panels end **expanded** after async load (no stuck
    collapsed state because data arrived late).
  - **Manual collapse**: respected for the **current** issue/PR **session**.
- **Problem**: A single global `sessionStorage` key makes collapse **bleed** across
  consecutive issues in the same tab.
- **Decision**: Namespace the session key by **repository item** (e.g.
  `owner`, `name`, `number` from `pageContextFromLocation`) so each issue/PR gets
  an independent session overlay; **absent** key falls back to the **chrome
  storage** preference for initial paint.
- **Flow**:
  1. Compute `initialExpanded` from stored preference (default `true`).
  2. If `sessionStorage` has a value for **this** item key, it **wins** (user
     toggled chevron on this page).
  3. After `GET_PANEL_STATE` succeeds and body re-renders, if preference is **on**
     and session has **no** explicit override yet, call **`setExpanded(true)`** once
     so late fetch cannot leave the body collapsed by mistake.

## 5. Multiple configured boards

- Today **`issue-sidebar.ts`** mounts **one** primary FOC card
  (`crossOrgBoardUrls[0]`). The same preference applies to **all** extension cards
  if the codebase later renders more than one shell.

## 6. API / permissions

- **Decision**: **No** new GitHub routes, scopes, or `manifest.json` host entries.
  This is **UI + `chrome.storage.local`** only (EXT-001–003).

## Summary table

| Topic | Decision |
|-------|----------|
| Native GitHub rows | Out of scope for MVP (stability / Principle VI) |
| Storage | `chrome.storage.local` boolean; default `true` |
| Session | Per–issue/PR sessionStorage key; overrides pref when user toggles |
| After async load | If pref on and no session override, `setExpanded(true)` |
| APIs / manifest | No changes |
