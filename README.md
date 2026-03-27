# FOC GH

Browser extension for **FOC TPMs and team members** working in **GitHub**.

Chromium **Manifest V3** extension that connects day-to-day issue and PR work to the **FilOzone FOC** Projects v2 board—without living only inside the project UI.

## Features

1. **FOC project board from cross-org issues and PRs** — Manage the board (add items, edit fields where the API allows) from GitHub issues and pull requests on configured repos, with a native-style sidebar and **autosave** for supported field types (single select, number, text, iteration).
2. **Global auto-expand for project panels** — Optional setting so GitHub’s right-hand **Project** panel **auto-expands** for issues and PRs (works across projects, not only FOC).

## For developers

Install from source, build, OAuth credentials, and the **Options** page are documented in **[extension/README.md](extension/README.md)** (build from the **repository root**, not from `extension/` alone).

## Documentation

- **[extension/README.md](extension/README.md)** — Build, FilOzone OAuth (dev vs production), PAT vs **Connect GitHub**, configuration
- [docs/github-pat-permissions.md](docs/github-pat-permissions.md) — PAT / OAuth scope reference
- [docs/github-oauth-app.md](docs/github-oauth-app.md) — OAuth app registration and callback URLs
- [specs/](specs/) — Feature specs and plans
