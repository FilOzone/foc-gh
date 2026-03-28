# FOC GH — developer guide

This directory is the **extension source**; builds and loads are driven from the **repository root** (parent of `extension/`).

For **what the extension does** and the feature bullets, see the [project README](../README.md).

## Build

From the **repository root**:

```bash
npm install
npm run build
```

**OAuth at build time:** If **`.env.local`** exists at the repo root (see [`.env.example`](../.env.example)), `npm run build` loads it automatically. Variables already set in your shell (or CI) are **not** overwritten. You can still `export GITHUB_OAUTH_CLIENT_ID=…` manually when you prefer.

**Chrome Web Store:** `extension/manifest.json` **`description`** must be **at most 132 characters** (Google rejects longer values). **`npm run build`** exits with an error if it is too long.

**Stable extension ID (OAuth):** The committed file **`extension/manifest-id-public.b64`** holds the **RSA public key** (DER, base64) that **`npm run build`** copies into **`manifest.key`** in **`extension/dist/manifest.json`**. Everyone who loads **that** folder as **Load unpacked** gets the **same** extension ID (not path-dependent). The build prints **`Stable extension ID`** and **`OAuth redirect:`** — register that `https://….chromiumapp.org/` URL on your GitHub OAuth app. **Do not change** `manifest-id-public.b64` without coordinating a new OAuth callback.

- **Connect GitHub** only works if **both** variables were set at build time; they are compiled into `dist/service-worker.js`. Do not commit real secrets.
- **Load unpacked** from **`extension/dist/`** in **`chrome://extensions`** (**Developer mode** on) → **Load unpacked**.

### Chrome Web Store ZIP and upload

Build a **Store-ready ZIP** (manifest and assets at the **root** of the archive — required by Google):

```bash
npm run build:zip
```

Writes **`foc-gh-webstore.zip`** at the repo root (gitignored). The zip script **drops `manifest.key`** from **`manifest.json`** — the Store **rejects** uploads that include **`key`**. Your **Web Store extension ID** will **not** match the **unpacked `dist/`** ID; use a **separate** GitHub OAuth app/callback for production installs (see below).

Upload that file in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole), or use the CLI (after [OAuth setup](https://github.com/fregante/chrome-webstore-upload-keys)):

| Script | What it does |
|--------|----------------|
| **`npm run build:zip`** | `npm run build` + write **`foc-gh-webstore.zip`**. |
| **`npm run upload:chrome`** | Upload **`foc-gh-webstore.zip`** only (no publish). Requires an existing zip and env: **`CLIENT_ID`**, **`CLIENT_SECRET`**, **`REFRESH_TOKEN`**, **`EXTENSION_ID`** ([`.env.example`](../.env.example)). |
| **`npm run publish:chrome`** | **`build:zip`**, then **upload + publish** (default CLI behavior — teammates with the listing URL see the new version after review). |

**Note:** `CLIENT_ID` / `CLIENT_SECRET` here are **Google Cloud OAuth** credentials for the Publish API, **not** your GitHub OAuth app. Put them in **`.env.local`** (or CI secrets): **`scripts/chrome-webstore.mjs`** loads **`.env.local`** before calling the CLI, same idea as `npm run build`.

### FilOzone OAuth apps (development and production)

**Unpacked `extension/dist/`** uses a **stable** extension ID (see **Stable extension ID** above). **Chrome Web Store** packages **cannot** include **`manifest.key`**, so the **Store listing ID** is **different** from the dev ID—plan for **two** GitHub OAuth apps (one callback each): dev uses the build log **unpacked** redirect; production uses `https://<id-from-dashboard>.chromiumapp.org/` after you create or open the listing.

| Channel        | Typical use              | Credentials / callback |
|----------------|--------------------------|-------------------------|
| **Development** | Unpacked load from `extension/dist/` after `npm run build` | OAuth app callback = **`OAuth redirect`** from build log (same ID for all paths). |
| **Production**  | **Chrome Web Store** (e.g. unlisted)              | **Second** OAuth app: callback `https://<webstore-extension-id>.chromiumapp.org/` from the [dashboard](https://chrome.google.com/webstore/devconsole). Build releases with **that** app’s Client ID + secret. |

Use the matching app’s **Client ID** and **Client secret** in `.env.local` (or release CI) for each channel. Full setup: [`docs/github-oauth-app.md`](../docs/github-oauth-app.md).

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
