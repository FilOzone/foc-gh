# Contract: GitHub GraphQL (Projects V2)

**Consumer**: Browser extension background/service worker  
**Endpoint**: `POST https://api.github.com/graphql`  
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

**Preferred**: Query from `Issue` / `PullRequest` → `projectItems` filtered by
`project.id == primaryProjectId`, or equivalent pattern supported by current
schema.  
**Fallback**: If filtering is awkward, resolve item via project items search
cursor (higher cost—document if used).

**Output**: `projectV2Item { id fieldValues… }` sufficient to render Status and
agreed custom fields.

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
