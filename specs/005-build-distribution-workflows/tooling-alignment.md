# Tooling alignment (T001)

**Date**: 2026-03-27  
**References**: [spec.md](./spec.md), [contracts/build-channels.md](./contracts/build-channels.md)

## `scripts/build.mjs`

- Injects **`manifest.key`** from committed **`extension/manifest-id-public.b64`** into the in-memory manifest written to **`extension/dist/manifest.json`**. Matches contract: local artifact includes **`key`** for stable extension ID.
- Logs **Stable extension ID** and **OAuth redirect** for verifier FR-007.
- Does **not** require **`GITHUB_OAUTH_*`** for the build to complete (empty strings compile); **Connect GitHub** needs both at build time per docs.

## `scripts/zip-dist.mjs`

- Packages **`extension/dist/`** and writes **`manifest.json`** into the zip **without** **`key`**. Matches contract and store policy.

## Gaps (none blocking)

- Optional future: fail **`npm run build`** when OAuth vars are missing (opt-in flag)—currently spec allows docs-only guardrails; deferred.
- CI: implemented in `.github/workflows/extension-ci.yml` (see tasks T008).
