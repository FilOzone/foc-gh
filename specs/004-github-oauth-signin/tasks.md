# Tasks: GitHub OAuth sign-in on options (PAT optional)

**Input**: Design documents from `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/specs/004-github-oauth-signin/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/options-github-auth.md](./contracts/options-github-auth.md), [quickstart.md](./quickstart.md)

**Tests**: Per constitution, automated tests are optional; validation is **manual** via [quickstart.md](./quickstart.md).

**UI**: Options page only for this feature; use **`prefers-color-scheme`**-safe styling ([spec.md](./spec.md) EXT-UI-001). No new injected github.com chrome.

**Format**: Every task uses `- [ ] Tnnn [P?] [USn?] Description with file path`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: OAuth app registration story (prefer **org-owned** app when using org data)
and build-time **Client ID** + **Client secret** wiring for the service worker.

- [x] T001 Document GitHub OAuth App creation (including org path `organizations/<org>/settings/applications`), callback `https://<extension-id>.chromiumapp.org/` alignment with `chrome.identity.getRedirectURL()`, and dev/prod extension ID notes in `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/docs/github-oauth-app.md`
- [x] T002 [P] Inject `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` at build time via `process.env` + esbuild `define` in `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/scripts/build.mjs` and modules `github-oauth-client-id.ts` / `github-oauth-client-secret.ts` (**never** commit secrets; clear error if secret missing when starting Connect)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Manifest permission, storage schema/migration, PKCE helpers, runtime messaging — **blocks all user stories**.

**⚠️ CRITICAL**: No user story UI work until PKCE + `service-worker` handlers exist.

- [x] T003 Add `"identity"` to `"permissions"` in `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/extension/manifest.json` (justify in PR with constitution least-privilege note)
- [x] T004 Extend `STORAGE_KEYS`, `StoredConfig`, and `loadConfig()` with `auth_method` (`pat` | `oauth` | `none`), optional `oauth_token_expires_at`, and legacy migration rules in `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/extension/src/lib/project-config.ts` per `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/specs/004-github-oauth-signin/data-model.md`
- [x] T005 [P] Implement PKCE (`code_verifier` / `code_challenge`), GitHub authorize URL builder, and **form-urlencoded** token exchange (PKCE + **`client_secret`**) in `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/extension/src/lib/github-oauth-pkce.ts` using scopes aligned with `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/docs/github-pat-permissions.md` capability
- [x] T006 [P] Add outbound message types (`GITHUB_OAUTH_START`, `GITHUB_OAUTH_DISCONNECT`, `GET_AUTH_STATUS`) and response shapes to `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/extension/src/lib/messages.ts` per `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/specs/004-github-oauth-signin/contracts/options-github-auth.md`
- [x] T007 Implement `chrome.identity.launchWebAuthFlow` orchestration, storage writes for OAuth success, and handlers for `GITHUB_OAUTH_START` / `GITHUB_OAUTH_DISCONNECT` / `GET_AUTH_STATUS` in `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/extension/src/background/service-worker.ts` (depends on T003–T006; **never** persist `code_verifier`)

**Checkpoint**: From a temporary options debug, messages complete OAuth without UI polish.

---

## Phase 3: User Story 1 — Sign in with GitHub from settings (Priority: P1) 🎯 MVP

**Goal**: User opens options, clicks **Connect GitHub**, completes consent, sees connected state; extension can call GitHub APIs with stored bearer.

**Independent Test**: [spec.md](./spec.md) US1 — fresh profile, Connect only, then **Run API checks** succeeds.

### Implementation for User Story 1

- [x] T008 [US1] Add **Connect GitHub** control, short consent/scopes explanation, and link to PAT docs in `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/extension/src/options/options.html`
- [x] T009 [US1] Wire **Connect GitHub** to `GITHUB_OAUTH_START`, handle `{ ok: false, error }` vs success, and refresh visible status from storage or `GET_AUTH_STATUS` in `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/extension/src/options/options.ts`

**Checkpoint**: MVP — OAuth path works end-to-end with minimal UI.

---

## Phase 4: User Story 2 — Enter a PAT when preferred (Priority: P2)

**Goal**: Explicit **PAT** path remains; saving PAT sets `auth_method` to `pat` and does not silently overlap OAuth.

**Independent Test**: [spec.md](./spec.md) US2 — disconnect OAuth if needed, paste PAT, Save, diagnostics succeed.

### Implementation for User Story 2

