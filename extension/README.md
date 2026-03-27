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
npm run build
```

Load **unpacked** from `extension/dist/` in `chrome://extensions` (Developer mode).

## Configure

1. Open the extension **Options** page.
2. Paste a **GitHub PAT** (classic or fine-grained) or OAuth access token that meets
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

MVP is **PAT-only** in options. A GitHub OAuth App + “Connect GitHub” flow can replace
paste-token UX later without changing GraphQL calls.

## Verify

Follow [quickstart.md](../specs/001-cross-org-board-ui/quickstart.md) and
[manual verification](../docs/manual-verification.md).

## Privacy

Token and settings stay in `chrome.storage.local` on your machine only. No project-hosted
token backend (see spec EXT-003).
