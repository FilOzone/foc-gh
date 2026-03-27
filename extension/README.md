# FilOzone FOC board (cross-org) — browser extension

Chromium **Manifest V3** extension: on configured repos (default `filecoin-project/curio`,
`filecoin-project/filecoin-pin`), adds a sidebar panel that shows whether the current
issue or PR is on the FilOzone FOC Projects v2 board (default
[orgs/FilOzone/projects/14](https://github.com/orgs/FilOzone/projects/14)),
lets you **add** the item, and edit board fields (**single select**, **number**, **text**,
**iteration**) with **autosave** (no per-field Save button) when the API allows.

## Build

From the **repository root** (parent of `extension/`):

```bash
npm install
# Optional: enables “Connect GitHub” (OAuth + PKCE) in the built extension
export GITHUB_OAUTH_CLIENT_ID="your_oauth_app_client_id"
export GITHUB_OAUTH_CLIENT_SECRET="your_oauth_app_client_secret"
npm run build
```

The Client ID is public; the Client Secret is embedded in `service-worker.js` and must not
be committed. See [`docs/github-oauth-app.md`](../docs/github-oauth-app.md) for registering
the OAuth App and callback URL.

Load **unpacked** from `extension/dist/` in `chrome://extensions` (Developer mode).

## Configure

1. Open the extension **Options** page.
2. Choose **Sign in with GitHub** (recommended) or **Personal access token**:
   - **OAuth**: click **Connect GitHub** after building with `GITHUB_OAUTH_CLIENT_ID` and
     `GITHUB_OAUTH_CLIENT_SECRET` set.
   - **PAT**: paste a classic or fine-grained token that meets
     **[PAT permissions](../docs/github-pat-permissions.md)** (Projects + Issues/PRs on
     target repos).
3. Adjust board URLs or target repos if needed (defaults match the FilOzone TPM workflow).

The extension does **not** use your github.com session cookie as a bearer token for
`api.github.com`; see [research.md](../specs/001-cross-org-board-ui/research.md).

### PAT permissions (summary)

| Need | Classic scopes (typical) | Fine-grained (typical) |
|------|--------------------------|-------------------------|
| View panel / linked state | `read:project` + `public_repo` or `repo` | Org **Projects** read; target repos **Issues** + **Pull requests** read |
| Add item + edit Status | **`project`** + `public_repo` or `repo` | Org **Projects** **Read and write**; repos **Issues** + **Pull requests** read |

Full tables and caveats: [`docs/github-pat-permissions.md`](../docs/github-pat-permissions.md).

### OAuth

**Connect GitHub** uses a GitHub OAuth App with **PKCE** plus the app’s **client secret**
at token exchange (injected at build time into the service worker). Requested scopes mirror
the PAT capability: **`repo`**, **`read:org`**, **`project`**. You can still paste a PAT
instead; only one credential is active at a time.

## Verify

Follow [quickstart.md](../specs/001-cross-org-board-ui/quickstart.md) and
[manual verification](../docs/manual-verification.md).

## Privacy

Token and settings stay in `chrome.storage.local` on your machine only. No project-hosted
token backend (see spec EXT-003).
