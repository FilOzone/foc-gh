# Data model: Cross-org FOC project controls

**Feature**: [spec.md](./spec.md)

## Runtime entities (GitHub domain)

### Issue or PullRequest (page subject)

| Field | Description |
|--------|-------------|
| `owner` | Repository owner login (e.g. `filecoin-project`) |
| `name` | Repository name |
| `number` | Issue or PR number |
| `kind` | `issue` \| `pull_request` |
| `node_id` | Global GraphQL node id (`contentId` for project mutations) |

**Source**: Parsed from `github.com/{owner}/{name}/issues/{n}` or `/pull/{n}` URL.

### Tracked organization projects (configuration)

Each entry is parsed from a **project URL** of the form
`https://github.com/orgs/{org}/projects/{number}` (or future equivalent).

| Field | Description |
|--------|-------------|
| `org_login` | Organization owning the project |
| `project_number` | Numeric Projects v2 number in that org |
| `source_url` | Canonical URL as stored in settings |
| `node_id` | Resolved `ProjectV2` global id (cached per entry) |

**MVP default** (built-in if storage empty): a single board —
`https://github.com/orgs/FilOzone/projects/14` ([FOC · FilOzone](https://github.com/orgs/FilOzone/projects/14)).

### Project item (when linked)

| Field | Description |
|--------|-------------|
| `item_id` | `ProjectV2Item` node id for mutations on that row |
| `field_values` | Map of display name → value (status, cycle, estimate, …) |

Relationships: **Issue/PR** `1…N` **ProjectItem** (across boards). With multiple
**tracked projects**, the UI may show one section per board; **add** / **field
update** actions apply to the relevant board’s item (MVP can start with a
single configured board before generalizing).

## Local configuration (`chrome.storage` / options)

### Cross-org scope (non-secret)

| Key | Type | Purpose |
|-----|------|---------|
| `cross_org_board_urls` | `string[]` | Project pages to surface on matching repos. **Default**: `["https://github.com/orgs/FilOzone/projects/14"]`. |
| `cross_org_target_repos` | `string[]` | Full names `owner/repo` where the panel may load. **Default**: `["filecoin-project/curio", "filecoin-project/filecoin-pin"]`. |
| `status_field_name` | `string` | **Primary single-select column name** for sidebar ordering (e.g. which field appears first in multi-select editors). Options UI can **load** real `SINGLE_SELECT` names from `ProjectV2.fields`. **Default**: `Status`. |

Injection runs only when the current page’s `owner/repo` is in
`cross_org_target_repos` (after normalization to lowercase). No “all repos”
toggle unless added later.

### API authentication (secret)

| Key | Type | Purpose |
|-----|------|---------|
| `github_api_token` | `string` (secret) | Bearer token for **`api.github.com`** — used for **GraphQL** (`POST /graphql`) and **REST** (`GET`/`POST` under `/orgs/.../projectsV2/...` as implemented). **OAuth access token** (preferred) or **classic/fine-grained PAT** if the user pastes one. |
| `github_token_kind` | `"oauth"` \| `"pat"` (optional) | For UI/help text and revocation instructions. |

The extension **does not** read GitHub’s web **session cookie** and send it to
`api.github.com` as a supported credential—see [research.md](./research.md).

### Runtime discovery (not persisted)

- **Board column definitions** (`ProjectV2.fields`: name, `dataType`, single-select
  options, iteration configuration samples) are fetched when loading the issue
  panel and in options (“Load columns from primary board”). Results are **not**
  stored long-term in `chrome.storage`; they reflect the board at request time.

## Validation rules

- Valid API token present before GraphQL calls; prompt for **Connect GitHub** /
  paste PAT if missing.
- `cross_org_board_urls` must parse to at least one resolvable `ProjectV2`.
- `cross_org_target_repos` must be non-empty for MVP behavior (or fall back to
  built-in defaults).
- Mutations only after explicit user gesture (except initial read on load).
