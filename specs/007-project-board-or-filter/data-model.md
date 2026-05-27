# Data Model: Project Board OR Filter

**Branch**: `007-project-board-or-filter` | **Date**: 2026-05-27

## Entities

### ORQuery

Parsed representation of a filter string containing OR syntax.

| Field | Type | Description |
|-------|------|-------------|
| `prefix` | `string` | Shared filter terms before the first parenthesized group (may be empty) |
| `branches` | `string[]` | Array of filter conditions, one per OR branch (contents of each parenthesized group) |
| `raw` | `string` | Original unparsed query string |

**Validation rules**:
- At least 2 branches required
- No nested parentheses within branches
- No filter terms after the final closing parenthesis
- No `OR` keyword inside parentheses
- Maximum 5 branches (practical limit from tpm-utils spec)

**Examples**:
- `cycle:202605-2 biglep (-status:"🎉 Done") OR (-last-updated:1days)`
  → `{ prefix: "cycle:202605-2 biglep", branches: ['-status:"🎉 Done"', "-last-updated:1days"] }`
- `(-status:"🎉 Done") OR (-last-updated:1days)`
  → `{ prefix: "", branches: ['-status:"🎉 Done"', "-last-updated:1days"] }`

### MemexPaginatedResponse (Grouped)

API response from `/memexes/{id}/paginated_items` when `groupedBy` is specified.

| Field | Type | Description |
|-------|------|-------------|
| `groups` | `{ nodes: GroupNode[] }` | Group definitions with metadata |
| `groupedItems` | `Record<number, GroupItems>` | Items organized by group index |
| `slices` | `Record<number, SliceInfo>` | Slice/category breakdowns |
| `totalCount` | `{ value: number, isApproximate: boolean }` | Total items matching the filter |

### MemexPaginatedResponse (Flat)

API response for pagination continuation (no grouping).

| Field | Type | Description |
|-------|------|-------------|
| `nodes` | `MemexItem[]` | Array of project items |
| `pageInfo` | `{ hasNextPage: boolean, endCursor: string }` | Pagination cursor |
| `slices` | `Record<number, SliceInfo>` | Slice/category breakdowns |
| `totalCount` | `{ value: number, isApproximate: boolean }` | Total items matching the filter |

### GroupNode

| Field | Type | Description |
|-------|------|-------------|
| `groupValue` | `string` | Display name (e.g., "🐱 Todo") |
| `groupId` | `string` | Base64-encoded unique identifier |
| `groupMetadata` | `{ id, name, nameHtml, color, description, descriptionHtml }` | Display metadata |
| `totalCount` | `{ value: number, isApproximate: boolean }` | Items in this group |
| `fieldMetrics` | `unknown[]` | Field-level aggregation metrics |

### GroupItems

| Field | Type | Description |
|-------|------|-------------|
| `groupId` | `string` | Matches `GroupNode.groupId` |
| `nodes` | `MemexItem[]` | Items in this group |
| `pageInfo` | `{ hasNextPage: boolean, endCursor: string }` | Pagination within group |

### MemexItem

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | **Deduplication key** — unique project item ID |
| `contentId` | `number` | ID of the underlying Issue or PR |
| `contentType` | `"Issue" \| "PullRequest"` | Type discriminator |
| `contentRepositoryId` | `number` | Repository ID |
| `priority` | `number \| null` | Item priority |
| `virtualPriority` | `string` | Sort key for priority ordering |
| `updatedAt` | `string` (ISO 8601) | Last update timestamp |
| `createdAt` | `string` (ISO 8601) | Creation timestamp |
| `state` | `string` | Issue/PR state (open, closed, merged) |
| `memexProjectColumnValues` | `ColumnValue[]` | Field values for this item |
| `content` | `object` | Nested issue/PR metadata (title, labels, assignees, etc.) |

### ColumnValue

| Field | Type | Description |
|-------|------|-------------|
| `memexProjectColumnId` | `string \| number` | Column identifier (e.g., "Title", "Status", or numeric ID) |
| `value` | `object` | Column-type-specific value object |

### ViewConfig

Extracted from `#memex-views` script tag. Defines the current view's parameters needed for API calls.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | View ID |
| `number` | `number` | View number (in URL) |
| `name` | `string` | Display name |
| `filter` | `string` | Default filter for this view |
| `layout` | `string` | Layout type (e.g., "table_layout") |
| `groupBy` | `number[]` | Column IDs to group by |
| `sortBy` | `[number, string][]` | Column ID + direction pairs |
| `visibleFields` | `number[]` | Column IDs to include in response |

## State Transitions

```
IDLE → OR_DETECTED → FETCHING → MERGING → RENDERED
  │                                           │
  │         ← (user changes filter) ←────────┘
  │
  └── (no OR syntax) → PASS_THROUGH (native filtering)
```

| State | Description |
|-------|-------------|
| `IDLE` | No active OR query; normal board behavior |
| `OR_DETECTED` | OR syntax parsed from filter input; preparing to intercept |
| `FETCHING` | Making paginated_items API calls for each branch |
| `MERGING` | All branches fetched; merging and deduplicating |
| `RENDERED` | Merged data returned to React app; board displays combined results |
| `PASS_THROUGH` | No OR syntax; fetch interception disabled, native behavior |

## Relationships

```
ORQuery 1──* QueryBranch (prefix + branch = complete filter)
     │
     ▼ (one API call per branch)
MemexPaginatedResponse *──* MemexItem (items from all branches)
     │
     ▼ (merge + deduplicate by item.id)
MergedResponse 1──* MemexItem (union, no duplicates)
     │
     ▼ (returned to React app)
Board UI renders naturally
```
