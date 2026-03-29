# Feature Specification: Global boards in Projects gear menu

**Feature Branch**: `006-outside-org-projects-picker`  
**Created**: 2026-03-27  
**Status**: Draft  
**Input**: User description: "On issues and PRs that are outside the configured cross-org board URLs (for example, outside FilOzone when the program board is https://github.com/orgs/FilOzone/projects/14), when the user opens the right-hand **Projects** settings gear menu, the dropdown should gain a new category **Outside Organization** beyond **Recent**, **Repository**, and **Organization**. In that section Add an entry **Cross-org board** that reaches the configured program board(s). Issue and pull request pages use different layouts, so behavior must be verified and supported on both."

## Clarifications

### Session 2026-03-27

- Q: What user-facing terminology should describe the program boards surfaced in the **Projects** gear menu, and should the **options** page match? → A: Use **Global** consistently: menu section **Global boards**; each actionable row’s visible label MUST include **Global** (default pattern **Global board** for one URL, or disambiguated **Global** labels when several URLs are configured). The extension **options** page MUST adopt the same **Global** vocabulary and retire user-facing **cross-org** / **outside organization** phrasing for those concepts.
- Q: For repos in **target repos** (`cross_org_target_repos`), when should the **inline** FOC / Global program-board card appear in the **Projects** sidebar (not the gear menu)? → A: Only **after** the extension confirms via the GitHub API (e.g. panel state / item lookup) that the issue/PR **is** a **project item** on the configured board. The extension MUST **not** show program-board **identity** chrome (title, project link, or full card shell that implies membership) **before** that confirmation, and MUST **not** **flash** that card for items that resolve as **non-members**. **Exception**: Missing or unusable API credentials MAY still use the card shell **only** for **actionable configuration** messaging (e.g. open **Options**), consistent with the FOC sidebar auth path.

### Session 2026-03-28

- Q: Beyond navigation, should **Global boards** rows reflect whether the issue/PR is on each Global board, and should checking add it? → A: Yes. Whenever the **Projects** gear menu is **open** (expanded), each **Global boards** row includes a **checkbox**: **checked** if the current issue/PR is **already on** that Global (program) board, **unchecked** if not. When the user **checks** an **unchecked** box, the extension **adds** the issue/PR to that board using the user’s consented GitHub credentials. **Unchecking** **removes** the item from that board (parity with GitHub’s native project rows), with clear errors if the API denies removal.

### Session 2026-03-29

- Q: Should the gear picker **Global boards** section only appear on repos in the configured target repos list? → A: No. The gear picker works on **all** issue/PR pages where [FR-006] applies (i.e. any repo not owned by the board org). "Target repos" (`cross_org_target_repos`) controls a separate concern: which repos get **automatic inline display** of global board cards on page load. The gear picker is a universal add/remove mechanism.
- Q: What should the label text be for each Global boards row? → A: Use the board’s **actual project title** (fetched from GitHub, e.g. "FOC"), not a synthetic format string like "Global board — FilOzone #14". The label is plain text only — no link element inside the dropdown row. Clicking the row means toggling board membership (via the checkbox), not navigating anywhere.
- Q: Should there be a separate navigation link inside each gear-picker row? → A: No. The row label is plain text. Keep it focused on the membership checkbox action. Links inside a picker dropdown break the native UX pattern.
- Q: Issue and PR pages differ — how should this be handled? → A: Issue and PR pages have **fundamentally different picker UIs** and require **separate code paths** (see [`docs/github-page-layout.md`](../../../docs/github-page-layout.md)). Issue gear opens a React/Primer `SelectPanel` (`role="dialog"`); PR gear opens a legacy `<project-picker>` custom element with `<tab-container>`. The Global boards section mounts differently in each. Share data-fetching and row-rendering logic; keep picker detection and DOM injection separate per page type.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Global board rows: membership checkbox, add/remove (Priority: P1)

As a TPM working an issue whose repository is **not** under the same GitHub
organization as the configured **Global** program board, I open the **Projects**
area gear menu. I see a **Global boards** section with one row per configured
board. Each row shows the board's actual name (e.g. "FOC") and a **checkbox**
that is **checked** when this issue is **already** on that board and **unchecked**
when it is **not**. I can **check** to **add** the issue to that board or
**uncheck** to **remove** it, without leaving the menu—subject to my token
permissions.

