<!--
Sync Impact Report
- Version: 1.0.0 (initial ratification)
- Principles: I–V as in body; IV encodes internal velocity (manual verification OK)
- Sections: Internal scope and velocity; Security, Privacy, and Permissions;
  Development Workflow and Quality Gates; Governance
- Templates aligned: plan-template, spec-template, tasks-template
- Follow-up TODOs: none
-->

# TPM Utils GitHub Extension Constitution

Internal Chromium extension that augments the [GitHub](https://github.com) web UI
with TPM-focused workflows (see [tpm-utils#23](https://github.com/FilOzone/tpm-utils/issues/23)). Distribution is
**internal** (unpacked / org-controlled) unless a future amendment graduates
wider release expectations.

## Core Principles

### I. Security and least privilege (NON-NEGOTIABLE)

The extension MUST use the narrowest `host_permissions` and API scopes that can
satisfy a feature. Any increase in permission surface (new hosts, broader
`optional_host_permissions`, new OAuth scopes, or new content-script matches)
MUST be justified in the implementation plan and reviewed before merge.
Secrets MUST NOT be committed: tokens belong in the user-controlled store only
(e.g. `chrome.storage` after explicit user action). Third-party telemetry,
remote code, or opaque binary payloads are forbidden unless explicitly
approved in a constitution amendment.

**Rationale**: Internal use does not lower the bar for credential theft or
over-broad host access.

### II. User-owned credentials and explicit consent

Authentication to GitHub (PAT, OAuth device flow, or future supported methods)
MUST be initiated and revocable by the user. The extension MUST document which
GitHub scopes are required and what data each feature reads or writes. Silent
credential harvesting, shared “team” tokens baked into the build, or
server-side storage of user tokens by this project are forbidden.

**Rationale**: Cross-org work still binds actions to an identifiable user and
their token boundaries.

### III. GitHub API discipline

All integration with GitHub MUST target supported APIs (GraphQL for Projects v2
where applicable, REST where required). Call sites MUST handle rate limiting,
permission errors, and partial failure with user-visible, actionable messages.
Mutations that change project fields MUST be idempotent from the user’s
perspective where the platform allows it (safe retries; no duplicate items).

**Rationale**: Flaky or silent failures waste TPM time on board updates.

### IV. Lightweight verification (internal velocity)

Automated unit or integration tests SHOULD be added when cheap and high value;
they are **not** merge-blocking under this constitution.
Every pull request MUST either (a) reference added or updated automated tests,
or (b) list concrete **manual** verification steps (which GitHub URLs, which UI
paths, which API actions). Changes to auth flows, `manifest.json`,
credential storage, or host permissions MUST include a short written smoke
checklist in the PR; reviewers MUST treat regressions in those areas as merge
blocking.

**Rationale**: The project prioritizes shipping GitHub UI enhancements quickly
for an internal audience; residual risk is offset by mandatory security rules,
small scope, and human review—not a large automated matrix.

### V. Simplicity and incremental delivery

Features MUST ship as small increments that deliver value without speculative
generalization (YAGNI). Prefer one board, one field, or one flow done well
before adding breadth. Complexity MUST be recorded in the plan’s complexity
tracking table with a rejected simpler alternative.

**Rationale**: Keeps permission and review load manageable.

## Internal scope and velocity

- **Audience**: Primarily FilOzone TPMs and adjacent maintainers; not a public
  consumer product unless governance is amended.
- **Distribution**: Default is developer-installed (unpacked) or org-signed
  channels documented in the README. Store publication triggers stricter
  packaging and disclosure expectations and SHOULD prompt a constitution review.
- **Velocity**: Prefer working UI integration and documented manual checks over
  broad test infrastructure until product/market fit is clearer.

## Security, Privacy, and Permissions

- The extension targets Chromium Manifest V3 unless a tracked issue decides
  otherwise.
- Default posture: request access to `https://github.com/*` for UI integration
  and `https://api.github.com/*` for API calls only if the platform requires
  split origins; justify any deviation.
- Do not retain issue/PR page HTML or unrelated DOM beyond what is needed to
  resolve repository context and user intent; do not exfiltrate browsing data.
- If published to a store, permissions and data practices in the listing MUST
  match this constitution and the README.

## Development Workflow and Quality Gates

- Use [Conventional Commits](https://www.conventionalcommits.org/) for all
  commits (`type: description`; common types: `feat`, `fix`, `docs`, `chore`,
  `test`, `ci`).
- Every implementation plan MUST pass the Constitution Check gates in
  `.specify/templates/plan-template.md` before Phase 0 research ends; violations
  require an approved row in the plan’s Complexity Tracking table.
- Pull requests that touch auth, `manifest.json`, network code, or storage MUST
  be reviewed with the Core Principles checklist above.
- README MUST document: install (including unpacked loading for development),
  required GitHub scopes, and how to revoke access.

## Governance

This constitution supersedes conflicting informal practices for this repository.
Amendments require:

1. A pull request that updates `.specify/memory/constitution.md` with version
   and date metadata.
2. Semantic version bump for this document: **MAJOR** — principle removed or
   redefined incompatibly; **MINOR** — new principle or materially expanded
   section; **PATCH** — clarification, wording, or non-semantic refinement.
3. Propagation: dependent templates (plan, spec, tasks) MUST be updated in the
   same PR when gates or mandatory sections change.

Compliance expectation: reviewers treat security, permission, and
credential-handling changes as blocking unless the amendment process was
followed.

**Version**: 1.0.0 | **Ratified**: 2026-03-26 | **Last Amended**: 2026-03-26
