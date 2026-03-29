# UI contract: Global boards + checkboxes

**Consumer**: Content script + service worker ([`extension/src`](../../extension/src)).  
**Spec**: [spec.md](../spec.md).

## Section

| Attribute | Value |
|-----------|--------|
| Title | `Global boards` |
| Marker | `data-filoz-global-boards="1"` |

## Row layout

Each row MUST include, in order:

1. **Checkbox** (`input type="checkbox"`) — reflects **membership**; **disabled** while loading per [spec edge cases](../spec.md#edge-cases).
2. **Label** — the board's **actual project title** (e.g. `FOC`) fetched from GitHub via `QUERY_PROJECT_V2`; rendered as **plain text** (`<label>` element, no `<a>` inside). Clicking the label toggles the checkbox.

**No navigation link** — FR-003 was removed. Links inside a picker dropdown break the native UX pattern. The row's only action is membership toggle via the checkbox.

## Service worker messages (contract sketch)

Implementations MUST define typed message(s) in [`messages.ts`](../../extension/src/lib/messages.ts) and handle them in [`service-worker.ts`](../../extension/src/background/service-worker.ts). Minimal surface:

### Fetch state

**Request** (example name: `GET_GLOBAL_BOARDS_STATE`):

```json
{
  "type": "GET_GLOBAL_BOARDS_STATE",
  "payload": {
    "owner": "filecoin-project",
    "name": "FIPs",
    "number": 1111,
    "kind": "issue"
  }
}
```

**Response** (`ok: true`):

```json
{
  "ok": true,
  "contentNodeId": "node id for Issue or PullRequest",
  "rows": [
    {
      "url": "https://github.com/orgs/FilOzone/projects/14",
      "projectId": "PVT_kw…",
      "itemId": "PVTI_lADO…",
      "label": "FOC"
    }
  ]
}
```

`itemId` is **null** (or omitted) when not on that board. Rows omit **invalid** URLs.

### Add (existing)

[`ADD_TO_PROJECT`](../../extension/src/lib/messages.ts): `{ projectId, contentNodeId }` → `{ ok, error? }`.

### Remove (new)

**Request** (example: `DELETE_PROJECT_ITEM`):

```json
{
  "type": "DELETE_PROJECT_ITEM",
  "payload": { "itemId": "PVTI_lADO…" }
}
```

**Response**: `{ "ok": true }` | `{ "ok": false, "error": "…" }`.

Exact JSON shape MAY add fields but MUST preserve **ok/error** pattern for UI handling.

## Theming

Use GitHub **CSS variables** for checkbox label, row hover, and errors (`--fgColor-*`, `--bgColor-*`, `--borderColor-*`). No link-specific colors needed.

## Non-goals

- **Bulk** add to multiple boards in one mutation.
- **Server-side** caching of membership beyond the open menu lifecycle (MVP: re-fetch on each open is acceptable).
