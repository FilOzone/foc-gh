# Research: Global boards in Projects gear menu (rev 2)

## 1. Architecture: content script + service worker

**Decision**: **Content script** injects **Global boards** UI and listens for checkbox changes; **all** GitHub **GraphQL** runs in the **service worker** (existing `graphqlRequest` / `handleMessage` pattern).

**Rationale**: MV3 forbids cross-origin `api.github.com` from the page context; matches **ADD_TO_PROJECT** today.

**Alternatives**: Direct `fetch` from content script — **rejected**.

## 2. Membership resolution per board

**Decision**: For each configured board URL:

1. Parse **`{org, number}`** via [`parseOrgProjectUrl`](../../extension/src/lib/project-config.ts).
2. Resolve **`projectId`** (GraphQL `ProjectV2` node id) with existing **`QUERY_PROJECT_V2`**-style query (same as options / panel).
3. Resolve **issue/PR `contentId`** (node id) — reuse the same approach as [`getPanelState`](../../extension/src/background/service-worker.ts) / issue metadata (GraphQL on repository issue/PR).
4. Determine **membership** by reusing **findProjectItemViaRest** / GraphQL patterns already used to locate the item on a project for the FOC panel, scoped to **that** `projectId` (not only the “primary” board).

**Rationale**: Avoid inventing a second source of truth; constitution **API discipline** favors proven call paths.

**Alternatives**: Only check primary board — **rejected** (spec requires **per-row** state).

## 3. Add / remove mutations

**Decision**:

- **Add**: Existing **`addProjectV2ItemById`** — [`MUTATION_ADD_PROJECT_ITEM`](../../extension/src/lib/queries.ts), message type **`ADD_TO_PROJECT`**.
- **Remove**: Add **`deleteProjectV2Item`** GraphQL mutation with the **ProjectV2Item** node id returned from membership resolution (store `itemId` alongside checked state).

**Rationale**: GitHub documents `deleteProjectV2Item` for removing an item from a project.

**Alternatives**: REST-only delete — use only if GraphQL is blocked in testing; document fallback in PR.

## 4. DOM / layout (issue vs PR)

**Decision**: Issue and PR pickers are **fundamentally different** DOM structures requiring **separate detection and injection paths**. See [`docs/github-page-layout.md`](../../docs/github-page-layout.md) for full reference.

### Issue picker (React/Primer SelectPanel)

- Gear click opens **`<div role="dialog">`** with class matching `prc-SelectPanel-Overlay-*`.
- Contains a `<input placeholder="Filter projects">` (or `aria-label*="Filter"`).
- Scrollable content container: `<div class*="FilteredActionList-Container">` — **sibling** of the header, not an ancestor of the input.
- **Mount point**: append the Global boards `<section>` inside the `FilteredActionList-Container` div.
- Detection: `document.querySelectorAll('[role="dialog"]')` with text includes check for `Filter projects` / `Select projects` / (`Projects` + `Recent` + `Repository`).

### PR picker (legacy custom element)

- Gear click opens **`<project-picker>`** custom element inside a `<details-menu>` / `<div role="menu">`.
- Contains `<virtual-filter-input>` + **`<tab-container>`** with `<nav role="tablist">` showing **Recent**, **Repository**, **Organization** tabs and `<div role="tabpanel">` per tab.
- **No** `role="dialog"` — current `findProjectPickerDialog()` code **misses** this entirely.
- **Mount point**: insert the Global boards `<section>` **after** the `<tab-container>` element, inside `<project-picker>`.
- Detection: walk up from `input[placeholder*="Filter project"]` to find either `[role="dialog"]` (issue) or a `project-picker` element (PR).

### Shared logic

- Row rendering (`renderRow`) is shared between both paths.
- Service worker messages (`GET_GLOBAL_BOARDS_STATE`, `ADD_TO_PROJECT`, `DELETE_PROJECT_ITEM`) are shared.
- The `showGlobalBoardsSection` visibility check is applied identically before injecting in either picker.

**Rationale**: Constitution VI (no hashed classes); separation required by spec FR-010 and confirmed by live DOM inspection.

## 5. Checkbox loading and errors

**Decision**:

- Initial: **`indeterminate` disabled** or **disabled unchecked** until membership response returns (must not show **checked** falsely).
- On **add/remove** failure: **toast** or inline **subtext** on the row + revert checkbox to **last known good**.
- **Optimistic UI**: optional **defer** to tasks; default **wait for mutation response** to reduce drift.

**Rationale**: Matches spec edge cases (no silent success).

## 6. Messaging API surface

**Decision**: Introduce compact SW messages, e.g.:

- **`GET_GLOBAL_BOARDS_STATE`**: payload `{ owner, name, number, kind }` → returns `{ boards: Array<{ url, projectId, itemId | null, label }> }` or errors per row.
- **`DELETE_PROJECT_ITEM`**: payload `{ itemId: string }` → `{ ok, error? }`

(Exact names for `messages.ts` / `handleMessage` left to implementation; document in [contracts](./contracts/global-boards-picker-ui.md).)

**Rationale**: Keeps content script thin; enables parallel membership fetches in SW.

## 7. Options copy

**Decision**: Replace **cross-org** headings/helpers with **Global** per [FR-009](../spec.md); keep storage keys unless a chore renames them.

**Rationale**: Spec **SC-004**.