**Why this priority**: Matches native **Projects** picker expectations and the
user’s **add/remove via checkbox** request.

**Independent Test**: On a representative **issue** where FR-006’s visibility
rule applies, open the gear menu: verify **Global boards** appears, checkbox
matches known membership (compare to board in browser), **check** adds,
**uncheck** removes, and the **open board** action still works.

**Acceptance Scenarios**:

1. **Given** I am on a supported **issue** for a repo outside the board-owning
   org, **When** I open the **Projects** gear menu, **Then** I see **Global
   boards** with rows that include **Global** labels and a **checkbox** per
   board.
2. **Given** the issue is **on** a configured Global board, **When** the menu
   shows that row, **Then** its checkbox is **checked** (after any async
   resolution—see Edge Cases).
3. **Given** the issue is **not** on that board, **When** I **check** the box,
   **Then** the issue is **added** to that board and the checkbox settles
   **checked** (or shows a **clear error** if the API refused).
4. **Given** the issue **is** on the board, **When** I **uncheck** the box,
   **Then** the item is **removed** from that board or I see a **clear,
   actionable** error message.
5. **Given** I have **multiple** program board URLs, **When** I open the menu,
   **Then** each board has **independent** checkbox state and add/remove applies
   only to that board.

---

### User Story 2 - Same capability on pull requests (Priority: P1)

As the same user on a **pull request**, I get the same **Global boards** rows
(**Global** copy, **open board**, **checkbox** membership, **add on check**,
**remove on uncheck**) when the **Projects** gear menu is open. Layout may
differ (tabs vs scroll); behavior and **API semantics** match US1.

**Why this priority**: PRs are as common as issues for program tracking.

**Independent Test**: Repeat US1 on a representative **pull request**.

**Acceptance Scenarios**:

1. **Given** a supported **PR** outside the board-owning org, **When** I open
   the gear menu, **Then** **Global boards** rows with checkboxes appear
   consistent with US1.
2. **Given** tabbed PR layout, **When** I locate **Global boards**, **Then** it
   remains a **peer** grouping and interactions are not broken by tab switches
   while the menu stays open.

---

### User Story 3 - No redundant section when already “in-org” (Priority: P2)

When the issue or PR’s repository **is** under the same GitHub organization as
**all** configured program board URLs, I **do not** need a duplicate **Global
boards** block—the native **Organization** experience already surfaces those
boards.

**Why this priority**: Avoids clutter on in-org repos.

**Independent Test**: Open the gear on an in-org issue; confirm **no** **Global
boards** injection (see FR-006).

**Acceptance Scenarios**:

1. **Given** the repo owner matches the org in **every** configured board URL,
   **When** I open the gear menu, **Then** the extension **does not** add
   **Global boards**.

---

### Edge Cases

- **No program board URLs saved**: No **Global boards** block.
- **Malformed URLs**: Omit invalid rows; do not break the native menu.
- **Membership loading**: While board membership is **unknown**, the checkbox
  MUST **not** misrepresent state (e.g. **disabled** or **indeterminate** with
  no **checked** pretense until resolved).
- **API errors** (add/remove): User-visible, actionable message; checkbox SHOULD
  revert to last **known good** state—no silent success claim.
- **Rate limits / permissions**: Surface GitHub’s constraint; do not loop
  retries aggressively.
- **Concurrent changes** (native UI or another tab): Next menu open or explicit
  refresh path SHOULD re-sync membership (exact refresh strategy for **plan**;
  MVP: **re-open** menu shows updated state).
- **Multiple boards / partial success**: Failure on one board MUST NOT corrupt
  checkbox state on another row.
- **Menu re-render**: No duplicate **Global boards** sections; idempotent
  injection per open.
- **Extension disabled**: Native behavior only.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On **any** GitHub **issue** or **pull request** page, when the **Projects** sidebar **gear** control opens the project-selection menu, the extension MUST **augment** that menu with a section titled **Global boards** when the **visibility rule** in FR-006 applies. This is independent of the configured target repos list (which controls inline page-load display only).
- **FR-002**: Within **Global boards**, each configured program board MUST appear as a row whose **visible label is the board's actual project title** (fetched from GitHub, e.g. "FOC"). The label is **plain text** — no link element inside the row. Multiple boards must be distinguishable by their titles.
- **FR-003**: ~~Each row MUST provide a way to **open** the organization project page.~~ **Removed**: Navigation links inside picker rows break the native UX pattern. The row's only action is checkbox membership toggle.
- **FR-004**: Each row MUST include a **checkbox** representing whether the
  **current** issue/PR is **already a project item** on that **Global** board.
