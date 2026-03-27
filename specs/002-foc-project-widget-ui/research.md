# Research: FOC Project Board sidebar presentation

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-03-27

## 1. Sidebar placement (Projects above Milestone)

**Decision**: Inject the widget **inside** GitHub’s Projects sidebar subtree—after
native project cards (or first native card container) and **before** the
Milestone block—using stable selectors with PR/issue fallbacks (see prior work on
`#pr-conversation-sidebar`, `form[aria-label="Select projects"]`, Milestone
`data-testid` or heading sibling).

**Rationale**: FR-001 requires semantic placement in **Projects**, not a floating
append. Appending below the whole sidebar fails multi-card and Milestone order.

**Alternatives considered**:

- **Append panel host only to sidebar root** — Rejected: cannot guarantee above
  Milestone or among project cards.
- **Shadow DOM** — Rejected: unnecessary complexity; styling goal is to *match*
  host, not isolate.

## 2. Visual parity and light/dark (Principle VI)

**Decision**: Prefer **GitHub-defined CSS variables** on `:root` / `html`
(`--fgColor-default`, `--fgColor-muted`, `--borderColor-default`,
`--bgColor-muted`, `--controlKnobColor-*`, etc.) and `color-scheme` implied by
`data-color-mode` / `data-light-theme` / `data-dark-theme`. Avoid hard-coded
hex fills for surfaces; use `Button`, `input`, and utility classes only if
duplicating GitHub’s markup is brittle—otherwise mirror **structure** (card,
row, pill) with **token-backed** properties.

**Rationale**: Host theme switches without extension reload; matches spec FR-003
and EXT-UI-001.

**Alternatives considered**:

- **Ship Primer CSS bundle** — Rejected for bundle size and version skew vs
  live GitHub.
- **Fixed dark-only theme** — Rejected by constitution.

## 3. Controls per field type

**Decision**: Map Projects v2 field types to controls:

| GitHub field kind (conceptual) | Control pattern |
|--------------------------------|-----------------|
| Status / single select | Summary + `details` or button triggering listbox; pill label + chevron |
| Text | Single-line `input type="text"` or `textarea` for long text (if field config indicates) |
| Number | `input type="number"` with validation |
| Iteration / date field | Same as select with iteration options from API |
| Unmapped / unsupported | Read-only text or “not editable in extension” subtitle |

**Rationale**: Aligns with FR-004 and user muscle memory.

**Alternatives considered**:

- **Native `<select>` only** — Acceptable fallback where pill UI is too costly
  for MVP; prefer pill for Status.

## 4. Autosave and debouncing

**Decision**: **On change** for selects (immediate mutation); **debounced blur or
idle** for text/number (e.g. 300 ms after last input, flush on `blur`).
**Optimistic UI** update on success path; **revert + message** on GraphQL error.
No Save/Cancel chrome (FR-005, FR-007).

**Rationale**: Matches GitHub inline edit behavior; avoids API storms on every
keystroke.

**Alternatives considered**:

- **Save-on-blur only with no debounce** — OK for MVP if debounce adds bugs;
  prefer debounce for long text.

## 5. Concurrent edits

**Decision**: **Last successful mutation wins** in the UI; if mutation returns
conflict or item version mismatch (if detectable), **refetch item field values**
and show a short inline notice (“Updated from GitHub” / “Couldn’t save—refreshed”).

**Rationale**: Spec edge case allows product choice; simplest aligns with GitHub’s
general model without operational transforms.

**Alternatives considered**:

- **Block editing until refresh** — Deferred; higher friction.

## 6. Expand/collapse

**Decision**: **Chevron** button in card header toggles visibility of custom field
rows (Status may stay visible when collapsed for scanability, or hide entire
body per visual reference—implement to match FilOzone screenshot: collapsed =
header + optional Status only, per [spec assumptions](./spec.md)). State held in
memory for the tab session; optional `chrome.storage.session` later.

**Rationale**: Matches FR-006 and assumption on session-only persistence.

## 7. API surface

**Decision**: Reuse existing **GraphQL** queries/mutations for project item by
`content` (issue/PR id), project field definitions, and
`updateProjectV2ItemFieldValue`. No new REST endpoints unless GraphQL gap
discovered during implementation—document gap in PR if so.

**Rationale**: Constitution III; existing extension path.

**Alternatives considered**:

- **REST Projects (classic)** — Out of scope; v2 board is target.
