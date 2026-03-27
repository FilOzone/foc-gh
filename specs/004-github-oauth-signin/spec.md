# Feature Specification: GitHub sign-in on extension options (OAuth), PAT optional

**Feature Branch**: `004-github-oauth-signin`  
**Created**: 2026-03-27  
**Status**: Draft  
**Input**: User description: "I want to enable OAuth so that a user does not even need to create a PAT but can just sign in with GitHub. Add this flow to the options/settings screen. I should still have the option to set a PAT if I want."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in with GitHub from settings (Priority: P1)

As an extension user, I can open the extension **options or settings** page and
**connect my GitHub account** using a normal **Sign in with GitHub** (or
equivalent) flow, without manually creating a **personal access token** first.

**Why this priority**: This is the primary request: lower friction than PAT
setup while still binding actions to my GitHub identity.

**Independent Test**: From a clean or signed-out credential state, open options,
start GitHub sign-in, complete the host-approved flow, return to options and see
that the extension considers me **connected** to GitHub for the features that
need API access.

**Acceptance Scenarios**:

1. **Given** I am not connected via the new sign-in path, **When** I choose the
   GitHub sign-in action on the options page and complete the flow in the
   browser, **Then** the settings page shows that I am **authenticated** with
   GitHub and the extension can use that connection for permitted features.
2. **Given** I cancel or dismiss the host sign-in window, **When** I return to
   options, **Then** I remain **not** connected via that path and see a clear,
   non-alarming message so I can try again.
3. **Given** sign-in succeeded, **When** I close and reopen the options page,
   **Then** my connected state **persists** until I disconnect or the connection
   becomes invalid (see Edge Cases).

---

### User Story 2 - Enter a PAT when I prefer it (Priority: P2)

As the same user, I can still **paste or type a personal access token** (PAT)
in settings **instead of** using GitHub sign-in, when that fits my workflow or
org policy.

**Why this priority**: The user explicitly required keeping the PAT path; parity
avoids blocking power users and enterprises.

**Independent Test**: Choose PAT mode (or the existing PAT field), enter a valid
token, save or apply per product pattern; confirm the extension treats API
calls as authorized the same class of outcome as Story 1.

**Acceptance Scenarios**:

1. **Given** I prefer a PAT, **When** I provide it through the documented control
   on the options page, **Then** the extension stores it only per existing
   security rules (user-controlled storage, no secrets in source) and uses it
   for GitHub API access.
2. **Given** I already connected via GitHub sign-in, **When** I choose to use a
   PAT instead, **Then** the interface makes the **switch** understandable (no
   silent overlap); the effective credential matches the Assumptions below.
3. **Given** my PAT is invalid or expired, **When** I try to use a feature that
   needs the API, **Then** I get an **actionable** message pointing back to
   settings to fix credentials.

---

### User Story 3 - See connection status and disconnect (Priority: P3)

As a user, I can **see** whether I am connected, **how** (sign-in vs PAT if both
modes exist in the UI), and I can **disconnect** or clear the saved credential
when I want to revoke access from this browser.

**Why this priority**: Required for trust, troubleshooting, and constitution
alignment (user-owned credentials, explicit consent).

**Independent Test**: After connecting, confirm status text or indicators; use
disconnect/sign out; confirm features that need auth behave as unsigned until I
connect again.

**Acceptance Scenarios**:

1. **Given** I am connected, **When** I open options, **Then** I see a **clear**
   summary of connection state (connected vs not, and which method applies).
2. **Given** I am connected, **When** I choose **disconnect** or **sign out**
   (wording per product), **Then** stored credentials for that path are removed
   or invalidated per product rules and the UI reflects **signed out**.
3. **Given** I am signed out, **When** I use a feature that requires GitHub
   access, **Then** I am prompted to complete setup in settings instead of silent
   failure.

---

### Edge Cases

- **Expired or revoked token**: User sees a clear error and a path to re-auth or
  update PAT; no repeated silent retries that look like broken UI.
- **User has both PAT and sign-in available in UI**: Behavior follows
  Assumptions (single effective credential); no undefined overlap.
