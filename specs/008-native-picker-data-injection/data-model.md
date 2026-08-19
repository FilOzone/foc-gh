# Data Model: Native Picker Data Injection

Entities are in-memory/message-level structures; no new persistent storage beyond existing extension config.

## InjectedBoard

One configured global board, resolved from extension options at page load.

| Field | Type | Source | Used by |
|-------|------|--------|---------|
| `nodeId` | string (`PVT_...`) | config / existing SW resolution | issue feed node, Relay edge, mutation observation |
| `databaseId` | number | GraphQL `databaseId` (resolve once, cache in config) | PR `projects_suggestions` row id, PR form field key |
| `title` | string | config / board query | feed rows |
| `number` | number | config | feed node `number`, `search_slug` |
| `orgLogin` | string | config | dedupe (skip when equals repo owner), `url`, `search_slug` |
| `url` | string | derived | feed node `url` |
| `viewerCanUpdate` | boolean | existing board-access resolution | feed node; gates actionability |

Validation: a board with unresolved `databaseId` is still injectable on issue pages (node id suffices) but skipped on PR pages with a console warning.

## MembershipState

Per (item, board) resolution, from the existing `GET_GLOBAL_BOARDS_STATE` service-worker path.

| Field | Type | Notes |
|-------|------|-------|
| `contentNodeId` | string (`I_...` / `PR_...`) | current page item |
| `boardNodeId` | string | key to InjectedBoard |
| `status` | `unknown` \| `member` \| `not-member` | `unknown` until resolved; never rendered as checked (FR-010) |
| `itemId` | string (`PVTI_...`) \| null | required for removal and for the Relay edge |
| `fieldValueByName` | object \| null | Status value for native sidebar rendering (optional enrichment) |

State transitions: `unknown -> member|not-member` (initial resolve); `not-member -> member` (observed native add or delegated PR add, captures `itemId`); `member -> not-member` (observed native delete or delegated PR remove).

## ProjectItemsEdge (Relay commit payload)

Shape mirrored from GitHub's own mutation response (research.md). Minimum viable record set for the connection commit:

```
edge:   { node: ProjectV2Item }
node:   { id: <itemId>, isArchived: false, project: ProjectV2Node }
project:{ id, title, closed, number, url, viewerCanUpdate, hasReachedItemsLimit,
          template, field (Status ProjectV2SingleSelectField summary), __typename: "ProjectV2" }
```

Connection record id: `client:<contentNodeId>:__ProjectSection_projectItems_connection(allowSameEnterprise:true)`.

## Persister entry (IndexedDB seed target)

DB `offline_cache_v2::<login>::queries`, store `queries`, key `key-["item_picker","projects",{"owner":"<owner>","query":"","repo":"<repo>"}]` (alphabetical property order). Augment `state.data.recentOwnerProjects` (array of feed node shapes) in place; leave `dataUpdatedAt` untouched.

## Message contracts

See [contracts/messages.md](contracts/messages.md).
