# Feature Specification: Build and distribution workflows

**Feature Branch**: `005-build-distribution-workflows`  
**Created**: 2026-03-27  
**Status**: Draft  
**Input**: User description: "Clear steps for developers to build and test locally and to build or deploy for production (Chrome Web Store). Provide scripts and GitHub workflows so builds can run from CLI or CI. Support a local distribution with a consistent extension ID and a Store-ready package suitable for submission. Each distribution channel must use the correct GitHub OAuth client ID and secret for that channel."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Local build and test with stable identity (Priority: P1)

A developer clones the repository and wants to load an **unpacked** browser extension for day-to-day work and OAuth testing. They need steps that reliably produce a **local distribution** whose **extension identity** is the same for every teammate (so one GitHub OAuth callback URL can be shared for that channel). They run the project’s documented build path and load the output folder.

**Why this priority**: Without a predictable local identity and matching OAuth setup, **Connect GitHub** breaks or every developer needs a personal OAuth app; that blocks onboarding and testing.

**Independent Test**: Follow only the **local distribution** documentation from a clean clone; confirm the extension reports the **documented** extension ID and OAuth redirect, and that authorized sign-in completes when the GitHub OAuth app matches that redirect.

**Acceptance Scenarios**:

1. **Given** a new contributor with the repo and required secrets available in their environment (not in git), **When** they run the documented local build, **Then** they obtain a loadable unpacked output folder suitable for manual testing.
2. **Given** two machines build the same revision, **When** each loads the respective local output, **Then** the browser-reported extension ID for that channel is **identical** (path-independent).
3. **Given** the local-channel GitHub OAuth app is registered with the matching authorization callback, **When** the user uses **Connect GitHub** in the extension built for that channel, **Then** authorization completes without redirect mismatch.

---

### User Story 2 - Production / Store-bound package (Priority: P2)

A maintainer needs a **store-submittable** package that complies with browser store rules (e.g. no disallowed manifest fields) and is suitable for uploading or automated upload. They follow documented steps or trigger automation to produce that artifact and use the **production** GitHub OAuth credentials when building for end users who install from the store.

**Why this priority**: Shipping updates depends on a repeatable, policy-compliant package and the correct OAuth pair for the **store** extension identity.

**Independent Test**: Produce only the **store** artifact per docs; upload (or validate in a dry run) that the store accepts the package; install from the store (or equivalent test) and confirm OAuth uses the production callback.

**Acceptance Scenarios**:

1. **Given** store policy forbids certain manifest fields used only for local pinning, **When** the maintainer builds the **store** distribution, **Then** the produced package omits those fields and is accepted by the store ingestion step the project documents.
2. **Given** production OAuth credentials and the store’s extension identity, **When** the maintainer builds with credentials bound to that channel, **Then** the shipped extension’s **Connect GitHub** flow uses the production callback (no cross-channel mismatch).
3. **Given** a contributor who only has local OAuth credentials, **When** they follow documentation, **Then** they can tell which credential set to use for local vs production builds before releasing.

---

### User Story 3 - Automation from repository workflows (Priority: P3)

A maintainer wants **continuous integration** (or dispatchable workflows) to run the same build steps as local developers—so artifacts or verification can be produced without a single machine’s state. Secrets for OAuth client ID and secret are supplied through the host’s **secret** mechanism, not committed.

**Why this priority**: Reduces “works on my machine” risk and enables future gates (lint, typecheck, artifact upload).

**Independent Test**: Run the documented workflow on the hosting provider with secrets configured; confirm the job completes and outputs or validates the expected artifact type(s) without exposing secrets in logs.

**Acceptance Scenarios**:

1. **Given** repository secrets configured for at least one channel, **When** the workflow runs, **Then** the build completes successfully without printing client secret values.
2. **Given** a pull request that changes build logic, **When** the workflow runs, **Then** maintainers can see pass/fail from the automation run linked to the change.

---

### Edge Cases

