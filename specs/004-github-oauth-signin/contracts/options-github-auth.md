# Contract: Options page ↔ background GitHub auth

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-03-27

## Purpose

Define the **message-based contract** between the extension **options** document
and the **service worker** for starting OAuth (PKCE), finishing token exchange,
and disconnecting—without mandating internal function names.

## Conventions

- All payloads are **JSON-serializable** objects on `chrome.runtime.sendMessage`
  unless noted.
- Errors return `{ ok: false, error: string }` with user-safe text where surfaced
  to UI; technical detail may be logged with `console` in dev builds only.

## Messages (options → background)

### `GITHUB_OAUTH_START`

**When**: User clicks **Connect GitHub** (or equivalent).

**Payload**:

```typescript
{
  type: 'GITHUB_OAUTH_START'
  // Optional future: forceConsent: boolean
}
```

**Success response** (`{ ok: true }`):

- OAuth completes; **`github_api_token`**, **`auth_method`**, **`github_token_kind`**
  updated in `chrome.storage.local` per [data-model.md](../data-model.md).

**Failure response** (`{ ok: false, error: string }`):

- User cancelled, network failure, invalid state, PKCE mismatch, or GitHub error
  body summarized for display.

**Behavioral requirements**:

- MUST use **`chrome.identity.launchWebAuthFlow`** (or successor API) with
  redirect from `chrome.identity.getRedirectURL()`.
- MUST complete PKCE code exchange using **`client_id`** and **`client_secret`**
  supplied only from **build-time** injection into the service worker (not from
  the options page or storage). The secret is part of the shipped bundle risk
  model; see [`docs/github-oauth-app.md`](../../docs/github-oauth-app.md).
- MUST NOT persist `code_verifier`.

---

### `GITHUB_OAUTH_DISCONNECT`

**When**: User clicks **Disconnect** / **Sign out** for the OAuth path.

**Payload**:

```typescript
{
  type: 'GITHUB_OAUTH_DISCONNECT'
}
```

**Response**: `{ ok: true }` after the user is **signed out** from the OAuth path:
clear `github_api_token`, set `auth_method` to `none` (or equivalent empty
state), and clear OAuth expiry metadata. Because the extension uses a **single**
stored bearer field, disconnecting OAuth **does not** silently fall back to a
previous PAT; the user switches to **Use PAT** and saves a PAT again if needed.

---

### `GET_AUTH_STATUS` (optional consolidation)

**Payload**: `{ type: 'GET_AUTH_STATUS' }`

**Response**:

```typescript
{
  ok: true
  authMethod: 'pat' | 'oauth' | 'none'
  hasToken: boolean // true if bearer available for API
  loginHint?: string // optional masked username if we add /user lookup later
}
```

Used to render **connection status** without reading raw tokens from options
(though options may still read storage for the PAT field UI).

## Messages (unchanged family)

Existing diagnostics (`GET_PRIMARY_BOARD_FIELD_DEFINITIONS`, streaming debug)
**MUST** resolve the bearer token via the same **central helper** used after this
feature (read `auth_method` + token key) so PAT and OAuth paths behave identically
for GraphQL.

## UI contract (options page)

| Element | Behavior |
|---------|----------|
| **Connect GitHub** | Disabled while in-flight; shows spinner or label. |
| **Disconnect** | Visible only when `authMethod === 'oauth'` (or when OAuth token present per product rules). |
| **PAT field** | Visible when user selects “Use personal access token” **or** when legacy layout keeps both sections—copy MUST explain mutual exclusivity. |
| **Save** | Persists PAT path; if switching from PAT to OAuth was done via Connect, PAT field may be cleared. |

## Versioning

Bump this document when message types or payload shapes change.
