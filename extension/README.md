# FOC GH — developer guide

This directory is the extension **source tree** ([manifest.json](manifest.json), [src/](src/), [icons/](icons/)); builds and loads are driven from the **repository root** (see [../README.md](../README.md)).

For **what the extension does** and the feature bullets, see the [project README](../README.md).

## Build

From the **repository root**:

```bash
npm install
npm run build
```

### Switching development vs production GitHub OAuth (local)

You maintain **two** GitHub OAuth apps (dev vs Store). The build **embeds** one pair into [dist/service-worker.js](dist/service-worker.js) per run:

| Command | OAuth **profile** | Which env vars (first match wins) |
|---------|-------------------|-------------------------------------|
| **`npm run build`** | `development` | **`GITHUB_OAUTH_CLIENT_ID_DEVELOPMENT`** / **`GITHUB_OAUTH_CLIENT_SECRET_DEVELOPMENT`**, else **`GITHUB_OAUTH_CLIENT_ID`** / **`GITHUB_OAUTH_CLIENT_SECRET`** |
| **`npm run build:zip`** | `production` | **`GITHUB_OAUTH_CLIENT_ID_PRODUCTION`** / **`GITHUB_OAUTH_CLIENT_SECRET_PRODUCTION`**, else plain **`GITHUB_OAUTH_*`** (CI uses this; local: set prod suffixed vars to avoid mixing) |

**Recommended:** Put **all four** suffixed variables in **`.env.local`** ([`.env.example`](../.env.example)) so you never comment lines—`npm run build` vs **`npm run build:zip`** picks the profile automatically.

Override: from the repository root, **`node scripts/build.mjs --oauth-profile=production`** ([scripts/build.mjs](../scripts/build.mjs)), or env **`FOC_GH_OAUTH_PROFILE=production`**.

A production build that falls back to plain **`GITHUB_OAUTH_*`** prints a **warning**—use **`…_PRODUCTION`** when you also keep dev shorthand in the same file.

### Local / unpacked (step-by-step)