- **Offline or GitHub unavailable**: Sign-in or token validation fails with a
  human-readable message, not a raw error code only.
- **Least privilege**: Requested access is limited to what extension features
  need; any increase is documented for reviewers (per constitution).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST offer a **GitHub sign-in** path on the
  **options/settings** page so users can authorize the extension **without**
  manually creating a PAT first.
- **FR-002**: The extension MUST **continue to offer** a way to **configure a
  PAT** for users who choose that method.
- **FR-003**: The extension MUST **persist** authorized state appropriately so a
  successful sign-in survives normal browser restart, until disconnect or
  invalidation.
- **FR-004**: The extension MUST show **connection status** and a **disconnect**
  or equivalent action for user-initiated revocation.
- **FR-005**: The extension MUST **document** (in user-facing or in-repo
  documentation linked from settings) **what GitHub access** is requested and
  **why**, before or as part of consent.
- **FR-006**: When API authorization fails, the extension MUST surface **actionable**
  feedback and point users toward fixing credentials in settings.
- **FR-007**: Changing between sign-in and PAT MUST be **explicit** (no silent
  dual credentials); see Assumptions.

### Extension trust and data *(mandatory when delivery is a browser extension)*

- **EXT-001**: All GitHub data access enabled by this feature MUST remain under
  **user-consented** credentials (OAuth-based session or user-supplied PAT).
  Scope and read/write behavior MUST match what the extension already documents
  or must be updated in the same delivery (README / settings copy).
- **EXT-002**: The extension MUST store only **tokens, session handles, and
  metadata** needed to call GitHub APIs on the user’s behalf; it MUST NOT retain
  unrelated github.com page HTML or browsing history for this feature.
- **EXT-003**: This feature MUST NOT introduce **server-side** storage of user
  tokens by this project; any token exchange stays between the user, GitHub, and
  the client extension unless a separate explicitly approved design exists.
- **EXT-UI-001**: Options/settings UI MUST be **legible and understandable** in
  common **light and dark** system/browser themes used by developers. It need
  not mimic github.com chrome, but MUST avoid unreadable contrast or invisible
  controls.

### Key Entities *(include if feature involves data)*

- **GitHub authorization (sign-in path)**: User-granted permission for the
  extension to act on their behalf within declared limits; represented by stored
  tokens or refresh metadata as appropriate to the chosen flow.
- **Personal access token (PAT)**: Optional user-supplied secret used for the
  same API access class when the user selects PAT configuration.
- **Connection settings record**: Persisted user choices and status (connected,
  method in use, last error summary if product surfaces it) on the device.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user who has never created a PAT can complete GitHub sign-in from
  the options page and reach a **connected** state in **under three minutes**
  under normal network conditions (excluding GitHub outages).
- **SC-002**: **100%** of evaluation scenarios include a documented path for
  **PAT-only** users to authenticate without using sign-in, matching FR-002.
- **SC-003**: After successful setup, **at least 90%** of trial users in
  structured usability checks can **correctly state** whether they are connected
  and which method is active, without developer prompting.
- **SC-004**: Disconnect clears or invalidates presented credentials such that a
  **follow-up API-dependent action** prompts for setup again in **100%** of
  verification runs.

## Assumptions

- Target users are **developers or TPMs** with a GitHub account and permission to
  authorize OAuth apps or create PATs per org policy.
- **One effective credential** at a time for API calls: the product chooses a
  deterministic rule (e.g. “PAT overrides if both present” or “last saved
  wins”) and surfaces it clearly in the plan and UI copy; details belong in
  planning, not end-user marketing language.
- Exact **OAuth app registration** (client id, redirect or extension callback
  handling) is an implementation concern but MUST respect least privilege and
  review gates in the constitution.
- **Mobile browsers** and non-Chromium stores are out of scope unless a later
  spec amends distribution.
- Existing features that already read or write GitHub data continue to use the
  **same logical permissions**; this spec adds a **new way to obtain** those
  permissions, not new data categories by default.
