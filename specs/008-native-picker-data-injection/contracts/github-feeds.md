# Contract: Intercepted GitHub data feeds

All shapes verified live 2026-08-19 (research.md). Every interception MUST fail open: on any parse/augment error, return the untouched original response and `console.warn`.

## 1. Issue picker feed (augment)

`GET https://github.com/_ghui/item-pickers/projects?owner=<org>&repo=<repo>&queryId=<sha>` (also fired with `query=<text>` during picker search)

Augment: unshift `{ node }` into `data.repository.owner.recentProjects.edges` for each InjectedBoard where `orgLogin !== owner` and no edge with the same `node.id` exists anywhere in the feed.

Node shape (all fields mandatory; validated client-side by GitHub):

```json
{ "id": "PVT_...", "title": "...", "closed": false, "number": 14,
  "url": "https://github.com/orgs/<org>/projects/<n>",
  "viewerCanUpdate": true, "hasReachedItemsLimit": false, "__typename": "ProjectV2" }
```

Notes: `data.repository.recentProjects` (no `.owner.`) is parsed by GitHub but never rendered; do not rely on it. When `query=` is present, only inject boards whose title matches the query caselessly (GitHub also refilters client-side, so over-injection is safe but wasteful).

## 2. Issue viewer data (augment when membership resolved)

`GET https://github.com/_graphql?body=<urlencoded JSON>` where decoded `body.persistedQueryName === "IssueViewerViewQuery"`.

Augment: append ProjectItemsEdge (data-model.md) to the issue's `projectItems.edges` when MembershipState is `member`. The response is Relay-normalized; sibling-field parity is required (copy the full edge shape from a native same-org member response or the mutation response).

## 3. Native issue mutation (observe only)

`POST https://github.com/_graphql` with `persistedQueryName: "updateIssueProjectsRelayMutation"` (persisted id `b695a1b44dfc6808873f990340430ce1` at time of research; match by name, not id).

Observe requests whose `variables.input.projectId` is a configured board: on add response, capture `addProjectV2ItemById.projectEdge.node.id` as `itemId` (`projectEdge: null` means already-member no-op). Notify the content script to update the SW membership cache. Watch for the delete variant during validation (expected `deleteProjectV2Item`-style persisted mutation) and mirror the handling.

## 4. Relay store commit (issues, hard nav / late membership)

Not a network contract: locate the Relay environment from the React fiber tree (context provider whose value has `commitUpdate`/`getStore`), then insert ProjectItemsEdge into connection record `client:<issueNodeId>:__ProjectSection_projectItems_connection(allowSameEnterprise:true)`. Idempotent: skip if an edge with the same item id exists. Failure is logged and leaves feed-level augmentation (contract 2) as sole coverage.

## 5. IndexedDB persister seed (issues, first open)

DB `offline_cache_v2::<login>::queries` (login from `meta[name="user-login"]`), store `queries`, key `key-["item_picker","projects",{"owner":"<owner>","query":"","repo":"<repo>"}]`. If present and missing an injected board, unshift the feed node shape into `state.data.recentOwnerProjects` and put back. Absent DB/entry: no-op.

## 6. PR picker feed (augment, legacy UI)

`GET /<owner>/<repo>/projects/issues/projects_suggestions?access_level=write&issue_number=<n>&scope=recent`

Augment: unshift into `projects`:

```json
{ "id": <databaseId>, "name": "<title>", "owner": "<orgLogin>", "type": "memex_project",
  "template": false, "selected": <membership === member>, "search_slug": "<orgLogin>/<number>" }
```

Skip `scope=repository|organization` (avoids duplicates; Recent is always shown first). Skip boards whose org equals the repo owner.

## 7. PR sidebar form toggle (intercept + delegate, legacy UI)

`POST /<owner>/<repo>/projects/issues/<n>` multipart form with `_method=put`, `authenticity_token`, and `issue_memex_project_ids[<id>]=on` per checked project. GitHub silently ignores cross-org ids (verified), so:

- Diff the form's injected-board ids against MembershipState to derive intended add/remove per board.
- Remove injected-board fields from the form, then pass the request through (or skip the native call entirely if no native ids changed).
- Dispatch the add/remove intent to the content script -> service worker GraphQL path (`ADD_TO_PROJECT` / `DELETE_PROJECT_ITEM`), update MembershipState on completion, and surface failures via console warning plus the existing SW error paths (picker reopen shows the true state).
