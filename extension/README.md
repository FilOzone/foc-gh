# FOC GH — developer guide

This directory is the **extension source**; builds and loads are driven from the **repository root** (parent of `extension/`).

For **what the extension does** and the feature bullets, see the [project README](../README.md).

## Build

From the **repository root**:

```bash
npm install
export GITHUB_OAUTH_CLIENT_ID="…"
export GITHUB_OAUTH_CLIENT_SECRET="…"
npm run build
```

Or use `.env.local` + `set -a && source .env.local && npm run build` (see [`.env.example`](../.env.example)).

- **Connect GitHub** only works if **both** variables were set at build time; they are compiled into `dist/service-worker.js`. Do not commit real secrets.
- Load **unpacked** from `extension/dist/` in `chrome://extensions` (Developer mode).

### FilOzone OAuth apps (development and production)

**FilOzone** maintains **separate GitHub OAuth Apps** for **development** and **production** (under the org’s developer settings). Each Chromium profile/extension packaging gets a **different extension ID**, and GitHub OAuth Apps allow **one authorization callback URL per app**, so dev and release builds use **different** registrations:

| Channel        | Typical use              | Credentials / callback |
|----------------|--------------------------|-------------------------|
| **Development** | Unpacked load from `extension/dist/`, org TPMs hacking locally | OAuth App registered for your **dev** `https://<dev-extension-id>.chromiumapp.org/` — get **Client ID** and **Client secret** from org admins or internal docs |
| **Production**  | Packaged / Web Store ID for wider rollouts                    | **Production** OAuth App with that extension’s callback URL |

Use the **development** app’s ID and secret in `.env.local` for local builds; use the **production** app only for shipped builds. Full setup (org URL, restrictions): [`docs/github-oauth-app.md`](../docs/github-oauth-app.md).

## Configure

1. Open the extension **Options** page.
2. Choose **Sign in with GitHub** or **Personal access token**:
   - **OAuth**: **Connect GitHub** (requires build with OAuth env vars above).
   - **PAT**: classic or fine-grained token per **[PAT permissions](../docs/github-pat-permissions.md)**.
3. Adjust board URLs or target repos (defaults: `filecoin-project/curio`, `filecoin-project/filecoin-pin`; default board [orgs/FilOzone/projects/14](https://github.com/orgs/FilOzone/projects/14)).

The extension does **not** use your `github.com` session cookie as a bearer for `api.github.com`; see [research.md](../specs/001-cross-org-board-ui/research.md).

### PAT permissions (summary)

| Need | Classic scopes (typical) | Fine-grained (typical) |
|------|--------------------------|-------------------------|
| View panel / linked state | `read:project` + `public_repo` or `repo` | Org **Projects** read; target repos **Issues** + **Pull requests** read |
| Add item + edit Status | **`project`** + `public_repo` or `repo` | Org **Projects** **Read and write**; repos **Issues** + **Pull requests** read |

Full tables: [`docs/github-pat-permissions.md`](../docs/github-pat-permissions.md).

### OAuth scopes (Connect GitHub)

**Connect GitHub** uses OAuth **PKCE** plus a **client secret** at token exchange (build-time). Requested scopes match PAT capability: **`repo`**, **`read:org`**, **`project`**. Only one of OAuth or PAT is active at a time.

## Verify

[quickstart.md](../specs/001-cross-org-board-ui/quickstart.md), [manual verification](../docs/manual-verification.md), and OAuth flow notes in [specs/004-github-oauth-signin/quickstart.md](../specs/004-github-oauth-signin/quickstart.md).

## Privacy

Tokens and settings live in `chrome.storage.local` on your machine only—no project-hosted token backend (spec EXT-003).
