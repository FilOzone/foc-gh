# GitHub OAuth App (browser extension)

This extension obtains a **user access token** via **OAuth 2.0 with PKCE** plus GitHub’s
**authorization code** token endpoint. You register a **GitHub OAuth App** and pass **Client
ID** (`GITHUB_OAUTH_CLIENT_ID`) into the build. **Client Secret**
(`GITHUB_OAUTH_CLIENT_SECRET`) is also required for classic OAuth Apps: GitHub’s token
exchange expects `client_id`, `client_secret`, `/code`, `redirect_uri`, and `code_verifier`
together. The secret is injected only into `service-worker.js` at build time; treat the
built extension as **holding a confidential credential** (do not publish the bundle if the
secret must stay private).

## 1. Create an OAuth App (prefer organization-owned for team use)

**Recommended for org-wide use (e.g. FilOzone):** register the OAuth App **under the
GitHub organization**, not under a personal account. That keeps Client ID/secret and app
settings with the org, makes **OAuth app access restrictions** reviews clearer (“our
extension”), and avoids coupling credentials to one person’s account.

1. Open **`https://github.com/organizations/<ORG>/settings/applications`** (replace
   `<ORG>`; you need permission to manage OAuth Apps for that org).
2. Under **Developer settings** → **OAuth Apps** → **New OAuth App**.
3. **Application name**, **Homepage URL**, and **Authorization callback URL** (below).

**Alternative (personal OAuth App):** **Settings** (your profile) → **Developer settings**
→ **OAuth Apps** → **New OAuth App**. Same callback URL rules apply; orgs that enforce
**third-party OAuth restrictions** may still have to **approve** the app for org data—see
[Restricting access to your organization’s data](https://docs.github.com/articles/restricting-access-to-your-organization-s-data/).

After registration, copy the **Client ID** and generate a **Client secret** for
`.env.local` / your build environment (see §2).

### Callback URL and extension ID

For Chromium, the redirect is:

```text
https://<extension-id>.chromiumapp.org/
```

- **Unpacked** development: open `chrome://extensions`, find this extension, copy
  **ID**. The callback is `https://<that-id>.chromiumapp.org/` (trailing slash
  optional; match exactly what you register on GitHub vs what Chrome sends).
- **Packed / Web Store** builds use a **different** extension ID. Register a
  **separate** OAuth app (or add a second callback URL on the same app if GitHub
  allows multiple callbacks—GitHub OAuth Apps support **one** callback URL per
  app; use **one app per extension ID** or recreate the app when the ID changes).

After changing the callback on GitHub, wait a minute and retry if authorize
fails with `redirect_uri` mismatch.

## 2. Build with Client ID and Client Secret

From the repository root (or use `.env.local` + `set -a && source .env.local`):

```bash
export GITHUB_OAUTH_CLIENT_ID="Ov23li..."
export GITHUB_OAUTH_CLIENT_SECRET="<from OAuth App page — generate if needed>"
npm run build
```

The build injects both values into the **service worker** bundle only.

- **Never** commit real secrets; use `.env.local` (gitignored) or your shell environment.
- Anyone who has your built `extension/dist/service-worker.js` can extract the secret. For
  a widely distributed extension, prefer a **GitHub App** user OAuth flow or a small
  server-side token exchange instead of embedding the secret.

## 3. Scopes

Requested scopes mirror the capabilities documented in
[`github-pat-permissions.md`](./github-pat-permissions.md) (Projects v2 + repo
content). Exact scope strings are listed there under **OAuth (authorization
code + PKCE)**.

## 4. Revocation

Users can **Disconnect** in extension options and/or revoke the app under
**GitHub → Settings → Applications**.
