# Implementation Plan: GitHub OAuth sign-in on options (PAT optional)

**Branch**: `004-github-oauth-signin` | **Date**: 2026-03-27 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/004-github-oauth-signin/spec.md`

**Note**: This plan is produced by `/speckit.plan`. See `.specify/templates/plan-template.md` for workflow.

## Summary

Add a **Connect GitHub** OAuth flow on the extension **options** page so users can
authorize **`api.github.com/graphql`** without creating a PAT first, while **keeping**
the existing **PAT paste** path and making **active credential mode** explicit
(**`pat` | `oauth` | none**). Technical approach (see [research.md](./research.md)):
**OAuth 2.0 authorization code + PKCE** via **`chrome.identity.launchWebAuthFlow`**
and `chrome.identity.getRedirectURL()`, then **form-encoded** token exchange to
GitHub including **`client_id` + `client_secret` + `code` + `redirect_uri` +
`code_verifier`** (GitHub’s **classic OAuth App** web flow requires the secret at
exchange time). **`GITHUB_OAUTH_CLIENT_SECRET`** is injected at **build time**
into `service-worker.js` only (same pattern as Client ID); it is not a runtime
secret from the options page. Persist access token in **`chrome.storage.local`**
with the same key shape the service worker already uses for Bearer auth. Introduce
**`identity`** manifest permission. Centralize bearer resolution in one helper
so GraphQL, diagnostics, and board column refresh behave identically for PAT or
OAuth.

**OAuth App ownership:** FilOzone (and similar orgs) should register the OAuth App
under **`https://github.com/organizations/<org>/settings/applications`** when
possible—see [`docs/github-oauth-app.md`](../../docs/github-oauth-app.md).

## Technical Context

**Language/Version**: TypeScript (ES modules), Node for build (align with repo `package.json`)  
**Primary Dependencies**: Chromium Manifest V3, `chrome.storage`, `chrome.identity`,
`chrome.runtime` messaging, `fetch` to `https://api.github.com/graphql` and GitHub
OAuth endpoints on `github.com`  
**Storage**: `chrome.storage.local` for PAT or OAuth access token + `auth_method`
+ existing board keys ([data-model.md](./data-model.md)); PKCE verifier **only**
in memory  
**Testing**: Manual flows in [quickstart.md](./quickstart.md); automated tests
optional per constitution  
**Target Platform**: Chromium (Chrome/Edge), MV3 unpacked (dev) / future packed ID
for OAuth callback registration  
**Project Type**: Browser extension (options page + service worker)  
**Performance Goals**: OAuth flow completes within spec **SC-001** (~3 minutes
budget includes user reading consent); token exchange &lt; few seconds on normal
networks  
**Constraints**: No **project-hosted** token broker (**EXT-003**); token exchange runs
in the extension service worker using build-injected `GITHUB_OAUTH_CLIENT_ID` /
`GITHUB_OAUTH_CLIENT_SECRET` (classic OAuth App requirement). Scopes ≤ existing PAT
capability documentation.  
**Scale/Scope**: One OAuth App (Client ID + secret) per deployment channel; single-user
browser profile storage

## Constitution Check

*GATE: Passed before Phase 0; re-checked after Phase 1.*

| Gate | Status | Evidence |
|------|--------|----------|
| **Least privilege** | Pass | Add **`identity`** permission for `launchWebAuthFlow` only; keep existing `https://github.com/*` and `https://api.github.com/*` host permissions. OAuth **scopes** enumerated in README + options copy and aligned with [`docs/github-pat-permissions.md`](../../docs/github-pat-permissions.md) capability. |
| **User credentials** | Pass | User initiates Connect or PAT save; tokens only in `chrome.storage.local`; **Disconnect** clears OAuth session fields; revocation documented for GitHub settings. |
| **API discipline** | Pass | Reuse existing GraphQL client; same 403/429 handling; surfaced errors per **FR-006** with pointer to options. |
| **Verification** | Pass | PR includes **smoke checklist**: OAuth happy path, cancel, PAT path, switch PAT ↔ OAuth, light/dark options page, API diagnostics. **Manifest** + **auth** touch → mandatory short smoke list in PR body. |
| **Incremental scope** | Pass | MVP = PKCE connect + persist + disconnect + explicit mode + PAT retained; no GitHub App user-to-server, no org-wide token broker. |
| **UI fidelity** | Pass | **Options** page: `prefers-color-scheme` / contrast-safe styling (**EXT-UI-001**); injected github.com UI unchanged by this feature. |

**Post-Phase 1 re-check**: [data-model.md](./data-model.md) and
[contracts/options-github-auth.md](./contracts/options-github-auth.md) introduce
no server trust; message contract stays client-only. No Complexity Tracking rows.

## Project Structure

### Documentation (this feature)

```text
specs/004-github-oauth-signin/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── options-github-auth.md
├── checklists/
│   └── requirements.md
└── spec.md
```

### Source Code (repository root)

```text
extension/
├── manifest.json              # add "identity"; document callback ID story
├── src/
│   ├── options/
│   │   ├── options.html       # Connect / Disconnect / mode copy
│   │   └── options.ts         # wire messages, load/save auth_method
│   ├── background/
│   │   └── …                  # OAuth PKCE helpers; message handlers
│   └── lib/
│       ├── project-config.ts  # STORAGE_KEYS + auth_method + migration
│       └── …                  # shared getGithubBearer() (or equivalent)
└── dist/                      # build output
```

**Structure Decision**: Ship in existing **`extension/src`** tree; bundle
background + options with current build (`npm run build`).

## Complexity Tracking

No constitution violations requiring justification. No rows.

---

## Phase 0 — Research

**Output**: [research.md](./research.md) — PKCE + `chrome.identity` decision,
scope alignment, single-credential rule.

## Phase 1 — Design

**Output**:

- [data-model.md](./data-model.md) — storage keys, migration, state transitions.
- [contracts/options-github-auth.md](./contracts/options-github-auth.md) —
  options ↔ background messages.
- [quickstart.md](./quickstart.md) — manual verification steps.

**Agent context**: Updated via  
`.specify/scripts/bash/update-agent-context.sh cursor-agent`.

## Phase 2 — *(not executed here)*

Implementation and **tasks.md** are produced by `/speckit.tasks`, not this command.