1. From the **repository root**: `npm install`.
2. Add **`.env.local`** with dev credentials (**`GITHUB_OAUTH_*_DEVELOPMENT`** or plain **`GITHUB_OAUTH_*`** — see table above). FilOzone dev app: [FilOzone OAuth apps](#filozone-oauth-apps-development-and-production).
3. Run **`npm run build`**. Console shows **`OAuth profile (embedded): development`** and **Stable extension ID** / **OAuth redirect** for the unpacked ID.
4. Open **`chrome://extensions`**, enable **Developer mode**, **Load unpacked**, choose **[dist/](dist/)** (build output under this directory).
5. **Options** → **Connect GitHub** — callback must match the **dev** OAuth app.

**OAuth at build time:** **`.env.local`** is loaded automatically; shell vars already set are **not** overwritten by dotenv.

**Chrome Web Store:** [manifest.json](manifest.json) **`description`** must be **at most 132 characters** (Google rejects longer values). **`npm run build`** exits with an error if it is too long.

### Extension IDs: local (unpacked) vs Chrome Web Store

| Channel | Extension ID | How the ID is determined | OAuth redirect URL (register on GitHub) |
|--------|---------------|---------------------------|----------------------------------------|
| **Local unpacked** ([dist/](dist/) after `npm run build`) | **`akbchnphednohmffplmejpefockadcbg`** | Pinned by **`manifest.key`**, which **`npm run build`** sets from the committed public key [manifest-id-public.b64](manifest-id-public.b64) (RSA public key, DER as base64). Same folder → same ID on every machine; not derived from the directory path. | `https://akbchnphednohmffplmejpefockadcbg.chromiumapp.org/` |
| **Chrome Web Store** (this listing) | **`haicdejjcnecapheflpdpdngflffejpf`** | Assigned by Google for the listing. The store **forbids** `manifest.key` in uploaded `manifest.json`, so **`npm run build:zip`** strips **`key`** before zipping—local and store IDs **cannot** match while using this workflow. | `https://haicdejjcnecapheflpdpdngflffejpf.chromiumapp.org/` |

**Rebuild check:** After `npm run build`, the console must still print **`Stable extension ID (manifest key): akbchnphednohmffplmejpefockadcbg`**. If you replace [manifest-id-public.b64](manifest-id-public.b64), this ID and the dev OAuth callback change—coordinate with the team.

**Stable extension ID (OAuth) — detail:** The committed [manifest-id-public.b64](manifest-id-public.b64) is the **public** half of a key pair. Only that file is in git (private key is not kept). Chromium derives the **local** extension ID from that public key material when it appears as **`manifest.key`** in [dist/manifest.json](dist/manifest.json).

- **Connect GitHub** only works if **both** variables were set at build time; they are compiled into [dist/service-worker.js](dist/service-worker.js). Do not commit real secrets.
- **Load unpacked** from **[dist/](dist/)** in **`chrome://extensions`** (**Developer mode** on) → **Load unpacked**.

### Publishing a new version to Chrome Web Store

1. **Bump the version** in both `extension/manifest.json` and `package.json` — the Web Store rejects uploads with the same version as the current listing.
2. **`npm run publish:chrome`** — builds the production ZIP (with production OAuth credentials), uploads, and publishes.
3. **Rebuild for dev**: `npm run build` — restores development OAuth credentials and adds `-dev` suffix to the version in `extension/dist/`.
4. **Commit and push** the version bump.

Requires `CHROME_WEBSTORE_*` and `GITHUB_OAUTH_*_PRODUCTION` credentials in `.env.local` (see [`.env.example`](../.env.example)).

### Chrome Web Store account

The extension is published under biglep@filoz.org (personal developer account, publisher ID `2270af3f`). The `CHROME_WEBSTORE_*` credentials in `.env.local` are for this account's Google Cloud project.

- [Dev console (account)](https://chrome.google.com/webstore/devconsole/2270af3f-be41-4cb8-aec8-040cb9627f74)
- [Dev console (FOC GH package)](https://chrome.google.com/webstore/devconsole/2270af3f-be41-4cb8-aec8-040cb9627f74/haicdejjcnecapheflpdpdngflffejpf/edit/package)
- [Public listing](https://chromewebstore.google.com/detail/foc-gh/haicdejjcnecapheflpdpdngflffejpf)

A group publisher (`chrome-webstore-group-publisher@filoz.org`, publisher ID `cc8e8ca4`) also exists but has no extensions. The listing could be transferred there in the future to decouple it from a personal account.

### Chrome Web Store ZIP and upload (reference)

Build a **Store-ready ZIP** (manifest and assets at the **root** of the archive — required by Google):

```bash
npm run build:zip
```

**`npm run build:zip`** runs a **production** OAuth profile (embeds **`…_PRODUCTION`** or plain **`GITHUB_OAUTH_*`**). Use the FilOzone **production** app whose callback matches the **Store** extension ID (see [Extension IDs](#extension-ids-local-unpacked-vs-chrome-web-store)). A zip built with **dev** credentials still uploads, but **Connect GitHub** breaks for Store installs.

Writes **[foc-gh-webstore.zip](../foc-gh-webstore.zip)** at the repo root (gitignored). [scripts/zip-dist.mjs](../scripts/zip-dist.mjs) **drops `manifest.key`** from packaged **`manifest.json`** — the Store **rejects** uploads that include **`key`**. Your **Web Store extension ID** will **not** match the unpacked [dist/](dist/) ID; use the **production** GitHub OAuth app/callback (see below).

Upload that file in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole), or use the CLI (after [OAuth setup](https://github.com/fregante/chrome-webstore-upload-keys)):

| Script | What it does |
|--------|----------------|
| **`npm run build:zip`** | `npm run build` + write **`foc-gh-webstore.zip`**. |
| **`npm run upload:chrome`** | Upload **`foc-gh-webstore.zip`** only (no publish). Requires **`CHROME_WEBSTORE_CLIENT_ID`**, **`CHROME_WEBSTORE_CLIENT_SECRET`**, **`CHROME_WEBSTORE_REFRESH_TOKEN`**, **`CHROME_WEBSTORE_EXTENSION_ID`** in **`.env.local`** or the environment ([`.env.example`](../.env.example)). |
| **`npm run publish:chrome`** | **`build:zip`**, then **upload + publish** (default CLI behavior — teammates with the listing URL see the new version after review). |

**Note:** Those four names are **Google Cloud OAuth** credentials for the [Chrome Web Store Publish API](https://developer.chrome.com/docs/webstore/api), **not** your GitHub OAuth app. [scripts/chrome-webstore.mjs](../scripts/chrome-webstore.mjs) maps them to the names the upload CLI expects; this repo does **not** read unprefixed `CLIENT_ID` / `CLIENT_SECRET`. Put values in **`.env.local`** (loaded by the script) or in GitHub Actions secrets (see **Publish from CI** below).

**Service account?** The usual Chrome Web Store flow is a **Google OAuth client** (Desktop / “Chrome app” / installed app) plus a **refresh token** for the **publisher Google account** that owns the listing—see [chrome-webstore-upload-keys](https://github.com/fregante/chrome-webstore-upload-keys) and Google’s [Publish API](https://developer.chrome.com/docs/webstore/api) docs. That is **not** the same as dropping a GCP **service account JSON** into CI; if Google adds or changes machine-to-store auth, update this repo’s env docs when you adopt it.

### FilOzone OAuth apps (development and production)

FilOzone maintains **two** organization-owned **GitHub OAuth Apps**—**one per extension ID**, because GitHub allows **one authorization callback URL per app**:

| Channel | OAuth app (org admin links — requires FilOzone permission) | Extension ID | Authorization callback URL |
|--------|------------------------------------------------------------|----------------|----------------------------|
| **Development** (unpacked [dist/](dist/)) | [FilOzone OAuth App — FOC GH dev](https://github.com/organizations/FilOzone/settings/applications/3490509) | `akbchnphednohmffplmejpefockadcbg` | `https://akbchnphednohmffplmejpefockadcbg.chromiumapp.org/` |
| **Production** (Chrome Web Store install) | [FilOzone OAuth App — FOC GH prod](https://github.com/organizations/FilOzone/settings/applications/3491974) | `haicdejjcnecapheflpdpdngflffejpf` | `https://haicdejjcnecapheflpdpdngflffejpf.chromiumapp.org/` |

Use the **development** app’s Client ID + secret in `.env.local` when building for **Load unpacked**; use the **production** app’s credentials when building **`foc-gh-webstore.zip`** for release. Full setup: [`docs/github-oauth-app.md`](../docs/github-oauth-app.md).

### Continuous integration

Workflow: [.github/workflows/extension-ci.yml](../.github/workflows/extension-ci.yml).

| Trigger | What runs |
|---------|-----------|
| **`push`** to **`main`** | `npm ci` → `npm run typecheck` → `npm run build` |
| **`pull_request`** | Same |

**Secrets** (repository → **Settings** → **Secrets and variables** → **Actions**): set **`GITHUB_OAUTH_CLIENT_ID`** and **`GITHUB_OAUTH_CLIENT_SECRET`** for **Connect GitHub** to be wired in CI-built output. Use **development** app values if the workflow only validates compile; use **production** values for release automation. **Fork PRs** do not receive these secrets—`npm run build` still runs with empty OAuth strings (compile check only).

Do **not** print OAuth values in workflow logs.

### Publish to Chrome Web Store (manual CI)

Workflow: [.github/workflows/chrome-webstore-publish.yml](../.github/workflows/chrome-webstore-publish.yml).

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
| **`EXTENSION_PRODUCTION_GITHUB_OAUTH_CLIENT_SECRET`** | Same GitHub app’s **client secret** — compiled into the zip’s [dist/service-worker.js](dist/service-worker.js) for **Connect GitHub** |

The **Google** four authenticate **Google’s API** to upload your package. The **GitHub** pair are the same **production** values you use locally when running **`npm run build:zip`** for release—they are **not** the Chrome API credentials.


## Configure

1. Open the extension **Options** page.
2. Choose **Sign in with GitHub** or **Personal access token**:
   - **OAuth**: **Connect GitHub** (requires build with OAuth env vars above).
   - **PAT**: classic or fine-grained token per **[PAT permissions](../docs/github-pat-permissions.md)**.
3. Adjust board URLs or target repos (defaults include `filecoin-project/curio`, `filecoin-project/filecoin-pin`, `filecoin-project/FIPs`, `filecoin-project/filecoin-pin-website`, `filecoin-project/github-mgmt`; default board [orgs/FilOzone/projects/14](https://github.com/orgs/FilOzone/projects/14)).

The extension does **not** use your `github.com` session cookie as a bearer for `api.github.com`; see [research.md](../specs/001-cross-org-board-ui/research.md).

### PAT permissions (summary)

Use a **classic** PAT. Fine-grained tokens are **not supported** (see [`docs/github-pat-permissions.md`](../docs/github-pat-permissions.md)).

| Need | Classic scopes |
|------|----------------|
| View panel / linked state | `read:project` + `public_repo` or `repo` |
| Add item + edit Status | **`project`** + `public_repo` or `repo` |

Full tables: [`docs/github-pat-permissions.md`](../docs/github-pat-permissions.md).

### OAuth scopes (Connect GitHub)

**Connect GitHub** uses OAuth **PKCE** plus a **client secret** at token exchange (build-time). Requested scopes match PAT capability: **`repo`**, **`read:org`**, **`project`**. Only one of OAuth or PAT is active at a time.

## Dev workflow: reloading the extension

Two reload approaches are available. Use whichever matches your Chrome setup.

### Option A: CDP reload (recommended for AI-agent workflows)

**`node scripts/cdp-reload.mjs`** reloads the extension via Chrome DevTools Protocol — instant, no timeouts. It also refreshes any open GitHub tabs so content scripts reconnect.

**Requires Chrome launched with a dedicated dev profile:**

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --remote-allow-origins='*' \
  --user-data-dir="$HOME/.chrome-dev-profile"
```

**Why a separate `--user-data-dir`?** Since Chrome 136, `--remote-debugging-port` is **silently ignored** when using the default user data directory (`~/Library/Application Support/Google/Chrome`). This is a deliberate security hardening — no error is printed, the port simply doesn't open. Passing a non-default `--user-data-dir` satisfies the requirement.

**You cannot point `--user-data-dir` to your existing default profile** — Chrome recognizes the default path and still blocks the debug port. Copying the default profile to another location would technically work but risks corruption if both instances run simultaneously. The dev profile is lightweight and only needs one-time setup:

1. Launch Chrome with the command above.
2. **Load unpacked** the extension at `chrome://extensions` → select `extension/dist/`. This persists across restarts (unlike `--load-extension` which is ephemeral).
3. Log in to GitHub and configure the extension PAT in **Options**.

**Service worker logs:** `node scripts/sw-logs.mjs` streams service worker console output via CDP auto-attach. Note: Chrome MV3 service workers go idle quickly and may not appear in CDP targets. The log streamer waits and reconnects automatically when the SW activates, but very short-lived activations may be missed.

### Option B: AppleScript reload (works with default Chrome profile)

**`osascript scripts/reload-extension.applescript`** finds an open `chrome://extensions` tab and clicks the reload button via shadow DOM traversal.

**Advantages:** Works with your normal Chrome profile — no special launch flags, all your extensions and cookies are present.

**Limitations:**
- Requires a `chrome://extensions` tab to be open (errors if not found).
- Occasionally times out with `AppleEvent timed out (-1712)` when Chrome is busy.
- Does not refresh GitHub tabs after reload — content scripts in already-open tabs become orphaned and need a manual page refresh.

### Extension ID notes

The unpacked extension ID is pinned to **`akbchnphednohmffplmejpefockadcbg`** by `manifest.key` (derived from [manifest-id-public.b64](manifest-id-public.b64)). This works with both **Load unpacked** in `chrome://extensions` and the CDP dev profile.

**Do not use `--load-extension`** to sideload — while it loads the extension initially, it does not persist across Chrome restarts and the extension does not appear in the `chrome://extensions` UI, making it impossible to reload or inspect.

## Verify

[quickstart.md](../specs/001-cross-org-board-ui/quickstart.md), [manual verification](../docs/manual-verification.md), and OAuth flow notes in [specs/004-github-oauth-signin/quickstart.md](../specs/004-github-oauth-signin/quickstart.md).

## Privacy

Tokens and settings live in `chrome.storage.local` on your machine only—no project-hosted token backend (spec EXT-003).
