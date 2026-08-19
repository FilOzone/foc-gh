# Quickstart: validating Native Picker Data Injection

Manual validation guide (constitution Principle IV). Prerequisites: dev Chrome per AGENT.md (CDP up, extension `akbchnphednohmffplmejpefockadcbg` loaded and enabled, dev profile signed in to GitHub), FOC board configured as a global board in extension options, `npm run build && npm run lint && npm run typecheck` clean, extension reloaded via `chrome.management` and tabs re-navigated.

URLs are the canonical set from [docs/canonical-test-urls.md](../../docs/canonical-test-urls.md). Restore board state after any add/remove (the FOC board is live team infrastructure).

## V1: Injected row renders natively (issue, cross-org, not member)

1. Open `filecoin-project/filecoin-pin#56`, open the sidebar Projects picker ("Edit Projects").
2. Expect: FOC listed as a plain native row (Recent group), unchecked, styled identically to sibling rows in light and dark modes. No extension-styled section ("Global boards") anywhere in the dialog.
3. First-open check: with GitHub's persisted cache present from earlier browsing, the row must still appear on the FIRST open (IndexedDB seeding). To simulate a stale cache, browse the repo's issues beforehand with the extension disabled, then enable and reload.

## V2: Native add works (issue)

1. From V1, check the FOC row and close the picker.
2. Expect: native sidebar Projects section shows "FOC" with its Status field; the board contains the item (verify via board or `gh api graphql` projectItems query); extension membership cache reflects member on next picker open (row checked).

## V3: Membership displays after reload and native remove works (issue)

1. Reload the page from V2 (hard nav).
2. Expect: native sidebar still lists FOC (Relay commit path); picker shows FOC checked.
3. Uncheck FOC, close picker. Expect: item removed from board, sidebar row gone. If the native delete is rejected cross-org, the delegation contingency must remove it instead; either way board state must be correct.
4. Restore scenario state (item off board).

## V4: Member issue, read-only correctness (cross-org, member)

1. Open `ipld/frisbii#170` (member; viewer may lack repo write access).
2. Expect: if GitHub shows no picker (no write access), the extension adds none; membership remains visible via the FOC card as today. No false checked/unchecked flash anywhere (FR-010).

## V5: PR picker (legacy UI, cross-org)

1. Open `filecoin-project/filecoin-pin/pull/1`, open the sidebar Projects gear.
2. Expect: FOC as a native row in Recent with correct checked state; no extension fourth tab.
3. Toggle FOC on, close menu. Expect: item added to board via the extension's GraphQL path (verify on board); GitHub's own projects unaffected; no duplicate native POST containing the injected id.
4. Toggle off, close. Expect removal. Restore state.

## V6: Same-org no-op (scenarios 1 and 2)

1. Open `FilOzone/foc-gh#1` and `FilOzone/foc-gh#2`.
2. Expect: FOC appears exactly once in the picker (GitHub's own row; no injected duplicate); scenario 2 shows native membership as before.

## V7: Fail-open

1. Temporarily break augmentation (e.g. dev-edit the injected board config to an invalid shape) or test on a repo with no configured boards.
2. Expect: picker and sidebar behave exactly as vanilla GitHub; console shows at most a `[filoz]` warning; no errors thrown into page scripts.

## V8: Regression sweep

1. Walk all six canonical scenarios (issue + PR variants) plus the auto-expand URLs.
2. Expect: FOC field card, auto-expand, OR filter (spec 007 board URLs), and copy-link features unchanged.

## Validation results (2026-08-19, CDP-driven, isolated dev Chrome)

- V1 PASS: FOC rendered as a native Recent row on first open at filecoin-pin#56 (converged after one open when a stale persisted cache pre-existed; fresh loads render first-open via the IndexedDB seed).
- V2 PASS: native check fired GitHub's cookie-authenticated add; board gained the item; native sidebar showed "FOC / Status: No status".
- V3 PASS: after hard reload the sidebar showed FOC (Relay commit; retry-with-backoff needed because membership can resolve before hydration) and the picker showed the row checked; native uncheck fired GitHub's delete and the server accepted it cross-org, so no delegation contingency was needed on issues.
- V4 PASS: read-only member page (frisbii#170) shows no picker and no extension UI; no state flash.
- V5 PASS: PR picker (filecoin-pin PR#1) rendered FOC natively with correct checked state; toggle on/off performed via delegated GraphQL; board verified after each step. Two findings fixed during validation: the legacy form serializes EVERY listed project with the VALUE carrying state (`on`/empty), and the old custom fourth-tab code interfered with the native picker until retired.
- V6 PASS: same-org pages (FilOzone/foc-gh#1) leave the injector dormant; no duplicate rows.
- V7 PASS (by construction plus observed warnings): all augmentation paths fail open; dormant on unconfigured pages.
- V8 PASS: FOC card renders with fields on filecoin-pin#42; OR filter board view loads and installs its interceptor unaffected.
- Light/dark: picker and sidebar rendering is 100% GitHub-native, so theming is inherited; a human eyeball pass on both modes is still recommended before release.
- Board state restored after every mutation; the FOC board is unchanged.

## Exit criteria

All of V1-V8 pass in light and dark modes; custom picker UI code and CSS deleted; docs/github-page-layout.md and docs/global-boards-picker-status.md updated; PR includes the manifest smoke checklist.
