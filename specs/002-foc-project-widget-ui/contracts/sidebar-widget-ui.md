# Contract: FOC sidebar widget (UI + behavior)

**Feature**: [spec.md](../spec.md)  
**Date**: 2026-03-27  
**Consumers**: Content script that mounts into GitHub Projects sidebar.

## DOM placement contract

1. The widget root MUST be a descendant of GitHub’s **Projects** sidebar region
   (the same landmark subtree that contains native project cards).
2. When a **Milestone** section exists in that sidebar, the widget MUST appear
   **before** Milestone in document order.
3. When native project cards exist, the widget MUST NOT remove or obscure them;
   default order: **after** native project card list, **before** Milestone,
   unless product configuration specifies insertion after a specific card (YAGNI:
   implement “after last native project card” first).

## Visual contract

1. **Card**: Rounded rectangle, 1px border using `--borderColor-default` (or
   equivalent muted token), background using default canvas/muted pattern
   consistent with adjacent project cards.
2. **Header row**: Projects grid icon + **title** (config string) + **chevron**
   button (`aria-expanded` reflects state).
3. **Status row**: Label “Status” + pill/dropdown mirroring host status controls.
4. **Field rows**: Two columns—muted label left, control or read-only value
   right; vertical rhythm matches native sidebar density.
5. **No** primary Save, Submit, or Cancel for per-field edits.

## Theming contract

1. All semantic colors MUST resolve from GitHub CSS variables or inherited
   foreground/background so **light** and **dark** modes remain legible.
2. Focus rings MUST be visible in both themes (`:focus-visible`).

## Autosave contract

1. **Select/status**: Persist on selection change (single user gesture).
2. **Text/number**: Persist after debounced idle and on `blur`.
3. On failure: show non-blocking error adjacent to field or card footer; do not
   claim success; offer implicit retry on next edit or manual refresh note.
4. Optimistic updates allowed; MUST reconcile on error response.

## Accessibility contract

1. Chevron MUST be a `button` with `aria-expanded` and an accessible name
   (e.g. “Expand FOC project fields”).
2. Interactive controls MUST be focusable and labeled (visible label association
   or `aria-labelledby`).

## Messaging contract (extension internal)

Background/service worker and content script boundaries remain unchanged unless
this feature adds new message types. Any new opcode MUST include:

- `type`: string
- `payload`: serializable JSON
- Error envelope: `{ code, message }` user-safe string

(Exact types defined in implementation; this contract asserts discoverability for
review.)
