# Quickstart: 003 Auto-expand project panels

**Branch**: `003-auto-expand-panels`

## Build

From repository root:

```bash
cd extension && npm install && npm run build
```

Load **unpacked** from `extension/` (or `extension/dist` per your manifest) in Chrome/Edge.

## Configure

1. Open extension **Options**.
2. Toggle **“Sidebar: expand project field sections on issues & pull requests”** (checkbox above **Primary single-select column**).
3. Click **Save** (options page persists token, boards, repos, status column, and this preference together).

## Manual QA (happy paths)

1. **Preference on** (default): open a target-repo **issue** with FOC data → field body **expanded** after loading finishes; Status row visible.
2. **Preference off**: same URL → body **collapsed**; chevron opens fields.
3. **Cross-org**: use an issue under `filecoin-project/…` linked to configured FilOzone board → same expand/collapse behavior as in-org (no API difference).
4. **Pull request**: repeat on a specific **PR** URL for the same repo.
5. **Session**: with preference **on**, collapse card on issue A; open issue B in same tab → B should **start expanded** (per-item session key; session key includes issue/PR kind, owner, repo, and number).

## PR verification (US2)

Cross-org (`filecoin-project/…` + FilOzone board) and same-org scenarios MUST show the same expand/collapse behavior: logic uses only `issuePrProjectsAutoExpand` and per-item `sessionStorage`, not repo/board org. No extra GitHub API calls.

## Themes

Verify **light** and **dark** GitHub appearance: expansion only toggles `hidden` on body; colors unchanged from spec 002.

## Regression

- No new token scopes; diagnostics and **GET_PANEL_STATE** still work.
- `manifest.json` unchanged for this feature unless bundler paths require edits (not expected).
