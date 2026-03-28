# Contract: Build channels and environment

**Feature**: [spec.md](./spec.md)

## Commands (npm)

| Command | Preconditions | Outputs | `manifest.key` in output manifest |
|---------|----------------|---------|-------------------------------------|
| `npm run build` | `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` optional at compile but required for working **Connect GitHub**; `extension/manifest-id-public.b64` present | `extension/dist/**` | **Yes** (local stable ID) |
| `npm run build:zip` | Successful `npm run build` (script invokes build) | `foc-gh-webstore.zip` at repo root (gitignored) | **No** (stripped in zip) |

## Environment variables (OAuth → service worker)

| Variable | Required when | Consumed by |
|----------|----------------|------------|
| `GITHUB_OAUTH_CLIENT_ID_DEVELOPMENT` / `GITHUB_OAUTH_CLIENT_SECRET_DEVELOPMENT` | **`npm run build`** (default **development** profile) when set | `scripts/build.mjs` |
| `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` | **Development** profile fallback, or **production** profile when suffixed prod vars unset | Same |
| `GITHUB_OAUTH_CLIENT_ID_PRODUCTION` / `GITHUB_OAUTH_CLIENT_SECRET_PRODUCTION` | **`npm run build:zip`** (**production** profile) when set | Same |

**Channel contract**: Embedded credentials MUST match the GitHub OAuth App whose **Authorization callback URL** matches `https://<extension-id>.chromiumapp.org/` for that build’s profile (local stable ID vs Store listing ID).

## Chrome Web Store Publish API (optional)

Separate from GitHub OAuth — see `.env.example`: **`CHROME_WEBSTORE_CLIENT_ID`**, **`CHROME_WEBSTORE_CLIENT_SECRET`**, **`CHROME_WEBSTORE_REFRESH_TOKEN`**, **`CHROME_WEBSTORE_EXTENSION_ID`** (**Google** credentials). **`scripts/chrome-webstore.mjs`** maps these to the upload CLI’s expected env names. Not required for FR-006 build verification.

## CI expectations

- Workflows MAY pass `GITHUB_OAUTH_*` from **secrets** to **npm run build** / **build:zip** on trusted branches.
- Workflows MUST NOT print these variables to logs.

## Versioning

- Contract changes (new env vars, new outputs) require updating `.env.example`, `extension/README.md` or `docs/github-oauth-app.md`, and this file together.
