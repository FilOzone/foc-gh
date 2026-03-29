# Data model: Global boards picker (rev 2)

## Config (existing)

| Key | Type | UX label (options) |
|-----|------|---------------------|
| `cross_org_board_urls` | `string[]` | **Global board URLs** (one per line) |
| `cross_org_target_repos` | `string[]` | **Default repos for inline global board display** (controls page-load card display only; gear picker runs on all pages) |

## Page context

| Field | Source | Use |
|-------|--------|-----|
| `owner`, `name`, `number`, `kind` | [`pageContextFromLocation`](../../extension/src/lib/github-url.ts) | API calls, visibility |
| `contentNodeId` | GraphQL node id for Issue or PullRequest | `addProjectV2ItemById` **contentId** |

## Visibility (FR-006)

Define `showGlobalBoardsSection(repoOwner: string, boardUrls: string[]): boolean`:

- Parse each URL with [`parseOrgProjectUrl`](../../extension/src/lib/project-config.ts).
- Let `orgs =` distinct non-null parsed orgs (lowercase).
- If **no** valid org project URLs → **false**.
- **true** iff **∃** parsed org `o` such that `o !== repoOwner.toLowerCase()`.
- Equivalently: **false** when **every** valid board org **equals** `repoOwner` (in-org-only configuration).

## Runtime: per-board row state

| Field | Type | Notes |
|-------|------|--------|
| `url` | `string` | Trimmed user config |
| `projectId` | `string` | GraphQL ID |
| `itemId` | `string \| null` | `ProjectV2Item` id if member; else `null` |
| `label` | `string` | Board's **actual project title** fetched from GitHub (e.g. `"FOC"`); plain text — no link |
| `loading` | `boolean` | While membership/mutation in flight |
| `error` | `string \| null` | Last user-visible error for this row |

## State transitions (checkbox)

```
loading=true → (success) loading=false, checked ∈ {true,false} from itemId
             → (failure) loading=false, revert checkbox, error set

user checks   → if itemId null → ADD mutation → itemId set or error
user unchecks → if itemId set  → DELETE mutation → itemId null or error
```

## Entities (spec alignment)

- **Program board URL (Global board)**: configured URL.
- **Project item membership**: `itemId !== null`.
- **Projects gear menu**: native surface hosting injected **Global boards**.
