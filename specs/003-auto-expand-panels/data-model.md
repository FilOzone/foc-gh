# Data model: Auto-expand project panels (003)

**Branch**: `003-auto-expand-panels`  
**Date**: 2026-03-27

## Stored configuration (extension)

### `IssuePrProjectsAutoExpand` (preference)

| Field | Type | Default | Description |
|-------|------|---------|--------------|
| value | `boolean` | `true` | When `true`, extension project card **body** (field list) loads **expanded** on issue/PR pages unless the user has toggled collapse for **this** issue/PR in the current tab (see session overlay). When `false`, initial state is **collapsed** unless session says otherwise. |

**Persistence**: `chrome.storage.local` under key aligned with `STORAGE_KEYS` (exact key chosen in implementation; e.g. `issue_pr_projects_auto_expand`).  
**Surface**: Extension options page (checkbox + short help).  
**Not persisted server-side**.

### `StoredConfig` (aggregate extension settings)

Existing fields from `extension/src/lib/project-config.ts` plus:

| Field | Type | Required |
|-------|------|----------|
| `issuePrProjectsAutoExpand` | `boolean` | yes (read with default `true` when missing for migration) |

`loadConfig()` MUST return a boolean (never `undefined`) so content scripts can branch without extra guards.

## Session overlay (per tab, per issue/PR)

### `CardExpandedSession` (logical)

| Field | Type | Description |
|-------|------|-------------|
| storageKey | string | Derived from repo + number + kind (e.g. `filoz-foc-card-expanded:owner:name:kind:number`) |
| value | `'0' \| '1'` | User explicitly collapsed (`0`) or expanded (`1`) the body for this item in this tab |

**Rules**:

- If **no** session value: use **`issuePrProjectsAutoExpand`** as initial expanded state.
- If session value present: it **overrides** the preference until cleared (tab close clears session).

## UI entity: `FocProjectCard` (existing)

No schema change required beyond **constructor options**:

| Option | Type | Description |
|--------|------|-------------|
| `initialExpanded` | `boolean` | Seed before session overlay is applied (from preference). |
| `sessionStorageKey` | `string` | Per-item key for collapse memory (see research.md). |

## Validation

- Options page: coerce checkbox to boolean on save; omitting key on old profiles reads as `true`.

## State transitions

1. **Page load** → read preference + session → set `expanded`.
2. **User clicks chevron** → flip expanded → write session `'0'`/`'1'`.
3. **Panel data arrives** (pref `true`, no session for item yet) → ensure `expanded === true`.
