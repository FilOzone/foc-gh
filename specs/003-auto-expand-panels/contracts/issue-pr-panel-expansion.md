# Contract: Issue/PR project panel expansion preference

**Feature**: 003 — Auto-expand project panels  
**Date**: 2026-03-27

## Purpose

Document the **user-visible contract** between extension **options**, **stored
configuration**, and **issue/PR sidebar** behavior without tying consumers to
internal module names.

## Options → storage

| UI control | Storage key (logical) | Value | Semantics |
|------------|------------------------|-------|------------|
| “Expand project field sections on issue & pull request pages” (working title) | `issue_pr_projects_auto_expand` (TBD exact constant) | `true` / `false` | `true`: after load, extension card body shows fields without user opening chevron (subject to session override below). `false`: body starts collapsed. |

- **Migrate**: absence of key ⇒ treat as **`true`**.
- **Apply on save**: `chrome.storage.local.set`; no server round trip.

## Content script behavior

**Given** a supported issue or PR page and a mounted FOC card:

1. **Initial paint**: Body expanded iff `(preference === true && !sessionCollapsed) || sessionExpanded`.
2. **After panel state load succeeds**: If `preference === true` and user has **not** set session for this item, **force expanded** once (covers late hydration).
3. **Chevron click**: Toggle body; persist choice in **sessionStorage** for this item key.

## Out of scope (MVP)

- Programmatic expansion of **GitHub-native** project sidebar rows.
- Sync storage / roaming profile (local only).

## Manual verification (PR checklist excerpt)

- [ ] Options: toggle off → open issue → body **collapsed**; Status row still visible.
- [ ] Options: toggle on → open issue → body **expanded** after load.
- [ ] Same tab: collapse on issue A → navigate to issue B → B follows pref (per-item session key).
- [ ] Light + dark: only chevron/body visibility changes; no theme regression.