- **FR-005**: When the menu is shown, the extension MUST **resolve** membership
  state per board (for each configured URL) using **supported GitHub APIs** and
  the user’s **PAT or OAuth token**, and MUST set each checkbox **checked** iff
  the item **is** on that board.
- **FR-006**: **Visibility rule**: The **Global boards** section MUST appear
  only when the **current repository owner** is **not** the owner organization
  of **at least one** configured program board URL. If **all** configured
  boards belong to the **same** org as the repository, MUST NOT inject **Global
  boards** (US3).
- **FR-007**: When the user **checks** a box that was **unchecked** and the item
  was **not** on that board, the extension MUST **add** the current issue/PR to
  that project using **supported Projects v2** APIs; on success the checkbox
  MUST reflect **membership**.
- **FR-008**: When the user **unchecks** a box that was **checked**, the
  extension MUST **remove** the project item from that board (or the equivalent
  supported operation), unless the API returns a documented constraint—in which
  case the UI MUST show a **clear** error and restore prior state.
- **FR-009**: The extension **options** page MUST use **Global** terminology in
  user-visible copy for these boards and MUST **not** use legacy **cross-org**
  / **outside organization** phrasing for the same concepts (storage keys may
  stay as today).
- **FR-010**: The augmentation MUST support both **issue** and **pull request** menu layouts, which use **fundamentally different DOM structures** (see [`docs/github-page-layout.md`](../../../docs/github-page-layout.md)). Issue picker: React `SelectPanel` (`role="dialog"`), flat scrollable list. PR picker: `<project-picker>` custom element with `<tab-container>` tabs. **Separate code paths** are required for detection and injection; row rendering and service-worker messaging are shared.
- **FR-011**: Injected chrome MUST match **GitHub-native** hierarchy and **light
  / dark** legibility (Principle VI).
- **FR-012**: If no program board URLs are configured, MUST NOT render **Global
  boards**.

### Extension trust and data *(mandatory when delivery is a browser extension)*

- **EXT-001**: Reads **project membership** and performs **add/remove** via
  **GitHub GraphQL** (and REST only if required by supported APIs), using the
  same **user-consented** credentials and scopes as the rest of the extension.
  **No** new hosts; **no** cookie-as-bearer.
- **EXT-002**: No new persistent fields required for this feature beyond existing
  config; transient **membership** state may exist only for the open menu / page
  session.
- **EXT-003**: No server-side token storage by this project; unchanged.
- **EXT-UI-001**: Styling uses **GitHub design tokens** / variables; **no**
  reliance on unstable hashed class names for layout.

### Key Entities

- **Program board URL (Global board)**: Configured org project address.
- **Project item membership**: Whether the current issue/PR node is linked to
  that project (drives checkbox).
- **Repository owner**: For visibility (FR-006).
- **Projects gear menu**: Native surface being augmented.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On sample **issue** + **PR** where FR-006 applies, **100%** of runs
  show **Global boards** with **Global**-labeled rows and **correct** initial
  checkbox state vs GitHub truth within **10 seconds** of menu open (or shows
  loading/disabled until resolved).
- **SC-002**: **100%** of runs: **check** on non-member **adds**; **uncheck** on
  member **removes** (or shows explicit denial with recovered UI state).
- **SC-003**: On in-org controls (US3), **100%** of runs show **no** **Global
  boards** block.
- **SC-004**: **Options** page copy passes **Global** vocabulary audit (no
  user-visible **cross-org** / **outside organization** for these concepts).
- **SC-005**: **Qualitative**: TPMs report the picker **matches** mental model of
  native **Projects** rows for **Global** boards.

## Assumptions

- **Program boards** example: [FOC · FilOzone project 14](https://github.com/orgs/FilOzone/projects/14);
  TPMs refer to them as **Global boards** in UI.
- **Token scopes** already cover **project** read/write for **add/remove**; if
  not, the UI MUST surface permission errors (same discipline as the FOC
  sidebar).
- **Uncheck removes** is **in scope** for parity with GitHub’s native picker; if
  a platform edge case blocks removal, **FR-008** governs messaging and state
  recovery.
- **Mobile** layouts out of scope unless already covered by the extension.
