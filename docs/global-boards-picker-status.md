# Global boards in the Projects picker — status

**Last updated:** 2026-08-19

## Current behavior (spec 008: native picker data injection)

Configured global boards now appear as **native rows inside GitHub's own Projects picker** on issue and pull request pages for repos outside the board's org. There is no extension-rendered picker UI anymore; the extension augments GitHub's picker data feeds instead (see [specs/008-native-picker-data-injection/](../specs/008-native-picker-data-injection/) and the data-layer section of [github-page-layout.md](github-page-layout.md)).

- **Issue pages**: the board shows in the picker's Recent group; checking/unchecking uses GitHub's own session-authenticated add/remove (verified working cross-org). Existing membership shows in the native sidebar Projects section and as a checked picker row, injected into the page's Relay store from the extension's membership resolution.
- **PR pages (legacy UI)**: the board shows as a native picker row with correct checked state; because GitHub's legacy endpoint silently ignores cross-org project ids, the extension intercepts the toggle and performs add/remove via its existing GraphQL path (PAT/OAuth).
- **Membership resolution cost**: resolved at page load on proactive target repos; deferred to first picker open elsewhere.
- Boards appear as plain rows (no "global" label) by design.

## Full native parity on issue pages (2026-08-19)

The injected project card in the Projects section is indistinguishable from a same-org board: collapsed Status row (the extension enriches the Relay edge with the Status value/field via GitHub's own `ProjectItemSectionFieldListQuery`, which is served cross-org), an expandable field list that GitHub fetches and renders itself, and native field editing (`updateProjectItemFieldValueMutation`, accepted cross-org). The FOC field card no longer renders on issue pages; it remains on legacy PR pages only.

## Limitations

- Pages where the viewer lacks repo write access get no native picker from GitHub, so no add/remove entry point there (matches previously shipped behavior).
- On non-proactive repos, existing membership becomes visible only after the picker is first opened (lazy resolution).
- Legacy PR pages cannot render cross-org boards in the Projects section; the FOC field card covers membership display and field editing there until GitHub's React PR experience lands.

## What else works

- Options: **Global board URLs** and **Repos to proactively check** govern visibility and resolution timing.

History: the previous custom-rendered picker section/tab (spec 006) was retired by spec 008.
