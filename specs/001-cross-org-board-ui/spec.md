# Feature Specification: Cross-org FOC project controls on GitHub

**Feature Branch**: `001-cross-org-board-ui`  
**Created**: 2026-03-26  
**Status**: In progress (MVP shipped on branch; UX parity iterations may follow under a new spec)  
**Input**: User description: "Build a spec based on https://github.com/FilOzone/tpm-utils/issues/23"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See FOC project on external-org issues and PRs (Priority: P1)

When viewing a GitHub issue or pull request that belongs to a repository **outside**
the FilOzone organization (for example `filecoin-project/filecoin-pin` or
`filecoin-project/curio`), a team member sees the same kind of **project**
information they would expect on FilOzone-native work: whether the work item is
on the FOC program project, its current board status, and other project fields
that TPMs rely on (for example cycle, theme, and estimate when those are used on
the board).

**Why this priority**: Today those signals disappear on the right-hand side for
cross-org items; TPMs cannot tell from the issue page that the item is tracked
on the FOC board. Restoring visibility removes the “invisible membership”
problem and is the foundation for every other flow.

**Independent Test**: Open a cross-org issue or PR that is already linked to the
FOC program project and confirm the user can see project name, status, and key
fields without opening the board view separately.

**Acceptance Scenarios**:

1. **Given** an issue in a repository outside FilOzone that is **not** on the FOC
   project, **When** the user opens the issue in the standard GitHub web UI,
   **Then** they can see that it is not on the FOC project (clear “not linked” or
   equivalent state), consistent with how same-repo issues communicate absence
   of a project link.
2. **Given** an issue in a repository outside FilOzone that **is** on the FOC
   project, **When** the user opens the issue, **Then** they can see which FOC
   project it is on and the same core field values they would see if the issue
   lived in FilOzone (status at minimum; cycle, theme, estimate when applicable).
3. **Given** a pull request in a repository outside FilOzone, **When** the user
   opens the PR, **Then** the same visibility rules as for issues apply for FOC
   project membership and fields PRs can participate in.

---

### User Story 2 - Add a cross-org issue or PR to the FOC project from the item page (Priority: P2)

From the issue or PR page (still in the standard GitHub web UI for that
repository), a team member can **add** the work item to the FOC program project
without hunting for it on the organization project board first.

**Why this priority**: Adding items from the board is slow when the TPM is
already reading the issue; this matches the “same org as issue” expectation
described in the source request.

**Independent Test**: From a cross-org issue not yet on the FOC project, complete
“add to FOC project” from the item page and confirm the item appears on the board
with expected defaults.

**Acceptance Scenarios**:

1. **Given** a cross-org issue not linked to the FOC project, **When** the user
   chooses to add it to the FOC project from the item page, **Then** the item is
   linked to that project and becomes visible on the board within routine GitHub
   propagation time.
2. **Given** the user lacks permission to link that item to the project, **When**
   they try to add it, **Then** they see a clear, actionable message (for example
   that their GitHub role or token scope is insufficient), not a silent failure.

---

### User Story 3 - Update FOC board fields from the external-org item page (Priority: P3)

For a cross-org issue or PR that **is** on the FOC project, the user can change
board-managed fields the **implementation supports** (see below) from the item
page, toward the same outcomes as editing on the board when the repo is in-org.

**MVP scope**: The product **discovers** board columns via `ProjectV2.fields` and
allows **mutations** for **single-select** fields from the item page (every such
column may surface an editor). Other types (iteration “cycle”, number, text,
date, etc.) SHOULD be **visible** on the item when the API returns them in
`fieldValues`; editing those types is **not** required in this spec—add in a
later increment if needed.

**Why this priority**: Editing from the board alone is the pain called out for
busy TPMs; single-select edits cover high-frequency TPM columns (e.g. Status,
Prio) while keeping the mutation surface small and reliable.

**Independent Test**: On a linked cross-org issue, change at least one configured
field from the item page and confirm the board shows the same value without a
separate edit on the board.

**Acceptance Scenarios**:

1. **Given** a cross-org issue linked to the FOC project, **When** the user
   updates an allowed project field from the item page, **Then** the field value
   on the program board reflects that update.
2. **Given** a field is read-only for that user or unsupported for PRs, **When**
   the user attempts an edit, **Then** the UI explains why the change is not
   available instead of failing without explanation.

---

### Edge Cases

