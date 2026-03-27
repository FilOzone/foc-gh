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

## 2. Native GitHub project rows — Issue vs PR layout difference

GitHub renders the Projects sidebar section differently on issue pages vs PR pages.
This is an **architectural difference** that affects any code interacting with native
project panels and must be understood before touching `native-projects-expand.ts`.

### Issue pages (React-based layout)

- Selector: `[data-testid="sidebar-projects-section"]`
- Expand/collapse control: a `<button aria-expanded="false|true">` rendered by
  React (Primer `IconButton`, `data-variant="invisible"`, `data-size="small"`).
- **How to expand**: call `.click()` on `button[aria-expanded="false"]` inside the
  section. React updates `aria-expanded` asynchronously on the next render tick —
  do **not** read `aria-expanded` immediately after `.click()`.
- No `<details>` elements; no `collapsible-sidebar-widget` custom elements.

### PR pages (classic ViewComponent / Catalyst layout)

- Selector: `form[aria-label="Select projects"]` → `.closest(‘.discussion-sidebar-item’)`
- No `[data-testid="sidebar-projects-section"]` exists on PR pages.
- Expand/collapse control: `<collapsible-sidebar-widget>` custom element
  (GitHub Catalyst component), with:
  - `isOpen` boolean property
  - `setOpen()` / `setClose()` methods callable directly on the element
  - `data-action="mousedown:collapsible-sidebar-widget#onMouseDown"` on the
    trigger button — responds to `mousedown`, **not** `click`
- **How to expand**: query `collapsible-sidebar-widget` elements, check `!w.isOpen`,
  call `w.setOpen()` directly. This is more reliable than simulating events.
- **Upgrade timing gotcha**: the `<collapsible-sidebar-widget>` tag is present in the
  initial HTML, but the Catalyst JS class is registered lazily (async bundle). At
  `document_idle`, `setOpen` may not yet be a function — calling it throws
  `TypeError: w.setOpen is not a function`.
- **`customElements` is unavailable in content scripts**: MV3 content scripts run in
  an isolated world where `customElements` is `null`. `customElements.whenDefined()`
  cannot be used.
- **Fix**: guard with `typeof w.setOpen === 'function'` and poll with `setTimeout`
  (100ms intervals, up to 20 retries = 2s) until the class is registered.
- No `<details>` elements; no `button[aria-expanded]`.

### What does NOT work on either layout

- `querySelectorAll(‘details’)` + `.open = true` — GitHub removed `<details>`-based
  project panels; this silently does nothing.
- `.click()` on the PR `+N more` button — the button uses `mousedown` event
  delegation via Catalyst; plain `.click()` dispatches a `click` event that the
  controller does not listen for.
- Hashed CSS class selectors — violates constitution Principle VI and breaks on
  any GitHub frontend deploy.

### Stable selectors in use (constitution-compliant)

| Layout | Root selector | Expand mechanism |
|--------|--------------|-----------------|
| Issue  | `[data-testid="sidebar-projects-section"]` | `button[aria-expanded="false"].click()` |
| PR     | `form[aria-label="Select projects"]` → `.discussion-sidebar-item` | `collapsible-sidebar-widget.setOpen()` |

### Implementation note

`native-projects-expand.ts` handles both cases in a single `expandAll(root)` call:
it runs the button-click path (no-op on PR pages, which have no such buttons) and
the widget `setOpen` path (no-op on issue pages, which have no such elements) so
no per-layout branching is needed in the caller.

## 3. Preference storage and UX

- **Decision**: Add a **boolean** in **`chrome.storage.local`** alongside existing
  keys in `project-config.ts` / options page, e.g. `issue_pr_projects_auto_expand`.
- **Default `true`**: Preserves today’s effective behavior (missing session key →
  expanded) so existing users are not surprised.
- **Label** (options copy): Clear that it affects **issues and pull requests** and
  the **initial** state of the **project field section** (body), not Status (FR-006).

## 4. Session vs preference — decision

- **Decision**: The global chrome.storage preference **always wins**. No per-item
  session state is stored or consulted.
- If auto-expand is **on**, the FOC card always loads expanded, regardless of
  whether the user collapsed it previously.
- If auto-expand is **off**, the card always loads collapsed.
- **Rationale**: Simpler mental model for the user (“this setting controls expansion,
  full stop”). Per-item memory can be added as an explicit future feature if
  requested — it should not be the default.

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
| Native GitHub rows (issues) | `button[aria-expanded="false"].click()` inside `[data-testid="sidebar-projects-section"]` |
| Native GitHub rows (PRs) | `collapsible-sidebar-widget.setOpen()` inside `.discussion-sidebar-item` |
| Extension FOC card | `initialExpanded` from chrome.storage preference; global setting always wins |
| Storage | `chrome.storage.local` boolean `issue_pr_projects_auto_expand`; default `true` |
| Session state | None — global setting always wins, no per-item memory |
| APIs / manifest | No changes |
