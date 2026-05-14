# GitHub token permissions for this extension

The extension calls **`https://api.github.com/graphql`** as **your** user. The token
must allow:

1. **Reading and writing** the **organization Project (Projects v2)** that owns the
   board (default: FilOzone project 14).
2. **Reading** Issues and Pull Requests in each **target repository** (default:
   `filecoin-project/curio`, `filecoin-project/filecoin-pin`, `filecoin-project/FIPs`, `filecoin-project/filecoin-pin-website`, `filecoin-project/github-mgmt`) so it can resolve
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

## Fine-grained personal access tokens — not supported

**Fine-grained tokens do not work reliably** with this extension. GitHub's
fine-grained PAT system has limited and inconsistent support for Projects v2
cross-org operations. Use a **classic PAT** (above) or **OAuth** (below) instead.

---

## OAuth app

An OAuth app’s user access token needs the **same effective** API access as above:
GitHub maps OAuth scopes to the same GraphQL capabilities (e.g. `project` for
mutations).

---

## OAuth (authorization code + PKCE)

When using **Connect GitHub** in extension options, the OAuth app requests these
**classic OAuth scopes** (space-separated), which match the PAT capability above:

| Scope | Role |
|-------|------|
| **`repo`** | Repository content (issues/PRs) on target repos, including private when needed. |
| **`read:org`** | Read org metadata (projects, membership) when required for Projects v2. |
| **`project`** | Read and write organization Projects (v2) — add items, update fields. |

Register the OAuth App callback as `https://<extension-id>.chromiumapp.org/` (see
[`github-oauth-app.md`](./github-oauth-app.md)). Build with `GITHUB_OAUTH_CLIENT_ID` and
`GITHUB_OAUTH_CLIENT_SECRET` (secret is embedded in the service worker; do not commit it).

## Quick verification

With the token saved in **extension options** (OAuth or PAT):

- A minimal check is any successful `viewer { login }` **plus** opening a target-repo
  issue and seeing the panel load without `INSUFFICIENT_SCOPES` in GraphQL errors.
- **Add** and **Status** require **write** project access as in the tables above.
