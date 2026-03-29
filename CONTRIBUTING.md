# Contributing to FOC GH

Thanks for helping improve this extension. This document focuses on **how we add meaningful work**; build setup and OAuth are in [extension/README.md](extension/README.md) and the root [README.md](README.md).

## New features: use GitHub Spec Kit

**New features should generally be built using [GitHub Spec Kit](https://github.com/github/spec-kit)** — spec-first development with a dedicated feature directory, explicit requirements, and implementation plans before (or alongside) code.

In this repo that workflow is wired in as:

- **[`.specify/`](.specify/)** — Spec Kit–style scripts and templates (e.g. feature scaffolding, plan/check helpers).
- **[`specs/`](specs/)** — One folder per feature (numbered prefix + short name), holding `spec.md`, `plan.md`, `tasks.md`, contracts, quickstarts, etc.
- **[`.specify/memory/constitution.md`](.specify/memory/constitution.md)** — Project principles agents and reviews should follow.

**Expectation for contributors and maintainers**

1. **Substantial features** (new user-visible behavior, new APIs, multi-file refactors): start from or align with a **`specs/...`** track. Use `.specify/scripts/bash/` as needed (for example `create-new-feature.sh` to scaffold a feature branch and spec directory).
2. **Implementation** should trace back to the spec (tasks, checkpoints, quickstarts where they exist).
3. **PRs** that add or change feature behavior should link the relevant `specs/` path and note any intentional deviations.

**When Spec Kit is optional**

- Single-file fixes, dependency bumps, documentation-only tweaks, or CI copy edits may skip a full spec folder if that’s proportionate — use judgment; err toward a small spec + tasks for anything you’d want design review on.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) (e.g. `feat:`, `fix:`, `chore:`, `docs:`) so release and changelog tooling stay predictable.

## Validation before you open a PR

From the repository root (after `npm install`):

```bash
npm run typecheck
npm run build
```

See [extension/README.md](extension/README.md) for local load, OAuth profiles, and Chrome Web Store packaging.

## Manual regression testing (Project panel / FOC)

For behavioral checks on real GitHub pages, use the **canonical issue and PR URLs** and the **expected outcomes** in **[docs/canonical-test-urls.md](docs/canonical-test-urls.md)**. Exercise the scenarios that match your change (FilOzone vs cross-org, global FOC membership, proactive-check repo list) before you open a PR that touches sidebar, project panel, or board membership logic.
