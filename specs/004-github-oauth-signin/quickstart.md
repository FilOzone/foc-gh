# Quickstart: Verify GitHub OAuth + PAT options (004)

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Prereqs

- Chromium with **Developer mode** extensions.
- This repo built: from repository root, `npm install && npm run build` (set `GITHUB_OAUTH_CLIENT_ID` for OAuth tests).
- For PRs, copy the checklist in [pr-smoke-checklist.md](./pr-smoke-checklist.md) into the PR description.
- A **GitHub OAuth App** registered for development (after implementation):  
  **Authorization callback URL** = `chrome.identity.getRedirectURL()` for your
  **unpacked** extension ID (shown on `chrome://extensions` → extension details).
- **Client ID** available at build/runtime per implementation (see [research.md](./research.md)).

## Load unpacked

1. Open `chrome://extensions` → **Load unpacked** → select `extension/dist/`
   (or the built output path your `npm run build` uses).

## Manual scenarios (post-implementation)

Record results in the PR **smoke checklist** (see [plan.md](./plan.md)).

### OAuth — happy path

1. Open extension **Options**.
2. Ensure **Connect GitHub** (or equivalent) is visible; click it.
3. Complete GitHub **Authorize**; return to options.
4. Confirm **connected** state and that **Run API checks** succeeds (existing
   diagnostics block).

### OAuth — cancel

1. Start Connect; **close** or cancel the auth tab.
2. Confirm options show **not connected** and a calm message.

### PAT — still works

1. **Disconnect** if connected via OAuth.
2. Paste a valid PAT; choose PAT mode; **Save**.
3. Confirm API checks and a sample issue/PR link check succeed.

### Switch OAuth → PAT

1. Connect via OAuth; then choose **Use PAT** / clear OAuth per UI copy; paste
   PAT; Save.
2. Confirm **only PAT** is used (e.g. revoke OAuth app in GitHub settings; API
   still works with PAT).

### Theme

1. Toggle OS **light** and **dark**; reopen Options; confirm text, inputs, and
   buttons remain readable.

### Reference URLs

Use pages listed in
[`.specify/memory/dev-debug-loop.md`](../../.specify/memory/dev-debug-loop.md)
for issue/PR behavior after auth is configured.
