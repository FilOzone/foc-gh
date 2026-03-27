# Research: GitHub OAuth on extension options (PAT remains optional)

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-03-27

## 1. OAuth patterns for Chromium MV3 + GitHub

### Problem

GitHub’s **web application** OAuth flow traditionally exchanges an authorization
code for tokens using **`client_id` + `client_secret`**. Browser extensions must
**not** ship a client secret (recoverable from the package).

### Option A — Authorization code + PKCE + classic OAuth App token exchange (chosen)

The extension performs the authorize step with **PKCE** (**code challenge** /
**code verifier**). For **classic GitHub OAuth Apps**, GitHub’s
`POST /login/oauth/access_token` step still expects **`client_secret`** alongside
`client_id`, `code`, `redirect_uri`, and `code_verifier` in practice. We inject
**`GITHUB_OAUTH_CLIENT_SECRET`** at **build time** into the service worker bundle
only (not from the options UI), with body **`application/x-www-form-urlencoded`**.

**OAuth App registration:** Prefer an **organization-owned** OAuth App for team
deployments (`https://github.com/organizations/<org>/settings/applications`) so
credentials and policy reviews stay with the org; document in
[`docs/github-oauth-app.md`](../../docs/github-oauth-app.md).

- **User UX**: One or two browser tabs/windows during consent; familiar “Authorize
  application” on github.com.
- **API**: `chrome.identity.launchWebAuthFlow` with `interactive: true`, redirect
  URL from `chrome.identity.getRedirectURL()` (typically
  `https://<extension-id>.chromiumapp.org/`), registered as the OAuth app’s
  **Authorization callback URL** on GitHub.
- **Prerequisite**: New **`identity`** permission in `manifest.json` (justified in
  plan constitution check).

**Alternatives considered**

| Approach | Why not primary |
|----------|-----------------|
| **Device flow** | Works without redirect URL setup; UX is slower (user copies code / extra step). Good fallback if org policy blocks custom redirect URIs. |
| **Backend token exchange** | Violates spec **EXT-003** (no project-hosted token broker) unless separately approved. |
| **Implicit grant** | Deprecated / not appropriate for GitHub’s current OAuth app guidance. |
| **Manual OAuth token paste** | Already partially supported via `tokenKind=oauth`; does not satisfy “sign in with GitHub” without visiting GitHub developer settings. |

**Decision**: Implement **authorization code + PKCE** for “Connect GitHub” on the
options page; keep **PAT paste** as the alternate path; keep **manual OAuth bearer
paste** only if we still need it after first-class connect (may fold into “advanced”).

**References** (implementation phase): GitHub docs on [authorizing OAuth Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) and PKCE; Chrome [`identity` API](https://developer.chrome.com/docs/extensions/reference/api/identity).

---

## 2. Scopes vs existing PAT documentation

GraphQL usage today requires permissions equivalent to
[`docs/github-pat-permissions.md`](../../docs/github-pat-permissions.md)
(Projects v2 read/write on the configured org project; Issues/PR read on target
repos). For OAuth Apps, express these as **OAuth scopes** on the authorize URL
(e.g. `repo`, `read:org`, `project`—exact set to be mirrored to the PAT doc table
in the same PR so README and settings copy stay aligned).

**Decision**: **No new API surface**—only a new way to obtain a Bearer token with
the **same logical capability** as today’s documented PAT setup; update
`github-pat-permissions.md` (or a sibling OAuth scopes section) in lockstep.

---

## 3. Token storage and rotation

- **Storage**: Continue **`chrome.storage.local`** for access token string and
  metadata (`github_token_kind`, optional expiry if GitHub returns `expires_in`).
- **Refresh**: GitHub OAuth user access tokens may be long-lived depending on app
  settings; if refresh tokens are not returned for this app type, user must
  **Connect GitHub** again after revocation/expiry—surface as spec **FR-006**
  actionable messaging.
- **Revocation**: User clicks **Disconnect** in options → remove OAuth tokens and
  clear active auth mode; user can also revoke the app at GitHub settings
  (document in README).

---

## 4. Single effective credential (spec assumption)

**Decision**: Persist explicit **`auth_method`: `pat` | `oauth`** (or equivalent).
The background GraphQL helper resolves the **Bearer token** from **only** the
active method’s storage keys. Switching method **clears** the other credential
after user confirmation (or single primary “Switch to PAT” flow that clears
OAuth first), satisfying **FR-007** without silent dual use.

---

## 5. Options page UI / theming

Options are a normal extension document (not injected into github.com). Use
**system colors** / **`prefers-color-scheme`** or light defaults with sufficient
contrast so **light and dark** OS themes remain legible (**EXT-UI-001**). No
requirement to use Primer on the options page; avoid hard-coded light-gray-on-white
only.

---

## Open items for implementation (not spec blockers)

- **OAuth App registration**: FilOzone (or deployer) creates a **GitHub OAuth App**
  (prefer **org-owned** under `organizations/<org>/settings/applications`), registers
  the callback URL, and sets **`GITHUB_OAUTH_CLIENT_ID`** and
  **`GITHUB_OAUTH_CLIENT_SECRET`** at build time via env / `.env.local` (**never**
  commit secrets; Client ID alone is not secret).
- **Org policy**: Organizations with **OAuth app access restrictions** must **approve**
  the app (org-owned apps are still subject to policy; approval is usually smoother).
- **Callback URL**: Each unpacked vs store build may use different extension IDs;
  document dev vs release callback registration (common extension maintenance cost).
