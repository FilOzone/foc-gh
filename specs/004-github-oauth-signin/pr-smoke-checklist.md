# PR smoke checklist — 004 GitHub OAuth + PAT options

Copy into the PR description when landing this feature.

## Manifest

- [ ] `extension/manifest.json` includes `"identity"` under `permissions` (OAuth redirect flow).
- [ ] No new broad host permissions beyond existing `https://github.com/*` and `https://api.github.com/*`.

## Auth

- [ ] **Connect GitHub** completes when **`GITHUB_OAUTH_CLIENT_ID`** and **`GITHUB_OAUTH_CLIENT_SECRET`** were set at build time and the OAuth App callback matches `chrome.identity.getRedirectURL()` (org-owned app documented in [`docs/github-oauth-app.md`](../../docs/github-oauth-app.md) when applicable).
- [ ] Cancel / close auth tab leaves options in a **not connected** state with a clear message.
- [ ] **Disconnect** clears OAuth session; **Run API checks** fails until re-auth or PAT save.
- [ ] **PAT** path: paste PAT, Save, API checks succeed.
- [ ] Switching OAuth → PAT (or PAT → OAuth) does not leave two active credentials (see options copy).

## UX

- [ ] Options page **light** and **dark** (OS theme): readable text, inputs, buttons.

## Docs

- [ ] [`docs/github-oauth-app.md`](../../docs/github-oauth-app.md) matches how you registered the OAuth App.
