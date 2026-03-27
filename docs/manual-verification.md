# Manual verification — cross-org FOC board extension

Use after changing `extension/manifest.json`, auth, or GraphQL behavior. Record results in the PR.

## Prereqs

- [ ] `npm run build` succeeds; load unpacked from `extension/dist/`
- [ ] Options: valid PAT per [github-pat-permissions.md](./github-pat-permissions.md);
      default board `https://github.com/orgs/FilOzone/projects/14`
- [ ] Target repos include `filecoin-project/curio` and/or `filecoin-project/filecoin-pin`

## Smoke

1. [ ] **Token missing**: open a target-repo issue; panel shows “Open options” CTA.
2. [ ] **Linked issue**: open an issue already on board / not on board; panel shows
       correct state and fields (or “not linked”).
3. [ ] **Add**: on unlinked issue, **Add to FOC project**; item appears on board; bad
       token scope shows readable error.
4. [ ] **Status**: on linked issue, change Status; board matches after refresh.
5. [ ] **Non-target repo**: open another org’s issue; panel does not appear.
6. [ ] **Navigation**: within GitHub SPA, navigate issue → issue; panel updates (turbo/pjax).
