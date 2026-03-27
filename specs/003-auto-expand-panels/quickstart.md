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
2. Set the new **“Expand project field sections…”** (final copy TBD) checkbox as needed.
3. Save if the page uses an explicit Save control (current options use **Save** for all fields).

## Manual QA (happy paths)

1. **Preference on** (default): open a target-repo **issue** with FOC data → field body **expanded** after loading finishes; Status row visible.
2. **Preference off**: same URL → body **collapsed**; chevron opens fields.
3. **Cross-org**: use an issue under `filecoin-project/…` linked to configured FilOzone board → same expand/collapse behavior as in-org (no API difference).
4. **Pull request**: repeat on a specific **PR** URL for the same repo.
5. **Session**: with preference **on**, collapse card on issue A; open issue B in same tab → B should **start expanded** (per-item session key).

## Themes

Verify **light** and **dark** GitHub appearance: expansion only toggles `hidden` on body; colors unchanged from spec 002.

## Regression

- No new token scopes; diagnostics and **GET_PANEL_STATE** still work.
- `manifest.json` unchanged for this feature unless bundler paths require edits (not expected).
