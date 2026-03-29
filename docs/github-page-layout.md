# GitHub page layout: Issues vs Pull Requests

Reference for content script authors. Documents the DOM differences between GitHub **issue** pages and **pull request** pages that are relevant to this extension.

## Overview

GitHub issue and pull request pages share a sidebar layout but use **fundamentally different DOM structures** for the Projects gear picker. Content scripts that inject into the picker must handle each separately.

---

## Projects gear picker

### Issue picker — React/Primer SelectPanel

Triggered by clicking the gear icon next to **Projects** on an issue page.

**Container**:
```
<div role="dialog" class="prc-SelectPanel-Overlay-*">
  <div class="prc-SelectPanel-*">           ← header + filter input
    <input placeholder="Filter projects">   ← or aria-label*="Filter"
  </div>
  <div class*="FilteredActionList-Container">  ← scrollable list (SIBLING of header)
    <ul role="listbox">
      <li role="option">…</li>              ← existing project rows
    </ul>
    <!-- inject Global boards <section> here -->
  </div>
</div>
```

**Key points**:
- Detected via `document.querySelectorAll('[role="dialog"]')` with inner-text check for `Filter projects`, `Select projects`, or (`Projects` + `Recent` + `Repository`).
- The scrollable `FilteredActionList-Container` is a **sibling** of the header div, **not** an ancestor of the filter input. Walking `parentElement` from the input does not reach it — query the dialog directly: `dialog.querySelector('[class*="FilteredActionList-Container"]')`.
- Mount point: **append** the Global boards `<section>` as the last child of `FilteredActionList-Container`.
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
      </tab-container>
      <!-- inject Global boards <section> here, after tab-container -->
    </project-picker>
  </div>
</details-menu>
```

**Key points**:
- There is **no** `role="dialog"` — detection code that only looks for `[role="dialog"]` will **miss** the PR picker entirely.
- Detected by walking up from `input[placeholder*="Filter project"]` to find an ancestor `project-picker` element (`el.tagName.toLowerCase() === 'project-picker'`).
- Mount point: **insert after** the `<tab-container>` element inside `<project-picker>`.
- The tab-container uses GitHub's Catalyst `<tab-container>` custom element. Global boards should appear as a peer grouping beneath the tabs — not inside any tab panel — so it remains visible regardless of which tab is active.
- Interaction with Catalyst: clicking tabs triggers `mousedown` + `click` events. Global boards rows are independent and not affected by tab switches while the menu is open.

---

## Detection strategy

Both pickers contain `input[placeholder*="Filter project"]`. Use that as the anchor:

```typescript
function findPicker(): { el: HTMLElement; kind: 'issue' | 'pr' } | null {
  const input = document.querySelector<HTMLInputElement>(
    'input[placeholder="Filter projects"], input[placeholder*="Filter project"], input[aria-label*="Filter"]'
  )
  if (!input) return null

  // Walk up looking for project-picker (PR) or role="dialog" (issue)
  let el: HTMLElement | null = input.parentElement
  while (el && el !== document.body) {
    if (el.tagName.toLowerCase() === 'project-picker') return { el, kind: 'pr' }
    if (el.getAttribute('role') === 'dialog') return { el, kind: 'issue' }
    el = el.parentElement
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

The gear button's `aria-label` is `"Select projects"` on issues and `"Edit projects"` on PRs (observed; may vary by GitHub version).

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
