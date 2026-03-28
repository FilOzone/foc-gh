# FOC GH — developer guide

This directory is the **extension source**; builds and loads are driven from the **repository root** (parent of `extension/`).

For **what the extension does** and the feature bullets, see the [project README](../README.md).

## Build

From the **repository root**:

```bash
npm install
npm run build
```

### Switching development vs production GitHub OAuth (local)

You maintain **two** GitHub OAuth apps (dev vs Store). The build **embeds** one pair into `service-worker.js` per run:

| Command | OAuth **profile** | Which env vars (first match wins) |
|---------|-------------------|-------------------------------------|
| **`npm run build`** | `development` | **`GITHUB_OAUTH_CLIENT_ID_DEVELOPMENT`** / **`GITHUB_OAUTH_CLIENT_SECRET_DEVELOPMENT`**, else **`GITHUB_OAUTH_CLIENT_ID`** / **`GITHUB_OAUTH_CLIENT_SECRET`** |
| **`npm run build:zip`** | `production` | **`GITHUB_OAUTH_CLIENT_ID_PRODUCTION`** / **`GITHUB_OAUTH_CLIENT_SECRET_PRODUCTION`**, else plain **`GITHUB_OAUTH_*`** (CI uses this; local: set prod suffixed vars to avoid mixing) |

**Recommended:** Put **all four** suffixed variables in **`.env.local`** ([`.env.example`](../.env.example)) so you never comment lines—`npm run build` vs **`npm run build:zip`** picks the profile automatically.

Override: **`node scripts/build.mjs --oauth-profile=production`** or env **`FOC_GH_OAUTH_PROFILE=production`**.

A production build that falls back to plain **`GITHUB_OAUTH_*`** prints a **warning**—use **`…_PRODUCTION`** when you also keep dev shorthand in the same file.

### Local / unpacked (step-by-step)

