# Contract: internal messaging (content script <-> main world <-> service worker)

## Main-world bridge (CustomEvents on `document`, namespaced `filoz-np-*`)

Payloads are JSON-serializable `detail` objects. The injector installs its fetch patch unconditionally at `document_start` but stays dormant (pure passthrough) until it receives config.

| Event | Direction | Detail | Purpose |
|-------|-----------|--------|---------|
| `filoz-np-config` | content -> main | `{ boards: InjectedBoard[], repo: {owner, name} }` | Arm the injector for this page; empty `boards` keeps it dormant |
| `filoz-np-membership` | content -> main | `{ contentNodeId, entries: MembershipState[] }` | Membership answers (initial resolve and updates); triggers Relay commit and PR `selected` computation |
| `filoz-np-native-mutation` | main -> content | `{ boardNodeId, action: "added"\|"removed", itemId }` | Observed native issue mutation touching an injected board; content script updates SW cache |
| `filoz-np-pr-toggle` | main -> content | `{ boardNodeId, desired: "member"\|"not-member" }` | Delegated PR add/remove request |
| `filoz-np-pr-toggle-result` | content -> main | `{ boardNodeId, status, itemId\|null, error?: string }` | Outcome of delegated mutation; refresh injector state |

Soft navs (Turbo): content script re-sends `filoz-np-config` and `filoz-np-membership` on `turbo:load` with the new page context; the injector replaces (never merges) per-page state keyed by `contentNodeId`.

## Service-worker messages (existing, reused unchanged)

| Message | Use here |
|---------|----------|
| `GET_GLOBAL_BOARDS_STATE` | Resolve MembershipState per board for the current item |
| `ADD_TO_PROJECT` | Delegated PR add |
| `DELETE_PROJECT_ITEM` | Delegated PR remove; issue-side contingency if native delete fails cross-org |

New (small): a cache-update message so observed native mutations keep the SW membership cache coherent, e.g. `NOTE_MEMBERSHIP_CHANGE { contentNodeId, boardNodeId, status, itemId }`. Idempotent; SW may revalidate lazily.

## Security notes

- Event details never contain tokens; the main world receives only board metadata and membership booleans/ids already visible to the page user.
- The injector treats inbound event details as untrusted input (validate shape before use); GitHub page scripts could theoretically dispatch spoofed events, and the blast radius must stay "wrong rows rendered", never a mutation with attacker-chosen targets: delegated mutations are validated against the configured board list in the content script before any SW call.