- [x] T010 [US2] Add clear **auth mode** UX (radio group or tabs: **GitHub sign-in** vs **Personal access token**) and copy for mutual exclusivity in `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/extension/src/options/options.html`
- [x] T011 [US2] On Save, set `auth_method` to `pat`, `github_token_kind` appropriately, persist PAT to `github_api_token`, and **clear** conflicting OAuth fields when switching from OAuth → PAT per `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/specs/004-github-oauth-signin/data-model.md` in `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/extension/src/options/options.ts`

**Checkpoint**: PAT-only and OAuth-only paths both work; switch does not leave dual credentials.

---

## Phase 5: User Story 3 — Connection status and disconnect (Priority: P3)

**Goal**: User always sees **how** they are signed in; **Disconnect** clears OAuth session per contract.

**Independent Test**: [spec.md](./spec.md) US3 — status + Disconnect + signed-out behavior for API features.

### Implementation for User Story 3

- [x] T012 [US3] Add **connection status** summary (`auth_method`, masked “connected” hint if desired) and **Disconnect** control for OAuth in `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/extension/src/options/options.html`
- [x] T013 [US3] Load status on `options` open; call `GITHUB_OAUTH_DISCONNECT` when Disconnect clicked; ensure content scripts / messaging paths show actionable “configure in options” when `auth_method` is `none` or token empty in `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/extension/src/options/options.ts` and adjust call sites in `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/extension/src/content/issue-sidebar.ts` only if current UX silently fails without token

**Checkpoint**: All three user stories independently verifiable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Docs, theming, PR smoke checklist.

- [x] T014 [P] Update `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/extension/README.md` and add OAuth scopes summary (mirror PAT capability) in `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/docs/github-pat-permissions.md` or sibling section per [plan.md](./plan.md)
- [x] T015 [P] Add `prefers-color-scheme` / CSS variables for options page contrast in `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/extension/src/options/options.html`
- [x] T016 Run manual scenarios in `/Users/sal/Documents/Code/FilOz Projects/tpm-utils-github-extension/specs/004-github-oauth-signin/quickstart.md` and paste results + PR smoke checklist (manifest + auth) in the PR description

---

## Dependencies & Execution Order

### Phase dependencies

| Phase | Depends on |
|-------|------------|
| Phase 1 | — |
| Phase 2 | Phase 1 (Client ID available for T007) |
| Phase 3–5 | Phase 2 complete |
| Phase 6 | US1–US3 complete (or at least T014–T015 parallel late) |

### User story dependencies

| Story | Depends on |
|-------|------------|
| US1 | Phase 2 only |
| US2 | Phase 2; integrates with US1 storage keys |
| US3 | Phase 2; US1 OAuth + US2 PAT UX should exist for meaningful status |

**Suggested order**: Phase 1 → Phase 2 → **US1 (MVP)** → US2 → US3 → Polish.

### Parallel opportunities

- **Phase 1**: T002 [P] while T001 is written.
- **Phase 2**: T005 [P] and T006 [P] after T003–T004 (T004 can follow T003; T005–T006 can run in parallel once `project-config` keys are stable).
- **Phase 6**: T014 [P] and T015 [P] in parallel.

---

## Parallel example: Foundational (after T003–T004)

```text
T005  Implement PKCE + token exchange in extension/src/lib/github-oauth-pkce.ts
T006  Extend extension/src/lib/messages.ts with OAuth message types
```

---

## Implementation strategy

### MVP first (User Story 1 only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. **Stop**: run US1 independent test + API checks; demo before PAT UX polish.

### Incremental delivery

1. US1 → OAuth connect shipped.
2. US2 → explicit PAT mode + save rules.
3. US3 → status + disconnect + better empty-token UX on content pages if needed.

---

## Task summary

| Metric | Value |
|--------|------|
| **Total tasks** | 16 |
| **Phase 1** | 2 |
| **Phase 2** | 5 |
| **US1** | 2 |
| **US2** | 2 |
| **US3** | 2 |
| **Polish** | 3 |

**Format validation**: All lines use `- [ ] Tnnn` with optional `[P]` and `[USn]` only where required by template rules.

---

## Notes

- **Single bearer field**: `github_api_token` holds PAT **or** OAuth access token; `auth_method` disambiguates (see data model).
- **Do not** commit OAuth Client Secret to git; it is **build-injected** into `service-worker.js` only (see [research.md](./research.md)). Prefer an **organization-owned** OAuth App for org workflows.
- Commit in small groups per phase; conventional commits per repository constitution.