1. From the **repository root**: `npm install`.
2. Add **`.env.local`** with dev credentials (**`GITHUB_OAUTH_*_DEVELOPMENT`** or plain **`GITHUB_OAUTH_*`** — see table above). FilOzone dev app: [FilOzone OAuth apps](#filozone-oauth-apps-development-and-production).
3. Run **`npm run build`**. Console shows **`OAuth profile (embedded): development`** and **Stable extension ID** / **OAuth redirect** for the unpacked ID.
4. Open **`chrome://extensions`**, enable **Developer mode**, **Load unpacked**, choose **`extension/dist/`**.
5. **Options** → **Connect GitHub** — callback must match the **dev** OAuth app.

**OAuth at build time:** **`.env.local`** is loaded automatically; shell vars already set are **not** overwritten by dotenv.

**Chrome Web Store:** `extension/manifest.json` **`description`** must be **at most 132 characters** (Google rejects longer values). **`npm run build`** exits with an error if it is too long.

### Extension IDs: local (unpacked) vs Chrome Web Store

| Channel | Extension ID | How the ID is determined | OAuth redirect URL (register on GitHub) |
|--------|---------------|---------------------------|----------------------------------------|
| **Local unpacked** (`extension/dist/` after `npm run build`) | **`akbchnphednohmffplmejpefockadcbg`** | Pinned by **`manifest.key`**, which **`npm run build`** sets from the committed public key **`extension/manifest-id-public.b64`** (RSA public key, DER as base64). Same folder → same ID on every machine; not derived from the directory path. | `https://akbchnphednohmffplmejpefockadcbg.chromiumapp.org/` |
| **Chrome Web Store** (this listing) | **`haicdejjcnecapheflpdpdngflffejpf`** | Assigned by Google for the listing. The store **forbids** `manifest.key` in uploaded `manifest.json`, so **`npm run build:zip`** strips **`key`** before zipping—local and store IDs **cannot** match while using this workflow. | `https://haicdejjcnecapheflpdpdngflffejpf.chromiumapp.org/` |

**Rebuild check:** After `npm run build`, the console must still print **`Stable extension ID (manifest key): akbchnphednohmffplmejpefockadcbg`**. If you replace **`manifest-id-public.b64`**, this ID and the dev OAuth callback change—coordinate with the team.

**Stable extension ID (OAuth) — detail:** The committed **`extension/manifest-id-public.b64`** is the **public** half of a key pair. Only that file is in git (private key is not kept). Chromium derives the **local** extension ID from that public key material when it appears as **`manifest.key`** in **`extension/dist/manifest.json`**.

- **Connect GitHub** only works if **both** variables were set at build time; they are compiled into `dist/service-worker.js`. Do not commit real secrets.
- **Load unpacked** from **`extension/dist/`** in **`chrome://extensions`** (**Developer mode** on) → **Load unpacked**.

### Chrome Web Store ZIP and upload

Build a **Store-ready ZIP** (manifest and assets at the **root** of the archive — required by Google):

```bash
npm run build:zip
```

**`npm run build:zip`** runs a **production** OAuth profile (embeds **`…_PRODUCTION`** or plain **`GITHUB_OAUTH_*`**). Use the FilOzone **production** app whose callback matches the **Store** extension ID (see [Extension IDs](#extension-ids-local-unpacked-vs-chrome-web-store)). A zip built with **dev** credentials still uploads, but **Connect GitHub** breaks for Store installs.

Writes **`foc-gh-webstore.zip`** at the repo root (gitignored). The zip script **drops `manifest.key`** from **`manifest.json`** — the Store **rejects** uploads that include **`key`**. Your **Web Store extension ID** will **not** match the **unpacked `dist/`** ID; use the **production** GitHub OAuth app/callback (see below).

Upload that file in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole), or use the CLI (after [OAuth setup](https://github.com/fregante/chrome-webstore-upload-keys)):

| Script | What it does |
|--------|----------------|
| **`npm run build:zip`** | `npm run build` + write **`foc-gh-webstore.zip`**. |
| **`npm run upload:chrome`** | Upload **`foc-gh-webstore.zip`** only (no publish). Requires **`CHROME_WEBSTORE_CLIENT_ID`**, **`CHROME_WEBSTORE_CLIENT_SECRET`**, **`CHROME_WEBSTORE_REFRESH_TOKEN`**, **`CHROME_WEBSTORE_EXTENSION_ID`** in **`.env.local`** or the environment ([`.env.example`](../.env.example)). |
| **`npm run publish:chrome`** | **`build:zip`**, then **upload + publish** (default CLI behavior — teammates with the listing URL see the new version after review). |

**Note:** Those four names are **Google Cloud OAuth** credentials for the [Chrome Web Store Publish API](https://developer.chrome.com/docs/webstore/api), **not** your GitHub OAuth app. **`scripts/chrome-webstore.mjs`** maps them to the names the upload CLI expects; this repo does **not** read unprefixed `CLIENT_ID` / `CLIENT_SECRET`. Put values in **`.env.local`** (loaded by the script) or in GitHub Actions secrets (see **Publish from CI** below).

**Service account?** The usual Chrome Web Store flow is a **Google OAuth client** (Desktop / “Chrome app” / installed app) plus a **refresh token** for the **publisher Google account** that owns the listing—see [chrome-webstore-upload-keys](https://github.com/fregante/chrome-webstore-upload-keys) and Google’s [Publish API](https://developer.chrome.com/docs/webstore/api) docs. That is **not** the same as dropping a GCP **service account JSON** into CI; if Google adds or changes machine-to-store auth, update this repo’s env docs when you adopt it.

### FilOzone OAuth apps (development and production)

FilOzone maintains **two** organization-owned **GitHub OAuth Apps**—**one per extension ID**, because GitHub allows **one authorization callback URL per app**:

| Channel | OAuth app (org admin links — requires FilOzone permission) | Extension ID | Authorization callback URL |
|--------|------------------------------------------------------------|----------------|----------------------------|
| **Development** (unpacked `extension/dist/`) | [FilOzone OAuth App — FOC GH dev](https://github.com/organizations/FilOzone/settings/applications/3490509) | `akbchnphednohmffplmejpefockadcbg` | `https://akbchnphednohmffplmejpefockadcbg.chromiumapp.org/` |
| **Production** (Chrome Web Store install) | [FilOzone OAuth App — FOC GH prod](https://github.com/organizations/FilOzone/settings/applications/3491974) | `haicdejjcnecapheflpdpdngflffejpf` | `https://haicdejjcnecapheflpdpdngflffejpf.chromiumapp.org/` |

Use the **development** app’s Client ID + secret in `.env.local` when building for **Load unpacked**; use the **production** app’s credentials when building **`foc-gh-webstore.zip`** for release. Full setup: [`docs/github-oauth-app.md`](../docs/github-oauth-app.md).

### Continuous integration

Workflow: **`.github/workflows/extension-ci.yml`**.

| Trigger | What runs |
|---------|-----------|
| **`push`** to **`main`** | `npm ci` → `npm run typecheck` → `npm run build` |
| **`pull_request`** | Same |

**Secrets** (repository → **Settings** → **Secrets and variables** → **Actions**): set **`GITHUB_OAUTH_CLIENT_ID`** and **`GITHUB_OAUTH_CLIENT_SECRET`** for **Connect GitHub** to be wired in CI-built output. Use **development** app values if the workflow only validates compile; use **production** values for release automation. **Fork PRs** do not receive these secrets—`npm run build` still runs with empty OAuth strings (compile check only).

Do **not** print OAuth values in workflow logs.

### Publish to Chrome Web Store (manual CI)

Workflow: **`.github/workflows/chrome-webstore-publish.yml`**.

| Trigger | What runs |
|---------|-----------|
| **Actions → Publish Chrome Web Store → Run workflow** (branch **`main`** only) | `npm ci` → **`npm run publish:chrome`** (`build:zip` + upload/publish via [chrome-webstore-upload](https://github.com/fregante/chrome-webstore-upload-cli)) |

**Repository secrets** (Settings → **Secrets and variables** → **Actions**). Two *different* systems:

| Secret name | What it is |
|-------------|------------|
| **`CHROME_WEBSTORE_CLIENT_ID`** | Google Cloud **OAuth client ID** for the [Chrome Web Store Publish API](https://developer.chrome.com/docs/webstore/api) |
| **`CHROME_WEBSTORE_CLIENT_SECRET`** | Same client’s **client secret** |
| **`CHROME_WEBSTORE_REFRESH_TOKEN`** | **Refresh token** for the **Google account** that owns the Store listing (obtain via [chrome-webstore-upload-keys](https://github.com/fregante/chrome-webstore-upload-keys) flow) |
| **`CHROME_WEBSTORE_EXTENSION_ID`** | Store item ID (this repo: `haicdejjcnecapheflpdpdngflffejpf`) |
| **`EXTENSION_PRODUCTION_GITHUB_OAUTH_CLIENT_ID`** | FilOzone **production** GitHub OAuth app Client ID (Store callback: `haicdejj…chromiumapp.org`) |
| **`EXTENSION_PRODUCTION_GITHUB_OAUTH_CLIENT_SECRET`** | Same GitHub app’s **client secret** — compiled into the zip’s `service-worker.js` for **Connect GitHub** |

The **Google** four authenticate **Google’s API** to upload your package. The **GitHub** pair are the same **production** values you use locally when running **`npm run build:zip`** for release—they are **not** the Chrome API credentials.

If any secret is missing, the workflow step fails; do not echo secrets in logs.
</think>


<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
Read

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
