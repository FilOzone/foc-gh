# Quickstart: Build and distribution (feature 005)

Use this during implementation to validate **spec** scenarios.

## Local / unpacked (stable ID)

1. Clone repo; `npm install`
2. Copy `.env.example` → `.env.local`; set **local-channel** `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` (OAuth app whose callback is the **unpacked** redirect).
3. `npm run build`
4. Note console lines: **Stable extension ID** and **OAuth redirect** — must match GitHub OAuth app.
5. Chrome → `chrome://extensions` → **Load unpacked** → `extension/dist`
6. Options → **Connect GitHub** → confirm no `redirect_uri` mismatch.

## Store package (no `manifest.key`)

1. Set **store-channel** OAuth credentials in env (often a second OAuth app).
2. `npm run build:zip`
3. Inspect zip: `unzip -p foc-gh-webstore.zip manifest.json` — confirm **no** `"key"` field.
4. Upload to [Chrome Web Store Developer Console](https://chrome.google.com/webstore/devconsole) (or internal pipeline).
5. Install from listing; **Connect GitHub** should use **store** callback (`https://<store-id>.chromiumapp.org/`).

## CI smoke (`.github/workflows/extension-ci.yml`)

1. Push a branch or open a PR; confirm the **Extension CI** workflow is **green**.
2. **Fork PRs**: repository secrets are **not** passed to the workflow; `npm run build` still runs (OAuth env empty = compile-only). Same-repo PRs and `main` builds receive **`GITHUB_OAUTH_CLIENT_ID`** / **`GITHUB_OAUTH_CLIENT_SECRET`** when configured—confirm logs never print those values.
3. Optional: add **`Actions`** secrets with those exact names (see `.env.example`) so `Connect GitHub` works in CI-produced `extension/dist` if you download artifacts later (not required for pass/fail).

## Manual PR checklist (auth / build touch)

- [ ] `npm run typecheck`
- [ ] `npm run build` — ID + redirect logged
- [ ] `npm run build:zip` — manifest in zip has no `key`
- [ ] Docs updated for any new env var or workflow name

## Implementer smoke log (copy into PR when touching build/auth)

| Check | Result |
|-------|--------|
| `npm run typecheck` | |
| `npm run build` | |
| `npm run build:zip` + `unzip -p foc-gh-webstore.zip manifest.json` has no `"key"` | |
| `extension-ci.yml` triggers on PR | |

Fill results in the PR description for reviewers (speckit T011).
