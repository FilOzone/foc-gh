# FOC GH

Browser extension for **FOC TPMs and team members** working in **GitHub**.

Chromium **Manifest V3** extension that connects day-to-day issue and PR work to the **FilOzone FOC** Projects v2 board—without living only inside the project UI.

## Features

1. **FOC project board from cross-org issues and PRs** — Manage the board (add items, edit fields where the API allows) from GitHub issues and pull requests on configured repos, with a native-style sidebar and **autosave** for supported field types (single select, number, text, iteration).
2. **Global auto-expand for project panels** — Optional setting so GitHub’s right-hand **Project** panel **auto-expands** for issues and PRs (works across projects, not only FOC).

## For developers

Install from source, build (`npm run build`), **Chrome Web Store** ZIP (`npm run build:zip`), OAuth credentials, and the **Options** page are documented in **[extension/README.md](extension/README.md)** (from the **repository root**, not from `extension/` alone). That guide lists the **local** extension ID (stable via committed `extension/manifest-id-public.b64`) vs the **Chrome Web Store** listing ID, and links to FilOzone’s **two** GitHub OAuth apps (dev vs prod).

## Build & distribution

| Need | Where |
|------|--------|
| **Local unpacked** build, stable extension ID, dev OAuth | [extension/README.md](extension/README.md) — *Local / unpacked* and *Extension IDs* |
| **Chrome Web Store** ZIP (no `manifest.key`), production OAuth | [extension/README.md](extension/README.md) — *Chrome Web Store ZIP* |
| OAuth apps, callbacks, FilOzone links | [docs/github-oauth-app.md](docs/github-oauth-app.md) |
| Env vars, Actions secret names | [.env.example](.env.example) |
| Manual smoke checklist (CI, zip, local) | [specs/005-build-distribution-workflows/quickstart.md](specs/005-build-distribution-workflows/quickstart.md) |

CI: **`.github/workflows/extension-ci.yml`** runs on push/PR (see developer guide).

## Documentation

- **[extension/README.md](extension/README.md)** — Build, FilOzone OAuth (dev vs production), PAT vs **Connect GitHub**, configuration
- [docs/github-pat-permissions.md](docs/github-pat-permissions.md) — PAT / OAuth scope reference
- [docs/github-oauth-app.md](docs/github-oauth-app.md) — OAuth app registration and callback URLs
- [specs/](specs/) — Feature specs and plans
