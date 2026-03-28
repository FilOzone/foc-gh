# Research: Build and distribution workflows

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-03-27

## R1 — Chrome Web Store vs local manifest `key`

**Decision**: Keep **`manifest.key`** only in **`extension/dist/manifest.json`** (injected by `scripts/build.mjs` from `extension/manifest-id-public.b64`). The **Web Store ZIP** produced by `scripts/zip-dist.mjs` **must omit** `key` because store ingestion rejects it (`key field is not allowed in manifest`).

**Rationale**: Matches observed store behavior and enables one shared **dev** OAuth callback for all teammates loading the same `dist` output.

**Alternatives considered**:

- Single package for both channels — **rejected** (store policy).
- Omit key everywhere — **rejected** (loses stable local ID).

## R2 — Mapping OAuth app credentials to channels

**Decision**: Document **two** contexts: **local / pinned-ID** builds use a GitHub OAuth app whose callback is `https://<derived-local-id>.chromiumapp.org/` (ID logged by `npm run build`). **Store** builds use a **second** OAuth app whose callback matches the **store listing** extension ID. Implementers SHOULD use the **same** env var names (`GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`) in each environment but **different secret values** per channel (developer `.env.local` for local; GitHub Actions **repository secrets** for store/release builds). Optional hardening (future): `GITHUB_OAUTH_LOCAL_*` vs `GITHUB_OAUTH_STORE_*` with build script selection—defer unless mix-ups recur.

**Rationale**: Matches GitHub’s one-callback-per-OAuth-app rule and matches existing `.env.example` names; CI sets store credentials only on jobs that produce the store artifact.

**Alternatives considered**:

- One OAuth app / one callback — **rejected** when store ID ≠ local ID (typical).

## R3 — GitHub Actions shape

**Decision**: Add at least one workflow that runs on **`pull_request`** and **`push`** to default branch: `actions/checkout`, **Node** LTS (or file-versioned via `.nvmrc` if added), **`npm ci`**, **`npm run typecheck`**, and **`npm run build`** with `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` read from **`secrets`** (use dummy or skip build if secrets absent on PRs from forks—use `if: github.event.pull_request.head.repo.full_name == github.repository` or **repository variables** for non-secret client ID only). **Never** log env values. Optional second job: `npm run build:zip` on `workflow_dispatch` or release tags with store secrets.

**Rationale**: Satisfies **FR-006**; avoids leaking secrets on fork PRs.

**Alternatives considered**:

- Require secrets on every PR — **rejected** (forks cannot access repo secrets; use conditional job or public client ID only for compile).

## R4 — Embedded client secret in shipped MV3 bundle

**Decision**: No change to runtime architecture in this feature; **documentation** MUST continue to warn that **Connect GitHub** embeds the OAuth **client secret** in `service-worker.js` (existing design). Store/build docs cross-link `docs/github-oauth-app.md`.

**Rationale**: Constitution allows documenting confidential-client limitations; spec **EXT-002** requires releaser awareness.

**Alternatives considered**:

- Token exchange proxy — **out of scope** for this feature.
