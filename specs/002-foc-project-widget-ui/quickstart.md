# Quickstart: verifying FOC Project Board sidebar work

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-03-27

## Build and load

1. From repository root (where `package.json` lives): install deps and build
   (`npm install`, `npm run build` — exact scripts per `package.json`).
2. Chromium → **Extensions** → **Load unpacked** → select `extension/dist/`
   (or `extension/` if manifest points at built files per repo layout).
3. Ensure a **PAT** or configured auth is present in the extension options (per
   existing flows).

## Manual QA matrix (copy into PR)

| # | Case | URL / steps | Light | Dark | Pass |
|---|------|-------------|-------|------|------|
| 1 | Issue with FOC item + Milestone | FilOzone issue | ☐ | ☐ | |
| 2 | PR cross-org + native project + FOC | e.g. `filecoin-project` PR linked to FOC | ☐ | ☐ | |
| 3 | PR Files tab | Same PR, `/files` | ☐ | ☐ | |
| 4 | Autosave Status + text + single select | Edit three fields, full reload | ☐ | ☐ | |
| 5 | Expand/collapse | Chevron hides/shows field body | ☐ | ☐ | |
| 6 | API error | Airplane mode or invalid token | ☐ | ☐ | |

## Appearance reference

Compare side-by-side with **FilOzone** native FOC project card screenshot and the
**filecoin-project** PR mockup provided with the spec. Typography and spacing
should “read” as GitHub-native.

## Regression targets

- `manifest.json`, `host_permissions`, storage: smoke checklist required by
  constitution if touched.
- No console errors on issue vs PR conversation layouts.
