# Data Model: FOC Project Board sidebar presentation

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-03-27

## Entities

### PageContext

Derived from the current URL (issue vs pull request).

| Field | Description |
|-------|-------------|
| `owner` | Repository owner login |
| `name` | Repository name |
| `number` | Issue or PR number |
| `kind` | `issue` \| `pull_request` |

### ExtensionProjectConfig

Existing configuration: which GitHub Project(s) to surface as “FOC” (project
node id, title display string, org).

| Field | Description |
|-------|-------------|
| `projectId` | GitHub Projects v2 `ProjectV2` node ID |
| `title` | Card title shown to user (e.g. “FOC”) |
| `optionalRelatedIds` | Additional cards if product requires (YAGNI default: one primary) |

### ProjectItemView

Runtime view model for the current issue/PR row on the board.

| Field | Description |
|-------|-------------|
| `itemId` | `ProjectV2Item` node id |
| `projectId` | Parent project id |
| `fieldValues[]` | List of field value snapshots (see below) |

### FieldDefinition

From GitHub `field` definition on the project.

| Field | Description |
|-------|-------------|
| `id` | Field node id (for mutations) |
| `name` | Display label (e.g. “Dev Days Estimate”) |
| `dataType` | Normalized type enum (see FieldType) |
| `options` | For single select: `{ id, name, color? }[]` |
| `configuration` | Iteration settings, etc., opaque JSON subset as needed |

### FieldValueSnapshot

| Field | Description |
|-------|-------------|
| `fieldId` | References FieldDefinition |
| `text` | Plain text value if applicable |
| `number` | Numeric if applicable |
| `singleSelectOptionId` | Selected option id if applicable |
| `iterationId` | Iteration value if applicable |
| `raw` | Fallback display string for read-only |

### FieldType (normalized)

Internal enum mapping GitHub Projects field kinds:

- `STATUS`
- `SINGLE_SELECT`
- `TEXT` / `TITLE` (read-only title usually omitted from editable rows)
- `NUMBER`
- `DATE` / `ITERATION` (treat per API shape)
- `UNSUPPORTED` — render read-only or hide per spec edge cases

### WidgetPresentationState

| Field | Description |
|-------|-------------|
| `expanded` | Boolean; chevron state |
| `pendingMutationFieldId` | Optional: field currently saving |
| `lastError` | Optional: user-visible short error |

## Validation rules

- Mutations MUST NOT send empty patch for unchanged values (skip no-op updates).
- Number fields: reject non-numeric input before request; show inline validation.
- Select fields: option id MUST exist in `FieldDefinition.options`.

## State transitions

```
expanded: false --(chevron click)--> true
expanded: true --(chevron click)--> false

field idle --(user edit)--> pendingMutationFieldId set
pending --(success)--> idle, FieldValueSnapshot updated
pending --(error)--> idle, lastError set, optionally refetch
```

## Relationships

- One **PageContext** maps to at most one **ProjectItemView** per configured
  **ExtensionProjectConfig** project for items linked to that issue/PR.
- **FieldValueSnapshot** entries belong to one **ProjectItemView** and reference
  **FieldDefinition** from the same project.
