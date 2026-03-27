# Contract: GitHub GraphQL (Projects V2)

**Consumer**: Browser extension background/service worker  
**Primary endpoint**: `POST https://api.github.com/graphql`  
**Companion**: GitHub **REST** `api.github.com` for Projects v2 items listing where used (see R3); same `Authorization: Bearer` token.  
**Auth**: `Authorization: Bearer <token>` where `<token>` is a **GitHub-issued
API credential**: OAuth user access token (from an extension “Connect GitHub”
flow) **or** a fine-grained / classic **PAT** the user pastes. The browser’s
**github.com session cookie** is **not** a supported substitute for this header
on the public API—see [research.md](../research.md).

**Versioning**: Pin expectations to GitHub’s public GraphQL schema; handle field
deprecations in implementation (no runtime schema fetch required for MVP).

## Operations (logical contract)

### R1 — Resolve primary `ProjectV2`

**Input**: `owner: String!`, `number: Int!`  
**Output**: `projectV2 { id title }`  
**Errors**: project not found, permission denied → user-visible message.

### R2 — Load Issue or PullRequest global id

**Input**: `owner`, `name`, `issueOrPrNumber`, `kind`  
**Output**: `repository { issue/pullRequest { id } }`  
**Errors**: 404, private repo without access.

### R3 — Read item on primary project (when exists)

**Step A — GraphQL link check**: Query `Issue` / `PullRequest` → `projectItems`
and match the node whose `project.id` equals the primary `ProjectV2` id (and/or
org + project number per existing helpers). When GitHub returns the link on
`projectItems`, use that `ProjectV2Item` id and its `fieldValues` fragment.

**Step B — REST fast path (no full-board GraphQL scan)**: If step A does not
yield a row, resolve the item with
`GET /orgs/{org}/projectsV2/{project_number}/items` using the board filter query
language (`q`, e.g. `repo:owner/name is:issue` plus issue/PR number as
appropriate). Match rows using GitHub’s **`content_type`** (`Issue` /
`PullRequest`) and repository + number. **Do not** paginate the entire board via
GraphQL `ProjectV2.items` as a fallback when this REST path is available—treat
“not found” after REST + client-side match as not on the board.

**Step C — Field values**: After obtaining a `ProjectV2Item` **node id**, load
`fieldValues` (GraphQL on the item, with fragments for single-select, number,
text, date, iteration, labels, milestone, repository, linked PRs, users,
reviewers, etc.) sufficient to render TPM-relevant columns.

**Output**: `projectV2Item { id fieldValues… }` (and board column definitions
from `ProjectV2.fields` where the product needs option lists / iteration
catalogs—separate query documented in implementation).

### R4 — Add content to primary project

**Mutation**: `addProjectV2ItemById`  
**Input**: `projectId`, `contentId`  
**Output**: `item { id }`  
**Idempotency**: GitHub returns existing item when already present—treat as
success.

### R5 — Update field on project item

**Mutation**: `updateProjectV2ItemFieldValue` (single-select, number, text—match
field type)  
**Input**: `projectId`, `itemId`, field id, value  
**Output**: updated item fragment or success flag.

## Error surface

| Condition | User message |
|-----------|----------------|
| `401` / `403` | Permissions or token scopes insufficient; link to docs |
| Rate limit | Back off; show retry hint |
| GraphQL `errors[]` | Map first `type` / message to plain language |

## Rate limiting

- Batch reads in one round-trip where possible.
- Debounce rapid field edits (optional UX polish).
