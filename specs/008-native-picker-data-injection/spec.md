# Feature Specification: Native Picker Data Injection

**Feature Branch**: `008-native-picker-data-injection`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "Replace the custom global-boards picker UI on GitHub issue and PR pages with data-layer interception: augment GitHub's own picker data feeds so global boards (e.g. the FilOzone FOC board) appear and behave as native rows in GitHub's own Projects picker and sidebar, mirroring the interception pattern already used by the project-board OR filter."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add a cross-org item to a global board from the native picker (Priority: P1)

A team member opens an issue in a repo outside the global board's org (e.g. `filecoin-project/filecoin-pin`), opens GitHub's own Projects picker in the sidebar, and sees the configured global board (FOC) listed as a normal row alongside GitHub's own suggestions. Checking the row adds the issue to the board; the sidebar then shows the board membership using GitHub's own rendering, indistinguishable from a same-org project.

**Why this priority**: This is the core value of the feature and the reason for retiring the custom UI: one picker, one look, no drift from GitHub's design.

**Independent Test**: On canonical test issue `filecoin-project/filecoin-pin#56` (scenario 5, not a member), open the native picker, check the FOC row, confirm the item appears on the board and in the native sidebar, then uncheck to restore state.

**Acceptance Scenarios**:

1. **Given** an issue in a cross-org repo where the viewer has repo write access and board access, **When** the viewer opens the native Projects picker, **Then** the global board appears as a native row in the list.
2. **Given** the picker is open with the global board row visible, **When** the viewer checks the row and closes the picker, **Then** the item is added to the global board and the native sidebar Projects section shows the board with its Status field.
3. **Given** the viewer lacks access to the global board, **When** they open the picker, **Then** the global board row is absent or visibly non-actionable, and no failed mutation is triggered.

---

### User Story 2 - See existing global-board membership natively (Priority: P1)

A team member opens an issue or PR that is already on the global board. The native sidebar Projects section shows the board membership (GitHub hides cross-org memberships by default), and reopening the picker shows the row as checked, so unchecking removes the item.

**Why this priority**: Without correct membership display and checked state, the picker misleads users (an already-added item looks unadded, and "checking" it fires a redundant add instead of enabling removal).

**Independent Test**: On canonical test issue `ipld/frisbii#170` (scenario 4, member), verify the native sidebar shows FOC and the picker row is checked; unchecking removes the item (then re-add to restore state).

**Acceptance Scenarios**:

1. **Given** an item that is on the global board, **When** its page loads, **Then** the native sidebar Projects section lists the global board.
2. **Given** an item that is on the global board, **When** the viewer opens the picker, **Then** the global board row shows as checked.
3. **Given** a checked global board row, **When** the viewer unchecks it and closes the picker, **Then** the item is removed from the board and disappears from the sidebar section.

---

### User Story 3 - PR pages behave the same as issue pages (Priority: P2)

The same add/remove/membership behavior works on pull request pages, which currently use a different (older) GitHub UI, without the extension's current custom fourth tab.

**Why this priority**: PRs are half the workflow, but the PR-side legacy UI is being replaced by GitHub with the issue-style UI, so its custom handling is transitional.

**Independent Test**: On canonical PR `filecoin-project/filecoin-pin#1` (not a member), open the native PR Projects picker, verify FOC appears as a native row, toggle it on and off, and confirm board state changes each time.

**Acceptance Scenarios**:

1. **Given** a PR in a cross-org repo, **When** the viewer opens the native Projects picker, **Then** the global board appears as a native row with correct checked state.
2. **Given** the viewer toggles the global board row on a PR, **Then** the item is added to or removed from the board even though GitHub's own PR endpoint ignores cross-org projects, and the sidebar reflects the result.

---

### User Story 4 - Custom picker UI is retired (Priority: P2)

After this feature ships, the extension no longer renders its own "Global boards" section in the issue picker dialog or its own fourth tab in the PR picker; users interact only with GitHub-rendered rows. The FOC field card in the sidebar (Status/fields editing) is unchanged by this feature.

**Why this priority**: Removing the duplicated UI is the maintenance payoff, but it must land only after stories 1 to 3 prove equivalent behavior.

**Independent Test**: Walk canonical test URL scenarios 1 to 6 and confirm no extension-rendered picker elements appear while all add/remove/membership behavior still works.

**Acceptance Scenarios**:

1. **Given** any canonical test URL, **When** the picker opens, **Then** no extension-styled section, tab, or row is present in the picker.
2. **Given** the retirement, **When** comparing behavior to the previous release, **Then** every add/remove/membership scenario still passes.

---

### Edge Cases

