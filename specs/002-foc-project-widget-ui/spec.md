# Feature Specification: FOC Project Board sidebar presentation

**Feature Branch**: `002-foc-project-widget-ui`  
**Created**: 2026-03-27  
**Status**: Draft  
**Input**: User description: "It's time to make the righthand sidebar 'FOC Project' widget really look good," with placement in the native Projects section above Milestone, visual parity with the FilOzone **FOC** project card on issues/PRs, GitHub-aligned styling (light/dark), native-like controls per field type, autosave (no Save button), and expand/collapse chevron. Reference visuals: FilOzone FOC card and mockup for a `filecoin-project` PR that also shows FilOz + FOC cards.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recognizable FOC card in the right place (Priority: P1)

As a TPM or maintainer viewing an issue or pull request, I see the **FOC Project
Board** widget in the same **Projects** area I already use on GitHub, visually
consistent with native project cards, and **above** the **Milestone** block when
Milestone is present. I can **expand** or **collapse** the card body with a
chevron so the sidebar stays scannable.

**Why this priority**: Wrong placement or an alien-looking panel breaks trust
and slows board updates; this is the minimum bar for adoption.

**Independent Test**: Open an issue or PR that is linked to the FOC project;
confirm the widget sits inside the Projects section, above Milestone, matches
the reference card structure (header with project identity, optional status row,
field rows), and chevron toggles visibility of the detailed fields without
losing data.

**Acceptance Scenarios**:

1. **Given** an issue or PR page where the extension injects the FOC board and
   GitHub shows a Milestone section, **When** I view the right sidebar, **Then**
   the FOC widget appears inside **Projects** and **above** Milestone.
2. **Given** the FOC widget is visible, **When** I use the expand/collapse
   control, **Then** the field list hides or shows and the control reflects the
   current state (collapsed vs expanded).
3. **Given** GitHub **dark** or **light** appearance, **When** I view the
   widget, **Then** borders, text contrast, and control-looking surfaces read as
   native to the page (no single-theme-only styling for the shipped experience).

---

### User Story 2 - Field editing like GitHub, without an explicit Save (Priority: P2)

As the same user, I edit **Status** and **custom project fields** using
**control patterns that match what I expect from GitHub Projects** (for example
choice fields behave like dropdowns or pills, free text like inputs, numbers
like numeric entry, iterations/cycles like GitHub’s iteration-style affordance).
Changes **persist automatically** as I commit each edit—there is **no** Save or
Submit button for routine field updates.

**Why this priority**: Autosave and familiar controls reduce errors and match
muscle memory from native Projects.

**Independent Test**: For each supported field type on the FOC project,
change a value and refresh or reopen the page (or rely on GitHub’s own refresh
patterns); values match. Observe no primary Save action; optional subtle saving
or error feedback is acceptable if consistent with host behavior.

**Acceptance Scenarios**:

1. **Given** a single-select project field, **When** I choose a new option,
   **Then** the selection updates immediately and is stored without pressing
   Save.
2. **Given** a text or number field, **When** I finish editing (e.g. blur or
   equivalent), **Then** the value persists without a Save button.
3. **Given** an unsupported or read-only field type for this slice, **When** I
   view the widget, **Then** the UI does not pretend the field is editable, or
   it shows a clear read-only state (see edge cases).

---

### User Story 3 - Coexistence with other project cards (Priority: P3)

As a user on a repository that uses **multiple** GitHub Projects (for example a
repo-level card plus **FOC**), I still see **native** project entries and the
**extension** FOC card **together** in the Projects section, with ordering that
matches product rules (FOC board positioned per configuration / UX consistency)
without hiding required native information.

**Why this priority**: Real pages (e.g. cross-org PRs) combine several
projects; the FOC injection must not break or obscure the normal GitHub list.

**Independent Test**: Open a PR linked to both a default org/repo project and
FOC; confirm both appear, layout is orderly, and Milestone order requirement from
US1 still holds.

**Acceptance Scenarios**:

1. **Given** GitHub lists at least one native project card and the FOC widget,
   **When** I view Projects, **Then** all relevant cards remain visible and the
   FOC widget remains in the Projects section above Milestone.
2. **Given** only the FOC widget applies to this item, **When** I view Projects,
   **Then** the experience still matches US1–US2.

---

### Edge Cases

- **Autosave failure** (offline, rate limit, permission): user sees an
  actionable, non-destructive message; stale values do not silently overwrite
  without indication.
- **Concurrent edits** (another user or tab changes the same field): behavior
  matches reasonable expectations (last write wins with feedback, or refresh
  prompt—product chooses in plan; no silent data loss without notice).
