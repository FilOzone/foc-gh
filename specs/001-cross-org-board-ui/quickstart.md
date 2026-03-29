# Quickstart: Cross-org FOC project controls (dev)

**Feature**: [spec.md](./spec.md)

## Prerequisites

- Chromium browser (Chrome, Arc, Brave, Edge)
- GitHub account with access to the **FilOzone** FOC board and cross-org repos
  listed in settings

## Built-in defaults ([data-model.md](./data-model.md))

- **Boards**: `https://github.com/orgs/FilOzone/projects/14`
- **Repos**: `filecoin-project/curio`, `filecoin-project/filecoin-pin`, `filecoin-project/FIPs`, `filecoin-project/filecoin-pin-website`, `filecoin-project/github-mgmt`

The extension shows the panel only on issue/PR pages for repos in
**cross-org target repos**. It reads/writes the configured **organization
project(s)** via the official GraphQL API.

## API access (not the browser cookie)

You **cannot** rely on “already logged into github.com” to call
`api.github.com/graphql`. Configure **one** of:

1. **OAuth (recommended UX)** — implement “Connect GitHub”; user approves in the
   browser; store the returned **access token** locally.
2. **PAT** — user pastes a token that satisfies **[github-pat-permissions.md](../../docs/github-pat-permissions.md)** (Projects read/write on the board org; Issues/PR read on target repos).

See [research.md](./research.md) for why session cookies are not used as bearer
tokens.

## One-time setup

1. Clone [foc-gh](https://github.com/FilOzone/foc-gh)
   (or use this working tree).
2. Implement or generate the extension skeleton per [plan.md](./plan.md) (MV3).
3. In the browser, open **Extensions** → **Load unpacked** → select the build
   output directory (e.g. `extension/dist` once build exists).

## Configure

1. Open the extension **Options** page.
2. Complete **Connect GitHub** (OAuth) or paste a **PAT** under advanced.
3. Confirm **Cross-org boards** includes
   `https://github.com/orgs/FilOzone/projects/14` (default).
4. Confirm **Cross-org repos** lists the five default `filecoin-project/…` repos
   (see [data-model.md](./data-model.md)).

## Verify

1. Open a **cross-org** issue that is **already** on the FOC board—panel should
   show status / key fields.
2. Open a cross-org issue **not** on the board—**Add to FOC project** should
   link it.
3. Change **Status** (or one configured field)—refresh [the FOC project](https://github.com/orgs/FilOzone/projects/14) to confirm.

## Troubleshooting

- **Empty panel**: confirm current repo is in **cross-org target repos**; check
  token scopes; confirm board URL matches project number **14**.
- **GraphQL errors**: copy `errors[0].message` into an issue with redacted ids.
  **`INSUFFICIENT_SCOPES`**: see [github-pat-permissions.md](../../docs/github-pat-permissions.md).
