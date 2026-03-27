# GitHub token permissions for this extension

The extension calls **`https://api.github.com/graphql`** as **your** user. The token
must allow:

1. **Reading and writing** the **organization Project (Projects v2)** that owns the
   board (default: FilOzone project 14).
2. **Reading** Issues and Pull Requests in each **target repository** (default:
   `filecoin-project/curio`, `filecoin-project/filecoin-pin`) so it can resolve
   `contentId` and read `projectItems`.

Org **roles** still apply: if you cannot add or edit items in the FilOzone project
in the GitHub UI, the API will reject the same operations even with a correctly
scoped token.

Official overview: [Using the API to manage Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects).

---

## Classic personal access tokens

Create at: **Settings → Developer settings → Personal access tokens → Tokens (classic)**.

### Minimum for “see board state” only (read panel, no add / no field edit)

| Scope | Why |
|-------|-----|
| **`read:project`** | Read organization/user Projects v2 data (`projectV2`, item field values, etc.). |
| **Repository access** | Must be able to read Issues/PRs on target repos. Use **`public_repo`** if every target repo is **public**; use **`repo`** if any target repo is **private** (simplest: use `repo` if unsure). |

### Full features (add to board + update Status)

| Scope | Why |
|-------|-----|
| **`project`** | Read **and** write Projects v2 (add items, update field values). Includes what `read:project` covers for projects. |
| **`repo`** | Recommended if any target work lives in **private** repositories; also covers public repo content. |
| **`public_repo`** | Possible **only** if all target repos are **public** and you are not relying on private issue/PR APIs. |

Optional:

| Scope | When |
|-------|------|
| **`read:org`** | Rarely required for this use case if `project`/`read:project` already expose org projects you can access; add if GraphQL returns org-level permission errors. |

If GraphQL returns **`INSUFFICIENT_SCOPES`** or **`RESOURCE_NOT_ACCESSIBLE`**, open
the token’s scope list and match the table above, then rotate the token in **extension
options**.

---

## Fine-grained personal access tokens

Create at: **Settings → Developer settings → Personal access tokens → Fine-grained tokens**.

Configure **Resource owners** and **repository access** explicitly.

### Organization that **owns** the project board (e.g. FilOzone)

Under **Organization permissions** for that org:

| Permission | Access level | Why |
|------------|--------------|-----|
| **Projects** | **Read and write** | Load `projectV2`, list/update fields, add items, set Status. |

**Read-only** Projects may be enough to **view** linked state but will **fail** on
**Add to FOC project** or **Update Status**.

### Repositories whose **issues/PRs** you open in the browser (e.g. `filecoin-project/*`)

Add each repository (or use “All repositories” only if policy allows). Under
**Repository permissions**:

| Permission | Access level | Why |
|------------|--------------|-----|
| **Issues** | **Read-only** at minimum | Resolve issue `id`, read `projectItems` on issues. |
| **Pull requests** | **Read-only** at minimum | Same for PR pages. |

If a repo is **private**, the token must include that repository; **Metadata** read
is usually included by default for selected repos.

Fine-grained tokens can be picky: if something still fails, compare with a **classic**
token using `project` + `repo`/`public_repo` to isolate whether the limitation is
token shape vs org/repo policy.

---

## OAuth app (future)

An OAuth app’s user access token needs the **same effective** API access as above:
GitHub maps OAuth scopes to the same GraphQL capabilities (e.g. `project` for
mutations). MVP options UI documents “OAuth placeholder” until a flow ships.

---

## Quick verification

With the token saved in **extension options**:

- A minimal check is any successful `viewer { login }` **plus** opening a target-repo
  issue and seeing the panel load without `INSUFFICIENT_SCOPES` in GraphQL errors.
- **Add** and **Status** require **write** project access as in the tables above.
