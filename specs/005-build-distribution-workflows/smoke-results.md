# Smoke results (T011) — implementer run

**Date**: 2026-03-27  
**Environment**: local `npm ci` / `npm run typecheck` / `npm run build` / `npm run build:zip`

| Check | Result |
|-------|--------|
| `npm run typecheck` | Pass |
| `npm run build` | Pass — logged `akbchnphednohmffplmejpefockadcbg` + OAuth redirect |
| `foc-gh-webstore.zip` manifest has no `"key"` | Pass (`grep` found no `"key"`) |
| `extension-ci.yml` | Added; merge to **main** / open PR to confirm Actions run on GitHub |

_Copy table into PR description when opening the PR for this work._