- Item exists in multiple GitHub projects; FOC controls MUST remain unambiguous
  (always clear which project is the FOC program project for these actions).
- No **API token** configured, or token missing scopes / revoked: surface a clear
  prompt to open extension options and fix credentials (this MVP does not use
  the browser GitHub session as an `api.github.com` bearer).
- GitHub returns permission, rate, or validation errors: show human-readable
  messages; do not claim success when the server rejected the change.
- Issue or PR page layout changes on GitHub: degradation SHOULD be graceful (for
  example a compact fallback panel rather than a broken page).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On `github.com` issue and pull request pages for repositories **not**
  hosted under the FilOzone organization, the solution MUST surface FOC program
  project membership and the same essential field visibility as agreed for
  Story 1.
- **FR-002**: Users MUST be able to add the current issue or pull request to the
  designated FOC program project from that page when their GitHub identity has
  sufficient access.
- **FR-003**: Users MUST be able to update FOC program project fields supported by
  the implementation from that page when the item is already linked and the user
  has access.
- **FR-004**: All add and update actions MUST provide clear success or failure
  feedback tied to what GitHub reports.
- **FR-005**: The solution MUST respect GitHub’s permission model: no bypass of
  org or project rules; behavior matches what the user could achieve via
  authorized GitHub surfaces.
- **FR-006**: Scope for the initial release is **web** access to `github.com` on
  desktop-class browsers used by the team; mobile web and non-GitHub hosts are
  out of scope unless explicitly added later.

### Extension trust and data *(mandatory when delivery is a browser extension)*

- **EXT-001**: The enhancement reads GitHub project and field data the signed-in
  user is allowed to see, and writes only project membership and field updates
  the user is allowed to perform, using **API credentials** they authorize (for
  example a **PAT** or an **OAuth access token** from a one-click “Connect
  GitHub” flow)—never a shared team secret embedded in the build. The extension
  does **not** assume it can reuse the browser’s GitHub cookie as a public API
  bearer token (see plan/research).
- **EXT-002**: Persist locally only what is needed to connect to GitHub on behalf
  of the user (for example tokens or session hints) and configuration such as
  which project is “FOC”; do not collect full page HTML, unrelated browsing
  history, or issue bodies beyond what is required to resolve the current item
  and show context.
- **EXT-003**: No server operated by this project stores user tokens for this
  feature unless a future spec and security review explicitly add that design.

### Key Entities

- **GitHub issue or pull request**: The page subject; identified by repository,
  number, and type (issue vs PR).
- **FOC program project**: The FilOzone-hosted GitHub Project that tracks FOC
  program work (the primary board TPMs mean when they say “the FOC board”).
- **Project item**: The row linking a given issue/PR to that project, carrying
  status and custom field values.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a sample set of cross-org issues already on the FOC project,
  **100%** show correct project membership and status from the issue page
  without opening the board (verified in team dogfood).
- **SC-002**: TPMs can add a newly triaged cross-org issue to the FOC project
  from the issue page in **under one minute** on average once familiar with the
  flow (timed task study with **N≥3** internal participants).
- **SC-003**: For items on the board, at least **one** high-frequency field used
  by TPMs (for example status or cycle) can be changed from the cross-org issue
  page and matches the board within **one refresh** in **95%** of trials during
  dogfood.
- **SC-004**: **Zero** undocumented transmissions of issue body text or
  unrelated site content to third-party services as part of this feature
  (verified by trust review against EXT requirements).

## Assumptions

- FilOzone members who need this already have GitHub accounts and permission to
  view or edit the FOC program project; the solution does not create those
  permissions.
- The canonical FOC program project is agreed by the team (name/number/url); the
  solution may ship with a sensible default and allow configuration for edge
  cases (for example testing against another org project).
- Primary delivery matches the [issue #23](https://github.com/FilOzone/tpm-utils/issues/23)
  expectation: a **user-installed enhancement** to the normal GitHub web
  experience (exact packaging is left to planning).
- “Parity with same-org behavior” means the **user outcomes** (see, add, edit on
  the item page), not pixel-perfect duplication of GitHub’s native sidebar if
  that is technically constrained for cross-org items.
- **Richer native-sidebar parity** (layout, controls, and editing affordances
  matching GitHub’s built-in Projects block on in-org repos) may be specified in
  a **separate feature spec** so this document stays bounded to cross-org
  visibility + add + supported edits.
