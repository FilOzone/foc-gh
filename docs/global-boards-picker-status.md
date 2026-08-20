# Global boards on issue and PR pages — status

**Last updated:** 2026-08-20

## Support matrix: native vs extension-rendered

Terminology per [github-page-layout.md](github-page-layout.md#terminology-canonical). "Native" means GitHub renders it from data the extension injects; "FOC field card" is the extension-rendered card (spec 002).

| Surface | Issue pages (React UI) | Legacy PR pages |
|---------|------------------------|-----------------|
| Projects picker row for global boards | Native (item-pickers feed augmentation) | Native (projects_suggestions augmentation) |
| Add / remove via picker | Native GitHub mutation, session cookies | Extension GraphQL (PAT/OAuth); GitHub's endpoint ignores cross-org ids |
| Membership in the Projects section | Native project card (Relay edge commit) | Not possible natively; FOC field card renders instead |
| Collapsed Status row | Native (edge enriched via ProjectItemSectionFieldListQuery) | FOC field card |
| Expanded field list | Native (GitHub lazily fetches it by item id) | FOC field card |
| Field editing | Native GitHub mutation, session cookies | FOC field card via extension GraphQL |
| Picker checked state | Native (derived from the committed Relay edge) | Extension-computed `selected` in the injected row |

## Current behavior (spec 008: native picker data injection)

Configured global boards now appear as **native rows inside GitHub's own Projects picker** on issue and pull request pages for repos outside the board's org. There is no extension-rendered picker UI anymore; the extension augments GitHub's picker data feeds instead (see [specs/008-native-picker-data-injection/](../specs/008-native-picker-data-injection/) and the data-layer section of [github-page-layout.md](github-page-layout.md)).

- **Issue pages**: the board shows in the picker's Recent group; checking/unchecking uses GitHub's own session-authenticated add/remove (verified working cross-org). Existing membership shows in the native sidebar Projects section and as a checked picker row, injected into the page's Relay store from the extension's membership resolution.
- **PR pages (legacy UI)**: the board shows as a native picker row with correct checked state; because GitHub's legacy endpoint silently ignores cross-org project ids, the extension intercepts the toggle and performs add/remove via its existing GraphQL path (PAT/OAuth).
- **Membership resolution cost**: resolved at page load on proactive target repos; deferred to first picker open elsewhere.
- Boards appear as plain rows (no "global" label) by design.

## Full native parity on issue pages (2026-08-19)

The injected project card in the Projects section is indistinguishable from a same-org board: collapsed Status row (the extension enriches the Relay edge with the Status value/field via GitHub's own `ProjectItemSectionFieldListQuery`, which is served cross-org), an expandable field list that GitHub fetches and renders itself, and native field editing (`updateProjectItemFieldValueMutation`, accepted cross-org). The FOC field card no longer renders on issue pages; it remains on legacy PR pages only.

## Open issues and known risks

Behavioral gaps (by design or pending):

- **No picker without repo write access**: GitHub renders no picker for read-only viewers, so there is no add/remove entry point on such pages (e.g. ipld repos). Matches previously shipped behavior; membership display on issues still works when the repo is proactive.
- **Lazy membership on non-proactive repos**: existing membership (checked state, native project card) becomes visible only after the picker is first opened, because the REST membership scan is deferred to keep API cost at the old picker's profile. Proactive target repos resolve at page load.
- **Legacy PR Projects section cannot show cross-org boards**: the section is a server-rendered partial; the FOC field card fills the gap until GitHub's React PR experience replaces the legacy page (at which point the issue-page path applies and the card can be fully retired).
- **First picker open with a pre-existing stale cache**: GitHub paints the picker from its IndexedDB persister; the extension seeds that entry at page load, but a picker opened in the same instant as page load can still show the pre-seed list once.

Fragility risks (fail-open, but worth knowing):

- **Persisted-query hash rotation** (mitigated 2026-08-20 by capture-and-cache): Status enrichment calls `ProjectItemSectionFieldListQuery` with a hardcoded seed hash, but the injector also harvests the current hash from GitHub's own requests whenever any project card is expanded (any page, even dormant) and prefers the cached value. Only a rotation with no expansion observed yet degrades anything, and then only the collapsed Status row, with a console warning; expanding any project card once self-heals it. Same class of risk for the mutation names the injector observes (`updateIssueProjectsRelayMutation`), matched by name.
- **React/Relay internals**: Relay environment discovery walks React fiber internals (`react-app` reactRoot container key, provider ~90 levels deep) and the connection id format `__ProjectSection_projectItems_connection(allowSameEnterprise:true)`. A GitHub frontend rewrite breaks membership display (not the picker or mutations); symptom is the console warning "Relay environment not found".
- **Undocumented endpoints**: all intercepted feeds (item-pickers, projects_suggestions, the PR form) are GitHub internals and can change without notice; every path falls back to untouched native behavior with a `[FilOz:native-picker]` console warning.

## What else works

- Options: **Global board URLs** and **Repos to proactively check** govern visibility and resolution timing.

History: the previous custom-rendered picker section/tab (spec 006) was retired by spec 008.
