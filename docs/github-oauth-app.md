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

**Stable ID (this repo):** `npm run build` embeds **`manifest.key`** from the committed file
**`extension/manifest-id-public.b64`**. That pins the **extension ID** for **unpacked**
loads of **`extension/dist/`** (same ID on every machine/path). The build logs the ID and
full **`OAuth redirect` URL**—register **that** URL on your GitHub OAuth app (GitHub allows
**one** callback per OAuth app).

**Chrome Web Store:** Google **rejects** packages whose manifest includes **`key`**. This
repo’s **`npm run build:zip`** writes **`foc-gh-webstore.zip`** with **`manifest.key`**
**removed** from a copy of the manifest. The **listing extension ID** is therefore assigned
by Google and **does not match** the unpacked/stable ID from
**`manifest-id-public.b64`**. Register a **second** GitHub OAuth app whose callback is
`https://<webstore-extension-id>.chromiumapp.org/` (ID from the [Developer
Dashboard](https://chrome.google.com/webstore/devconsole)); GitHub still allows only **one**
callback URL per app.

**Rotating the key:** Replacing **`manifest-id-public.b64`** changes the extension ID and
invalidates the GitHub callback—avoid unless you intend to re-register OAuth.

### FilOzone reference (two org OAuth apps)

FilOzone uses **two** GitHub OAuth Apps registered under the organization—**one per extension ID** (GitHub allows **one** callback URL per app):

| Channel | Extension ID | Authorization callback URL | Manage app (org admins) |
|---------|--------------|----------------------------|---------------------------|
| **Development** — unpacked `extension/dist/` (pinned via `manifest.key` from `extension/manifest-id-public.b64`) | `akbchnphednohmffplmejpefockadcbg` | `https://akbchnphednohmffplmejpefockadcbg.chromiumapp.org/` | [FOC GH dev — OAuth app settings](https://github.com/organizations/FilOzone/settings/applications/3490509) |
| **Production** — [Chrome Web Store](https://chrome.google.com/webstore/devconsole) listing | `haicdejjcnecapheflpdpdngflffejpf` | `https://haicdejjcnecapheflpdpdngflffejpf.chromiumapp.org/` | [FOC GH prod — OAuth app settings](https://github.com/organizations/FilOzone/settings/applications/3491974) |

**Forks and external contributors** still create their **own** OAuth apps; the committed public key only pins the **team** local ID when using this repository’s `manifest-id-public.b64`.

**CI:** [`.github/workflows/extension-ci.yml`](../.github/workflows/extension-ci.yml) can pass **`GITHUB_OAUTH_CLIENT_ID`** / **`GITHUB_OAUTH_CLIENT_SECRET`** from repository **Actions** secrets into `npm run build`; fork PRs do not receive those secrets (compile-only). See [`extension/README.md`](../extension/README.md) → *Continuous integration*.

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

## 4. Cross-org restriction: adding issues/PRs from outside the home org

### The problem

When a user adds an issue or PR from a **different organization** (e.g. `filecoin-project/FIPs`) to a global board hosted in FilOzone, the extension calls GitHub's GraphQL mutation `addProjectV2ItemById`. That mutation passes the issue's node ID as `contentId`. GitHub's API backend **validates that the calling OAuth token has read access to the content's owner org** before linking the item — even if the issue is in a public repository.

If the target org (`filecoin-project` in the example) has **OAuth App access restrictions** enabled, GitHub blocks the call with:

> "Although you appear to have the correct authorization credentials, the `<org>` organization has enabled OAuth App access restrictions, meaning that data access to third-parties is limited."

This happens **only for `addProjectV2ItemById`**, not for mutations that operate on items already in the board (e.g. `updateProjectV2ItemFieldValue` for status changes). Those mutations touch only the project's own data and never need to resolve content in the foreign org.

### Why OAuth tokens are subject to this

GitHub's **OAuth App access restrictions** let an organization block all OAuth tokens (regardless of scopes) from reading or writing org data unless the OAuth App has been explicitly approved. This applies even to public-repo content within that org. PATs are not OAuth App tokens and are therefore **not subject to this restriction**.

### Fixes

| Fix | Steps | Trade-off |
|-----|-------|-----------|
| **Approve the OAuth App in each external org** (recommended for multi-org use) | An org owner opens `github.com/organizations/<org>/settings/oauth_application_policy`, finds the app under "Pending requests" or searches by name, and clicks **Approve**. | Requires a one-time action by each org's owners; no change to the extension or user workflow thereafter. |
| **Use a classic PAT instead of OAuth** | In extension options, switch to PAT auth with `repo` + `project` scopes. | Classic PATs bypass OAuth App restrictions entirely; fine-grained PATs may still be blocked depending on org policy. |

### Requesting approval

A user can trigger a self-serve approval request without contacting admins directly:

1. Go to **github.com/settings/connections/applications** and find this extension's OAuth App.
2. Under **Organization access**, locate the org with the restriction and click **Request**.
3. GitHub emails the org's owners, who approve at the link above.

Once approved, no extension reinstall or re-authentication is needed — the existing OAuth token gains access immediately.

---

## 5. Revocation

Users can **Disconnect** in extension options and/or revoke the app under
**GitHub → Settings → Applications**.
