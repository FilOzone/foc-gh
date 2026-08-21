# GitHub page layout: Issues vs Pull Requests

Reference for content script authors. Documents the DOM differences between GitHub **issue** pages and **pull request** pages that are relevant to this extension.

**Last verified against live github.com DOM**: 2026-08-19 (issue picker + PR picker, `filecoin-project/FIPs#1111` and `#1226`).

GitHub changes this DOM without notice (Primer component updates, React rewrites of legacy pickers). Re-verify this doc — reopen the gear picker on both an issue and a PR page and diff the actual DOM against what's documented below — whenever: a picker-detection or mount-point bug is reported, it's been **6+ months** since the date above, or GitHub ships a visible redesign of the Projects sidebar/picker. Update the date above after re-verifying, even if nothing changed.

## Terminology (canonical)

Use these terms in specs, docs, code comments, and commit messages. Avoid the older synonyms listed after each.

- **Projects section**: the native sidebar block titled "Projects" listing the boards an issue/PR belongs to. Issues: `[data-testid="sidebar-projects-section"]`. Legacy PRs: the `.discussion-sidebar-item` containing `form[aria-label="Select projects"]`. (Avoid: "Project panel", "Projects panel".)
- **Project card**: one board's entry inside the Projects section: a collapsed row (board title + Status control) plus an expandable field list. Native GitHub UI; the field list is lazily fetched by item id (`ProjectItemSectionFieldListQuery`).
- **Projects picker**: the popover for adding/removing the item to boards, opened from the Projects section's gear control ("Edit Projects" button on issues; gear `summary` on PRs). Issues: Primer SelectPanel; legacy PRs: `<project-picker>` element. (Avoid: "Projects gear widget", "gear menu", "gear picker".)
- **FOC field card**: the extension-rendered card (spec 002, `#filoz-foc-board-panel-host`). As of spec 008 it renders on legacy PR pages only; issue pages get full native parity via data injection. (Avoid: "custom FOC status", "FOC sidebar card" for the native card.)
- **Global board**: a Projects v2 board configured in extension options, typically in a different org than the viewed repo (canonically FilOzone FOC #14).

## Overview

GitHub issue and pull request pages share a sidebar layout but use **fundamentally different DOM structures** for the Projects picker. As of spec 008 the extension no longer injects UI into either picker; global boards reach the picker AND the Projects section through the data layer (next section). The DOM notes below remain for detection/debugging and for the FOC field card on legacy PR pages.

---

## Data layer (spec 008: native picker data injection)

Verified live 2026-08-19. Full details in [specs/008-native-picker-data-injection/research.md](../specs/008-native-picker-data-injection/research.md) and its contracts.

- **Issue picker feed**: `GET /_ghui/item-pickers/projects?owner=&repo=&queryId=` returns GraphQL-shaped JSON. `owner` is nested INSIDE `repository`; the picker renders `repository.projectsV2.nodes` (Repository group), `repository.owner.projectsV2.edges` (Organization) and `repository.owner.recentProjects.edges` (Recent). `repository.recentProjects` is parsed but never rendered.
- **Picker persistence**: results cache in React Query, persisted per user in IndexedDB `offline_cache_v2::<login>::queries` under `key-["item_picker","projects",{owner,query,repo}]`; first paint comes from the store, network refreshes it. The extension seeds this entry so injected rows show on the first open.
- **Issue membership**: server-side filters cross-org memberships out of ALL issue payloads (SSR island and `IssueViewerViewQuery`). The Relay connection `client:<issueId>:__ProjectSection_projectItems_connection(allowSameEnterprise:true)` is where membership edges live; the extension commits edges there (fiber-walk to the Relay environment via `react-app[app-name="issues-react"]`'s `reactRoot` container key, provider ~90 levels deep).
- **Node-by-id queries are NOT org-filtered**: `GET /_graphql` with `ProjectItemSectionFieldListQuery` (variables `{id: <PVTI item id>}`) returns the full cross-org field list AND the item's field values over session cookies. GitHub fires it itself when a project card is expanded, so an injected edge with a real item id gets a fully native expandable card. The extension also uses it to enrich the committed edge with the Status field def and value (collapsed-row parity). Native field editing fires `updateProjectItemFieldValueMutation`, which the server also accepts cross-org (verified live 2026-08-19).
- **Why the extension fetches Status itself**: the collapsed project-card row is fragment-backed (reads the store, never fetches); only the expanded field list is a self-fetching query. A refetch-and-augment approach (spec 007 style) cannot deliver the Status either, because `IssueViewerViewQuery` responses are server-filtered on every request. Full reasoning: specs/008-native-picker-data-injection/research.md, "Why the extension must source the collapsed Status itself". The persisted-query hash the extension needs for its one self-initiated call is hardcoded as a seed and refreshed by capture-and-cache whenever GitHub fires the query itself.
- **Issue mutations**: GitHub's own picker fires cookie-authenticated `updateIssueProjectsRelayMutation` (`addProjectV2ItemById` / delete variant) via `POST /_graphql`; the server ACCEPTS cross-org project ids, so native add/remove works once the row and membership edge are injected.
- **PR picker feed (legacy)**: `GET /<o>/<r>/projects/issues/projects_suggestions?scope=recent|repository|organization` returns `{projects:[{id:<numeric memex id>, name, owner, selected, search_slug}]}`.
- **PR toggle (legacy)**: closing the menu POSTs a multipart form to `/<o>/<r>/projects/issues/<n>` (`_method=put`) with one `issue_memex_project_ids[<id>]` field per LISTED project; the VALUE carries state (`on` = checked, empty = unchecked). The server silently ignores cross-org ids, so the extension strips its ids and performs the mutation via GraphQL.

---

## Projects gear picker

### Issue picker — React/Primer SelectPanel

Triggered by clicking the gear icon next to **Projects** on an issue page.

**Container**:
```
<div role="dialog" class="prc-SelectPanel-Overlay-*">
  <div class="prc-FilteredActionList-Root-*">      ← flex-direction:column wrapper
    <div class="prc-FilteredActionList-Header-*">   ← header + filter input
      <input placeholder="Filter projects">         ← or aria-label*="Filter"
    </div>
    <div class*="FilteredActionList-Container">     ← scrollable list, SIBLING of header
      <ul role="listbox">                            ← display:flex;flex-direction:row internally
        <li role="option">…</li>                    ← existing project rows
      </ul>
    </div>
    <!-- inject Global boards <section> here — AFTER FilteredActionList-Container,
         as a sibling within the flex-column Root, NOT inside the Container -->
  </div>
</div>
```

**Key points**:
- Detected via `document.querySelectorAll('[role="dialog"]')` with inner-text check for `Filter projects`, `Select projects`, or (`Projects` + `Recent` + `Repository`).
- The scrollable `FilteredActionList-Container` is a **sibling** of the header div, **not** an ancestor of the filter input. Walking `parentElement` from the input does not reach it — query the dialog directly: `dialog.querySelector('[class*="FilteredActionList-Container"]')`.
- **Mount point**: insert the Global boards `<section>` **after** `FilteredActionList-Container` (`container.insertAdjacentElement('afterend', section)`), landing it as a sibling inside the `FilteredActionList-Root` flex-column wrapper — **not** appended as a child *inside* the container. The container itself is `display:flex;flex-direction:row` (laying out its `<ul role="listbox">`); appending a plain block child inside it puts our section in that same row, squeezing it into a narrow column instead of stacking below the list. Verified live 2026-08-19: appending inside produced a ~90px-wide, 347px-tall broken panel wedged next to the list.
- Class names on the Primer components are **hashed** (e.g. `prc-SelectPanel-Overlay-abc123`) — use `class*=` attribute selectors or semantic roles/placeholders only (constitution VI).

---

### PR picker — legacy `<project-picker>` custom element

Triggered by clicking the gear icon next to **Projects** on a pull request page.

**Container**:
```
<details-menu>
  <div role="menu">
    <project-picker>
      <virtual-filter-input>
        <input placeholder="Filter projects">
      </virtual-filter-input>
      <tab-container>
        <nav role="tablist">
          <button role="tab">Recent</button>
          <button role="tab">Repository</button>
          <button role="tab">Organization</button>
        </nav>
        <div role="tabpanel">…</div>   ← Recent
        <div role="tabpanel">…</div>   ← Repository
        <div role="tabpanel">…</div>   ← Organization
        <div role="tabpanel" hidden>…</div>   ← Global boards (injected, 4th)
        <button role="tab">Global boards</button>  ← injected into the [role="tablist"] above, after Organization
      </tab-container>
    </project-picker>
  </div>
</details-menu>
```

**Key points**:
- There is **no** `role="dialog"` — detection code that only looks for `[role="dialog"]` will **miss** the PR picker entirely.
- Detected by walking up from `input[placeholder*="Filter project"]` to find an ancestor `project-picker` element (`el.tagName.toLowerCase() === 'project-picker'`).
- **The picker opens via an `open` attribute toggle on the ancestor `<details>`, not a DOM insertion** — `<project-picker>` and its `<tab-container>` are already present in the DOM (hidden) before the gear is clicked. A `MutationObserver` watching only `{childList: true, subtree: true}` will **never fire** when the picker opens — it must also watch `{attributes: true, attributeFilter: ['open', ...]}`. Verified live 2026-08-19: this was a real bug (childList-only observer silently never injected on PRs).
- **Global boards mounts as a real fourth tab** (superseded 2026-08-19, see spec.md Session 2026-08-19 — the original "peer section after `<tab-container>`" design was replaced after live review). GitHub's Catalyst `<tab-container>` pairs each `[role="tab"]` in the tablist with a `[role="tabpanel"]` purely by **DOM position** — append a tab `<button role="tab">` to the existing `[role="tablist"]` (after Organization) and a matching `<div role="tabpanel" hidden>` as the last tabpanel sibling; `<tab-container>`'s own built-in click handling then shows/hides it automatically, no manual event wiring required. Verified live 2026-08-19 by injecting a dummy tab+panel and clicking it — native behavior handled `aria-selected` and `hidden` correctly with zero extra JS.
- Mount point: **insert after** the `<tab-container>` element inside `<project-picker>`.
- The tab-container uses GitHub's Catalyst `<tab-container>` custom element. Global boards should appear as a peer grouping beneath the tabs — not inside any tab panel — so it remains visible regardless of which tab is active.
- Interaction with Catalyst: clicking tabs triggers `mousedown` + `click` events. Global boards rows are independent and not affected by tab switches while the menu is open.

---

## Detection strategy

Both pickers contain `input[placeholder*="Filter project"]`. Use that as the anchor — but **don't** use `querySelector` (singular) with a broad `aria-label*="Filter"` fallback: the issue/PR sidebar has other filter inputs too (e.g. a "Filter labels" input for the Labels picker) that also match, and can sit **earlier** in the DOM than the actual open project picker's input, so `querySelector` silently grabs the wrong one and detection fails with no error. Verified live 2026-08-19: this was a real bug (PR picker never injected because `querySelector` returned the Labels input). Check every candidate with `querySelectorAll` and return the first one that actually resolves to a picker ancestor:

```typescript
function findPicker(): { el: HTMLElement; kind: 'issue' | 'pr' } | null {
  const inputs = document.querySelectorAll<HTMLInputElement>(
    'input[placeholder="Filter projects"], input[placeholder*="Filter project"], input[aria-label*="Filter project"]'
  )
  for (const input of inputs) {
    // Walk up looking for project-picker (PR) or role="dialog" (issue)
    let el: HTMLElement | null = input.parentElement
    while (el && el !== document.body) {
      if (el.tagName.toLowerCase() === 'project-picker') return { el, kind: 'pr' }
      if (el.getAttribute('role') === 'dialog') return { el, kind: 'issue' }
      el = el.parentElement
    }
  }
  return null
}
```

---

## Sidebar structure

Both issue and PR pages use the same right-hand sidebar structure. The Projects section is inside:

```
<div data-testid="sidebar-projects-section">
  <section>
    <header>
      <h3>Projects</h3>
      <button aria-label="Select projects">⚙</button>   ← gear button
    </header>
    <!-- linked project cards / "None yet" -->
  </section>
</div>
```

The gear button has **no** `aria-label` on issues as of 2026-08-19 — its accessible name comes from inner text "Edit Projects" (visually a gear icon only). Extension code does not depend on this button's label; it's located by clicking the sidebar Projects section's only `<button>`, and the picker itself is then detected via the filter input (see "Detection strategy" below). May vary by GitHub version — re-verify if adding new automation that depends on this button specifically.

---

## Content script entry points

| Page type | Entry file | Handles |
|-----------|-----------|---------|
| Issues | `extension/src/content/issue-sidebar.ts` | Sidebar card + gear picker |
| PRs | (same `issue-sidebar.ts` via shared manifest match, or future `pr-sidebar.ts`) | Sidebar card + gear picker |
| Shared picker logic | `extension/src/content/global-boards-picker.ts` | Both picker types |

The manifest `content_scripts.matches` covers both `issues/*` and `pull/*` paths via `github.com/*`.

---

## References

- [research.md](../specs/006-outside-org-projects-picker/research.md) — Section 4 for picker DOM decisions
- [contracts/global-boards-picker-ui.md](../specs/006-outside-org-projects-picker/contracts/global-boards-picker-ui.md) — row layout contract
- [spec.md FR-010](../specs/006-outside-org-projects-picker/spec.md) — separate code paths requirement