- **Missing or wrong OAuth env for channel**: Build MUST fail clearly or documentation MUST state required variables so users do not ship a build with empty OAuth (silent broken **Connect GitHub**).
- **Channel mix-up**: Maintainer uses local OAuth with a store package (or the reverse)—documentation and naming MUST reduce likelihood; optional guardrails (separate env var names per channel) SHOULD be described.
- **First-time store listing**: Extension ID for store installs may differ from local pinned ID; documentation MUST state that **two** GitHub OAuth apps (or two callbacks if ever supported) may be required and how to register each callback.
- **Forks / external contributors**: They use their own OAuth apps and secrets; docs SHOULD clarify that committed public key pins **team** local ID only for shared callback, not forks’ secrets.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Documentation MUST list discrete steps for **local / test** distribution (build, load, verify) separate from **store / production** distribution (build package, submit, verify identity).
- **FR-002**: The project MUST provide command-line affordances (or Makefile-equivalent) so a developer can produce the **local** distribution with a **stable extension ID** across paths and machines for a given repository revision.
- **FR-003**: The project MUST provide command-line affordances to produce a **store-ingestion-safe** package that satisfies documented store constraints (including omission of any disallowed manifest fields).
- **FR-004**: Documentation MUST explicitly map **two** credential contexts when applicable: OAuth client ID and secret for **local / pinned-ID** installs vs **store-listed** installs, including how each maps to authorization callback URLs.
- **FR-005**: Builds that embed OAuth client credentials MUST obtain client ID and secret from environment or CI secrets documented for each channel; those values MUST NOT be committed to the repository.
- **FR-006**: Repository automation MUST include at least one GitHub Actions workflow that can run the project’s build (or a defined subset such as typecheck + pack) using configured secrets, without logging secrets.
- **FR-007**: Documentation MUST state how a tester confirms **which** extension ID and callback are in effect after a build (e.g. where to read the ID or redirect in build output or browser UI).

### Extension trust and data *(mandatory when delivery is a browser extension)*

- **EXT-001**: This feature does not change which GitHub APIs the extension calls or user-consented scopes; it governs **how** OAuth **app** credentials are chosen per build channel. Documentation MUST cross-link existing GitHub OAuth / PAT trust documentation so builders understand the shipped bundle still acts as a confidential OAuth client where applicable.
- **EXT-002**: This feature does not introduce new local persistence types; build outputs may contain embedded client secret in the service worker bundle per existing design—documentation MUST remind releasers that **production** artifacts are sensitive.
- **EXT-003**: No server-side token storage is introduced by this feature.
- **EXT-UI-001**: This feature does not modify UI injected on `github.com` or the options page; appearance and theme behavior remain as defined in prior specs.

### Key Entities

- **Distribution channel**: Either **local unpacked** (stable ID for team dev) or **store package** (ID assigned by the store; OAuth callback differs when ID differs).
- **OAuth application (per channel)**: GitHub-registered app with a single authorization callback URL; paired client ID and secret used only when building for that channel.
- **Build artifact**: Unpacked output folder vs store upload archive; must match channel rules.
- **Repository secret**: Host-stored name/value used in CI for client ID and secret (and optional store publish keys), not copied into git history.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new contributor can follow documentation once and complete a **local** build and load path **without** asking which OAuth callback applies (documentation and build output make it explicit).
- **SC-002**: **100%** of documented build entry points (local vs store) state **which** OAuth credential set to use, or fail fast when required variables are missing.
- **SC-003**: The automated workflow runs to completion on the default branch with secrets configured, in under **15 minutes** wall time for a typical shallow clone (excluding store review queue time).
- **SC-004**: **Zero** committed plaintext production OAuth client secrets in the repository after this work is complete (verified by secret scanning or manual audit of tracked files).

## Assumptions

- The browser store continues to disallow a developer-supplied **manifest key** field in uploaded packages while still allowing a separate mechanism for stable **local** installs; documentation reflects current policy.
- The team accepts **two** GitHub OAuth apps when store extension ID ≠ local pinned ID (industry-common pattern).
- GitHub Actions is the CI host for “GitHub workflows”; alternative CI is out of scope unless already standardized.
- Store **submission** and **review** are human/account steps outside this spec; the spec covers producing an acceptable **package** and correct OAuth pairing for installers.
