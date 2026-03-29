# Research: Cross-org FOC project controls

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-03-26

## 1. How others solve “project board from the issue page” (especially cross-org)

### GitHub platform

- **API**: GitHub’s **Projects (new)** GraphQL supports **cross-organization** linking:
  `addProjectV2ItemById` accepts a `projectId` and a `contentId` (global node id of
  the Issue or PullRequest). This is the supported way automation and tools add
  items to an org-owned project when the issue lives in another org/repo. See
  GitHub’s docs on [using the API to manage projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects)
  and historical changelog notes on cross-org additions.
- **Web UI gap**: The native **right-hand “Projects”** panel on issue/PR pages is
  optimized for projects the UI considers “nearby” (same org / same visibility
  patterns). TPMs see **full project controls in-org** but **not** the same
  treatment for **`filecoin-project/*`** even when the issue is already on a
  **FilOzone** board—matching [tpm-utils#23](https://github.com/FilOzone/tpm-utils/issues/23).

### Community extensions

- **[Refined GitHub](https://github.com/refined-github/refined-github)** is a
  large open-source browser extension (TypeScript, many small “features” injected
  per page). It proves the pattern: **content scripts** + **`features.add`**
  page detection + DOM injection beside GitHub’s layout. It does **not**
  expose a supported way to “mount into GitHub’s React sidebar”; features inject
  adjacent DOM and listen to GitHub’s own events where documented for resilience.

### Prior art summary

| Approach | Pros | Cons |
|---------|------|------|
| **GraphQL from extension** (PAT or OAuth in user storage) | Full Projects V2 read/write; matches spec trust model | Requires token scopes; must handle rate limits and UI errors |
| **Userscript / bookmarklet** | Very fast to spike | Harder org rollout; weaker security story than MV3 |
| **Separate web app** | Centralized logic | Conflicts with “on the issue page” UX; needs hosting |

**Decision**: Use **GitHub GraphQL Projects V2** from a **Chromium MV3 extension**
(content script for UI + background/service worker for `api.github.com/graphql`).
Matches constitution (user-owned token, least privilege, documented scopes).

### Browser session cookies vs a real API token

- The “already logged in” state on `github.com` is carried by **HTTP cookies** and
  the web app’s own internals. Those credentials authenticate **HTML page loads**
  on github.com, **not** the documented **`https://api.github.com/graphql`**
  contract, which expects `Authorization: Bearer …` with a **PAT**, **OAuth user
  access token**, or GitHub App installation token ([Using the API to manage
  projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects)).
- Session cookies are **HttpOnly**; page JavaScript cannot read them. Extensions
  could use `chrome.cookies`, but **GitHub does not document** using raw web
  session cookies as bearer tokens on `api.github.com`; doing so would be
  unsupported and brittle.
- **OAuth in the extension** (authorization code or device flow): user signs in
  in the browser they already use; GitHub returns an **access token** the
  extension stores locally—**no manual PAT paste**, still a proper API credential.
- **Undocumented alternative** (not recommended for this internal tool unless
  explicitly accepted): replay **same-origin** GraphQL used by GitHub’s SPA with
  `fetch(..., { credentials: 'include' })` and reverse-engineered headers. Breaks
  when GitHub changes internals; higher maintenance and unclear ToS posture.

**Decision**: Plan for **Bearer token** against `api.github.com/graphql`, sourced
from **user-authorized OAuth** (preferred UX) or **optional PAT** in settings.

---

## 2. “Hook into” the existing GitHub Projects sidebar

- GitHub’s sidebar is **internal React**. There is **no** stable public API to
  render **inside** the native Projects card as a first-class child.
- **Practical approach** (used across the ecosystem): **visually align** an
  injected panel with the sidebar column (same width, typography, spacing) or
  insert a **compact “FOC program project”** card **immediately above/below**
  GitHub’s native block. Degrade to a floating/sidebar-attached panel if selectors
  change—per spec edge cases.
- **Decision**: Target **DOM adjacency + visual parity**, not React integration.

---

## 3. Configuration tradeoffs: hardcode vs generic

### A. Hardcoded **FOC project** only (simplest)

- **What**: Single `org/login + project number` (or global `projectId`) baked in
  defaults for FilOzone’s program board; optional **options page** override for
  dogfood.
- **Pros**: Smallest code, fewest queries, clearest TPM mental model (“this is the
  FOC board”), trivial compliance with spec “always unambiguous”.
- **Cons**: Not reusable for arbitrary boards without edit/rebuild.

**Recommendation for MVP**: **Yes** — ship with **known default** + **user
override in options** (still one active “primary” project at a time for
actions).

### B. Hardcoded **repo/org allowlist** (where the panel appears)

- **What**: Only inject on `github.com/filecoin-project/*` (and any other
  agreed host patterns).
- **Pros**: Fewer page runs, less surprise on unrelated repos, easier security
  review (“we only touch these URLs”).
- **Cons**: Must update list when new partner orgs appear.

**Recommendation**: **Start with allowlist** derived from tpm-utils#23 examples;
make **optional toggle** “enable on all repositories” for power users (default
off) if complexity stays low—otherwise defer.

### C. Generic: “show **all** projects this issue is on”

- **What**: On load, query the issue/PR node for **`projectItems`** connections
  (Projects V2) and render each project with expandable fields; FOC is one row
  among N—but actions default to configured primary.
- **Pros**: Best parity with reality when items sit on **multiple** boards;
  answers the user’s “any project boards associated” question.
- **Cons**: More GraphQL surface, more UI states; field schemas differ per
  project.

**API note**: Many implementations load `node(id: …) { … on Issue { projectItems { nodes { … } } } }`
(or PullRequest). If a given field is unavailable in your schema version, fall
back to **primary-project-only** queries.

**Recommendation**: **Phase 2** after MVP: add **read-only “other projects”**
list using `projectItems`, keep **mutations scoped to primary FOC project**
unless product asks otherwise.

---

## 4. Refined GitHub: contribution vs standalone extension

Per [Refined GitHub Contributing wiki](https://github.com/refined-github/refined-github/wiki/Contributing)
and [New Feature Request](https://github.com/refined-github/refined-github/wiki/New-Feature-Request):

- New features are expected to be **requested first** and accepted with
  **`help wanted`**; PRs without that are **likely closed on sight**.
- The project is **highly opinionated** and optimizes for **broad GitHub users**,
  not **FilOzone-internal program workflows** or **org-specific project IDs**.
- A feature that requires **every user** to paste a **personal token** with
  **`project`** / `read:org` scopes and encodes **FilOzone** board defaults is a
  **poor fit** for upstream unless generalized into a **fully generic**
  “cross-org project sidebar” with neutral defaults—still a heavy lift on review
  and maintenance.

**Decision for this plan**:

- **Primary delivery**: **Standalone** `tpm-utils-github-extension` (this repo),
  aligned with [internal constitution](../../.specify/memory/constitution.md).
- **Refined GitHub path** (optional, weekly idea): Open a **discussion issue**
  proposing a **generic** pattern; **do not block** FilOzone MVP on upstream
  acceptance. If upstream wants it, **extract** shared GraphQL helpers later.

---

## 5. Consolidated technical choices (for `plan.md`)

| Topic | Choice |
|-------|--------|
| Transport | GitHub GraphQL `POST https://api.github.com/graphql` |
| Auth | **OAuth user access token** (preferred) or **PAT**; **not** github.com session cookies as `Bearer` on this API—document scopes in options |
| MVP scope | **Configured project URLs** (default [FOC project](https://github.com/orgs/FilOzone/projects/14)); **configured repos** (defaults in [data-model.md](./data-model.md)) |
| UI integration | Injected panel visually aligned with sidebar; no React internals |
| “All projects” view | Deferred; research preserves GraphQL path for Phase 2 |
| Upstream Refined GitHub | Out of scope for MVP; reassess after dogfood |