- **Field type present on project but not yet supported** in the widget: shown
  read-only or omitted with clear reason, not as a broken control.
- **Collapsed state**: chevron state persists for the session; persistence
  across reloads is optional (see Assumptions).
- **Issue vs PR** layouts: placement rules hold for both when the extension is
  active for the page.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On supported issue and pull request pages, the **FOC Project
  Board** widget MUST render inside GitHub’s **Projects** sidebar region, not
  isolated below unrelated sections, and MUST appear **above** the **Milestone**
  section when Milestone is present.
- **FR-002**: The widget’s visual structure MUST align with native **GitHub
  Projects** sidebar cards: contained card with rounded corners and subtle
  border, project header (icon + title pattern consistent with host), **Status**
  row where applicable, and rows for custom fields with label/value layout
  comparable to host spacing and typography.
- **FR-003**: The widget MUST use **host-consistent** styling so that in both
  **light** and **dark** GitHub appearance settings, text, borders, and
  interactive surfaces remain legible and visually in-family with adjacent
  GitHub UI (see `.specify/memory/constitution.md` Principle VI).
- **FR-004**: Each editable project field MUST use a control pattern appropriate
  to its type (non-exhaustive): **Status / single select** as choice UI akin to
  host dropdown or pill; **text** as text entry; **number** as numeric entry;
  **iteration / cycle** fields as iteration-style choice UI consistent with host
  expectations where feasible.
- **FR-005**: Field edits MUST **autosave** without requiring a Save or Submit
  action; any debouncing MUST still result in persisted values consistent with
  user intent under normal network conditions.
- **FR-006**: The widget MUST provide an **expand/collapse** affordance
  (chevron) controlling visibility of the detailed field list (or equivalent
  content), with state that clearly indicates expanded vs collapsed.
- **FR-007**: The widget MUST NOT duplicate misleading **Save/Cancel** chrome
  for standard field updates that GitHub handles inline.

### Extension trust and data *(mandatory when delivery is a browser extension)*

- **EXT-001**: Reads and writes **GitHub Projects** field values for the
  configured FOC (and related) project item associated with the current
  issue/PR, using **user-supplied credentials** already authorized for those
  operations; no new host scopes beyond what the feature’s plan documents.
- **EXT-002**: Local persistence is limited to extension configuration and
  session UX (e.g. collapse preference if implemented); issue/PR page DOM is not
  scraped for unrelated content.
- **EXT-003**: No server-side storage of user tokens by this project; mutations
  go to GitHub under the user’s token.
- **EXT-UI-001**: Injected UI MUST match **GitHub-native** Projects card
  appearance and MUST respect **light/dark** per Principle VI; manual
  verification MUST cover both themes for UI-affecting changes.

### Key Entities *(include if feature involves data)*

- **FOC project item**: The board row for the current issue or PR, including
  **Status** and **custom field** values for the configured project(s).
- **Field definition**: Name, type, options (for selects), and editability as
  exposed by GitHub Projects for that project.
- **Widget presentation state**: Expanded vs collapsed (and optional persisted
  preference).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a sample set of **three** distinct issue/PR URLs (including at
  least one pull request), **100%** show the FOC widget **inside Projects** and
  **above** Milestone when Milestone is visible.
- **SC-002**: In **both** GitHub light and dark appearance, a reviewer can
  complete **Status** and **at least two** distinct custom field types (e.g.
  text + single select) without using a Save button, and after a full page
  reload the values **still match** what was last entered (under normal
  connectivity).
- **SC-003**: **90%** or more of informal review participants (or designated
  reviewers) rate the widget as **visually consistent** with native GitHub
  project cards when shown side-by-side screenshots—measured through a one-page
  review checklist attached to QA.
- **SC-004**: Expand/collapse is discoverable: **all** reviewers in a **short**
  usability pass locate the chevron and predict its effect **without**
  documentation in under **30 seconds** per session.

## Assumptions

- The **project display name** (e.g. **FOC**) and which project(s) to bind come
  from existing extension configuration; this spec does not rename the product.
- **Reference visuals** from FilOzone and the cross-org PR mockup are the
  authoritative design intent for “looks like GitHub + our FOC card”; minor
  pixel drift is acceptable if hierarchy and controls match.
- **GitHub’s own Projects UI** may vary by account features; the widget targets
  the layouts used on github.com for FilOzone and filecoin-project examples.
- **Session-only** expand state is acceptable unless stakeholders require
  cross-reload persistence (then tracked as a small follow-up).
- Repositories without a linked FOC project item continue to behave per prior
  extension rules (out of scope to redefine detection here).
