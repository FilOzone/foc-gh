# Data model: GitHub OAuth + PAT options auth

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-03-27

## Stored configuration (`chrome.storage.local`)

Extends keys defined in `extension/src/lib/project-config.ts`. New or clarified
fields:

| Key | Type | Description |
|-----|------|-------------|
| `auth_method` | `'pat' \| 'oauth' \| 'none'` | **Active** credential source for API calls (`none` when no bearer stored). Required when migrating from legacy installs that only had token + optional `github_token_kind`. |
| `github_api_token` | string | Bearer secret: PAT when `auth_method==='pat'`, or OAuth **access token** when `auth_method==='oauth'`. Empty when signed out. |
| `github_token_kind` | `'pat' \| 'oauth' \| ''` | **Subtype** for telemetry/diagnostics: `pat` for pasted PAT; `oauth` for token obtained via Connect flow (or legacy paste of OAuth token). Align with existing options UI where practical. |
| `oauth_token_expires_at` | number (epoch ms) optional | If GitHub returns expiry, store for proactive “reconnect” hints; omit if not provided. |
| *(existing)* `cross_org_board_urls`, `cross_org_target_repos`, `status_field_name`, `issue_pr_projects_auto_expand` | unchanged | Board configuration independent of auth path. |

### Migration

- If **`auth_method` absent** but `github_api_token` non-empty: infer
  `auth_method` from legacy `github_token_kind` (`oauth` → `oauth`, else `pat`).
- If both absent and token present: default `auth_method='pat'`.

## Ephemeral state (not persisted)

| Item | Where | Purpose |
|------|-------|---------|
| PKCE `code_verifier` | In-memory in service worker / options session during `launchWebAuthFlow` | Must not be written to `storage`; short-lived for token exchange. |
| In-flight OAuth tab id | Optional, in-memory | Debugging / cancel detection only. |

## State transitions

```text
                    ┌─────────────────┐
                    │  signed_out      │
                    │ (no bearer token) │
                    └────────┬────────┘
           Connect GitHub     │      Paste PAT + save
                    ┌────────▼────────┐──────────┐
                    │  oauth_active   │          │  pat_active
                    └────────┬────────┘          └──┴──────────────┐
              Disconnect     │                    Disconnect / clear │
                    ┌────────▼────────┐                         │
                    │  signed_out      │◀────────────────────────┘
                    └─────────────────┘
```

Switching **oauth_active → pat_active**: user confirms; **clear OAuth token**
and set `auth_method='pat'`.  
Switching **pat_active → oauth_active**: user confirms; **clear PAT** (or
overwrite) and complete OAuth; set `auth_method='oauth'`.

## Validation rules

- **FR-007 / spec assumption**: At most one of PAT and OAuth tokens is **active**;
  the inactive path is cleared or empty while the other is active.
- Token string: non-empty whitespace-trimmed string before save; never log full
  token in diagnostic streams (existing code patterns should mask).

## GitHub OAuth app (deployer-owned)

| Field | Notes |
|-------|------|
| Client ID | Public; bundled at build time per environment. |
| Callback | `chrome.identity.getRedirectURL()` registered on the GitHub OAuth app. |
| Scopes | Equivalent capability to PAT doc; listed in README + options copy. |