- First picker open after install: GitHub caches picker data locally per user, so the injected row may be missing on the very first open until the cache refreshes; the feature must make the row appear no later than the second open, and should aim for the first.
- Viewer has repo write access but no access to the global board: the row must not appear as actionable, and a failed add must surface GitHub's own error handling rather than corrupt other rows.
- Viewer has board access but no repo write access: GitHub shows no picker at all on such pages; the feature does not create one (this narrows current behavior; see Assumptions).
- The item is on the board but the viewer's session cannot confirm membership quickly: the row must not flash a wrong checked state; unknown membership renders unchecked only after resolution, mirroring spec 006 rules.
- GitHub changes an internal endpoint or payload shape: the feature must fail open (native picker keeps working without the injected row) and log a console warning, never break the native picker.
- Same-org repos (scenario 1 and 2): GitHub already lists the board natively; the feature must not inject a duplicate row.
- Multiple configured global boards: each behaves independently; a failure adding to one board must not affect the others.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On issue pages, configured global boards MUST appear as native rows in GitHub's own Projects picker for repos outside the board's org, without any extension-rendered UI.
- **FR-002**: On issue pages, checking an injected row MUST result in the item being added to the board via GitHub's own add flow, including GitHub's own success and error presentation.
- **FR-003**: On issue and PR pages, existing global-board membership MUST be visible in GitHub's native sidebar Projects section, including after a full page reload.
- **FR-004**: On issue pages, the picker's checked state for injected rows MUST reflect actual membership, and unchecking MUST remove the item from the board.
- **FR-005**: On PR pages (legacy UI), configured global boards MUST appear as native picker rows with correct checked state, and toggling them MUST add or remove the item on the board even though GitHub's PR endpoint ignores cross-org projects; the extension performs the mutation itself in that case.
- **FR-006**: The feature MUST NOT inject a board row when the board already appears natively (same-org repos), and MUST NOT show actionable rows to viewers who cannot update the board.
- **FR-007**: All interception MUST fail open: if augmentation fails for any reason, GitHub's native picker and sidebar behave exactly as without the extension, with a console warning for diagnosis.
- **FR-008**: The existing custom picker UI (issue dialog section, PR fourth tab, and their styles) MUST be removed once FR-001 through FR-005 are verified on the canonical test URLs.
- **FR-009**: The FOC field card (spec 002) MUST continue to work on legacy PR pages, where GitHub cannot render cross-org boards natively. On issue pages it MUST NOT render (superseded by FR-011's native parity; added 2026-08-19 per user direction).
- **FR-010**: Membership resolution MUST NOT show a false checked or unchecked state while loading, consistent with spec 006 edge-case rules.
- **FR-011**: On issue pages, injected global boards MUST render with FULL native parity to same-org boards (added 2026-08-19: "not done until global boards render the same as repo/organization boards"): a project card in the Projects section with a collapsed Status row, an expandable native field list, and native field editing that persists to the board.

### Extension trust and data

- **EXT-001**: The feature reads GitHub page data feeds already delivered to the signed-in user's browser and augments them locally. Adds/removes on issue pages ride GitHub's own session-authenticated flow; on PR pages (and membership lookups) the extension uses the user's existing consented credential (PAT or OAuth token) exactly as today. No new scopes and no new host permissions are expected; any deviation must be called out in the plan.
- **EXT-002**: No page content is retained beyond what the extension already stores (board configuration, cached membership state). Any new local cache (e.g. membership per item) must be listed in the plan with its purpose and lifetime.
- **EXT-003**: No server-side storage of tokens; unchanged from current behavior.
- **EXT-UI-001**: The feature's entire purpose is native appearance: GitHub renders every row, checkbox, and sidebar entry, so light/dark alignment is inherited. Any residual extension-rendered element must follow existing shared patterns.

### Key Entities

- **Global board**: A Projects v2 board configured in extension options, usually in a different org than the repo being viewed (canonically FilOzone FOC board #14).
- **Picker feed**: The data GitHub's own picker consumes to render candidate project rows (issue and PR pages have different feeds).
- **Membership record**: The link between an issue/PR and a board (project item), including its identifier needed for removal.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of canonical test URL scenarios (docs/canonical-test-urls.md, scenarios 1 to 6, issue and PR variants) pass with the native picker only.
- **SC-002**: A user can add a cross-org item to a global board in the same number of clicks as adding a same-org project natively (open picker, check row, close).
- **SC-003**: The extension's issue/PR picker-specific UI code and styles are removed; net lines of custom picker UI code drop to zero (from roughly 440 lines of section/tab rendering plus associated CSS).
- **SC-004**: Zero regressions in the FOC field card and auto-expand behaviors on the canonical URLs.
- **SC-005**: Documented rough edges attributable to custom picker UI drift (tab pairing workarounds, dialog layout breakage, filter-input mismatches) are eliminated as a class; the DOM-selector surface needed by the picker feature shrinks to the interception points only.

## Assumptions

- Configured global boards may appear as plain rows (e.g. under Recent) without a special "global" label; per the user, this trade-off is accepted.
- Viewers without repo write access get no native picker from GitHub, so they cannot add items from such pages once the custom UI is retired. Today's custom UI injects into GitHub's picker dialog too, so this is not a regression relative to shipped behavior; users can still use the board directly.
- GitHub's internal feeds and flows used here are undocumented and may change; the OR filter feature (spec 007) already accepts this class of risk with fail-open behavior, and this feature follows the same discipline (Constitution Principle III is interpreted as: our own API calls use supported APIs; page-data augmentation rides GitHub's own calls).
- The PR-side legacy UI handling is transitional: GitHub is migrating PR pages to the issue-style UI, at which point the issue-side path covers PRs too.
- Proof-of-concept validation performed 2026-08-19 (see research.md): issue-side native render, cross-org native add, and native sidebar display are confirmed working; PR-side native render is confirmed and PR-side native mutation is confirmed NOT working cross-org (silently ignored), motivating FR-005.
