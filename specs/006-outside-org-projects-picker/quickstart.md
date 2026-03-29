# Quickstart: Global boards picker + checkbox (manual QA)

## Preconditions

- Extension built per [`extension/README.md`](../../extension/README.md).
- **Global board URLs** include `https://github.com/orgs/FilOzone/projects/14` (or test board).
- Token has **`project`** (and other) scopes per [docs/github-pat-permissions.md](../../docs/github-pat-permissions.md).
- The gear picker runs on **any** issue/PR page where the visibility rule ([FR-006](./spec.md)) applies — not limited to target repos.

## A. Issue — section + membership + add

1. Open a **cross-org** issue (e.g. [filecoin-project/FIPs#1111](https://github.com/filecoin-project/FIPs/issues/1111)) — this repo is outside FilOzone org so FR-006 applies.
2. Confirm in browser the issue’s real board membership for the configured Global board(s).
3. Open **Projects** → **gear**.
4. **Expect**: **Global boards** section; each row shows the board’s **actual project title** (e.g. `FOC`) and a **checkbox** that matches the known membership state.
5. If **unchecked**, **check** → issue appears on board (verify on board page); checkbox **checked**.
6. **Uncheck** → item removed (verify); checkbox **unchecked** or explicit error.

## B. Pull request — same

1. Open a PR (e.g. [filecoin-project/FIPs#1226](https://github.com/filecoin-project/FIPs/pull/1226)).
2. Repeat **gear** flow; confirm the **tabbed** PR picker layout (`<tab-container>` with Recent/Repository/Organization tabs) shows **Global boards** after the tab strip and rows behave correctly.

## C. In-org — hidden

1. Open issue/PR under org matching **all** configured board orgs.
2. **Expect**: **No** **Global boards** injection.

## D. Loading / errors

1. Throttle network (optional) — checkbox must **not** falsely show **checked** before data returns.
2. Revoke **`project`** scope or use token without write — **check** shows **clear** error; checkbox **reverts**.

## E. Options copy

1. Open options — **Global** terminology; **no** user-visible **cross-org** / **outside organization** for boards.

## F. Themes

Repeat **A** or **B** in **light** and **dark**.

## References

- [spec.md](./spec.md) — **FR-001–FR-012**, **SC-001–SC-005**
- [data-model.md](./data-model.md) — visibility predicate
- [contracts/global-boards-picker-ui.md](./contracts/global-boards-picker-ui.md) — message shapes
