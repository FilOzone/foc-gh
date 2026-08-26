/**
 * Main-world data injector for the native Projects picker (spec 008).
 *
 * Injected via <script src> at document_start from native-picker-main.ts so
 * the fetch patch beats GitHub's first captured fetch reference.
 *
 * The patch is installed unconditionally but stays a pure passthrough until a
 * `filoz-np-config` event arms it with boards for the current page. Every
 * augmentation path is fail-open: any error returns the original response and
 * logs a warning; native behavior is never blocked.
 *
 * Intercepted surfaces (contracts/github-feeds.md):
 *  1. GET  /_ghui/item-pickers/projects            → add boards to the Recent group (issues)
 *  2. GET  /_graphql?body={IssueViewerViewQuery}   → add membership edges (issues)
 *  3. POST /_graphql {updateIssueProjectsRelay...} → observe native add/remove of our boards
 *  4. GET  .../projects_suggestions?scope=recent   → add board rows with selected state (PRs)
 *  5. POST /<owner>/<repo>/projects/issues/<n>     → strip our ids, delegate mutation (PRs)
 */

import type {
  InjectedBoard,
  ItemPickersProjectsResponse,
  MembershipEntry,
  NpConfigDetail,
  NpMembershipDetail,
  NpNativeMutationDetail,
  NpPrToggleDetail,
  NpPrToggleResultDetail,
  ProjectsSuggestionsResponse,
  SuggestionRow,
} from './feed-shapes.js'
import { buildPickerFeedNode, NP_EVENTS, parseDetail } from './feed-shapes.js'
import { commitMembershipEdge, noteFieldListQueryHash } from './relay-membership.js'
import { seedItemPickerCache } from './idb-seeder.js'

const LOG = '[FilOz:native-picker]'

// Guard against double-injection (Turbo SPA navigation preserves the JS context)
if ((window as unknown as Record<string, unknown>).__filozNativePickerInstalled) {
  // Already installed — skip
} else {
  ;(window as unknown as Record<string, unknown>).__filozNativePickerInstalled = true

  const originalFetch = window.fetch.bind(window)

  type PageInfo = NpConfigDetail['page']

  const state = {
    page: null as PageInfo,
    boards: [] as InjectedBoard[],
    contentNodeId: null as string | null,
    membership: new Map<string, MembershipEntry>(),
    membershipRequested: false,
  }

  function armed(): boolean {
    return state.page !== null && state.boards.length > 0
  }

  function boardById(projectId: string): InjectedBoard | undefined {
    return state.boards.find((b) => b.projectId === projectId)
  }

  function dispatch(name: string, detail: unknown): void {
    document.dispatchEvent(new CustomEvent(name, { detail: JSON.stringify(detail) }))
  }

  function requestMembershipOnce(): void {
    if (state.membershipRequested) return
    state.membershipRequested = true
    dispatch(NP_EVENTS.requestMembership, {})
  }

  /** Replace the readable body of a real Response, preserving url/status/headers. */
  function overrideBody(res: Response, body: string): Response {
    const patched = res as Response & { json(): Promise<unknown>; text(): Promise<string> }
    patched.json = async () => JSON.parse(body) as unknown
    patched.text = async () => body
    return patched
  }

  // --- 1. issue picker feed ------------------------------------------------

  function edgeListHasBoard(data: ItemPickersProjectsResponse, projectId: string): boolean {
    const repo = data.data?.repository
    const lists = [
      (repo?.projectsV2?.nodes ?? []).map((n) => n),
      (repo?.recentProjects?.edges ?? []).map((e) => e?.node),
      (repo?.owner?.projectsV2?.edges ?? []).map((e) => e?.node),
      (repo?.owner?.recentProjects?.edges ?? []).map((e) => e?.node),
    ]
    return lists.some((list) => list.some((node) => node?.id === projectId))
  }

  async function augmentItemPickers(res: Response, url: URL): Promise<Response> {
    try {
      const owner = url.searchParams.get('owner') ?? ''
      const repo = url.searchParams.get('repo') ?? ''
      if (
        state.page &&
        (owner.toLowerCase() !== state.page.owner.toLowerCase() ||
          repo.toLowerCase() !== state.page.name.toLowerCase())
      ) {
        return res
      }
      requestMembershipOnce()

      const data = (await res.clone().json()) as ItemPickersProjectsResponse
      const recentEdges = data.data?.repository?.owner?.recentProjects?.edges
      if (!Array.isArray(recentEdges)) return res

      const query = (url.searchParams.get('query') ?? '').trim().toLowerCase()
      let changed = false
      for (const board of state.boards) {
        if (board.org.toLowerCase() === owner.toLowerCase()) continue
        if (edgeListHasBoard(data, board.projectId)) continue
        if (query && !board.title.toLowerCase().includes(query)) continue
        recentEdges.unshift({ node: buildPickerFeedNode(board) })
        changed = true
      }
      if (!changed) return res
      console.log(LOG, 'Injected boards into picker feed for', `${owner}/${repo}`)
      return overrideBody(res, JSON.stringify(data))
    } catch (err) {
      console.warn(LOG, 'Picker feed augmentation failed, passing through:', err)
      return res
    }
  }

  // --- 2. native mutation observation ---------------------------------------

  type GraphqlPostBody = {
    persistedQueryName?: string
    variables?: { input?: { projectId?: string; itemId?: string; contentId?: string } }
  }

  function knownItemBoard(itemId: string): InjectedBoard | undefined {
    for (const entry of state.membership.values()) {
      if (entry.itemId === itemId) return boardById(entry.projectId)
    }
    return undefined
  }

  function noteMembership(projectId: string, status: MembershipEntry['status'], itemId: string | null): void {
    state.membership.set(projectId, { projectId, status, itemId })
    dispatch(NP_EVENTS.nativeMutation, {
      projectId,
      action: status === 'member' ? 'added' : 'removed',
      itemId,
    } satisfies NpNativeMutationDetail)
  }

  async function observeGraphqlMutation(body: GraphqlPostBody, res: Response): Promise<void> {
    try {
      const input = body.variables?.input
      if (!input) return
      const addBoard = input.projectId ? boardById(input.projectId) : undefined
      const removeBoard = input.itemId ? knownItemBoard(input.itemId) : undefined
      if (!addBoard && !removeBoard) return

      const data = (await res.clone().json()) as {
        data?: {
          addProjectV2ItemById?: { projectEdge?: { node?: { id?: string } } | null }
          deleteProjectV2Item?: { deletedItemId?: string }
        }
      }
      const added = data.data?.addProjectV2ItemById
      const deleted = data.data?.deleteProjectV2Item
      if (addBoard && added) {
        const itemId = added.projectEdge?.node?.id ?? null
        if (itemId) {
          noteMembership(addBoard.projectId, 'member', itemId)
        } else {
          // projectEdge null = idempotent re-add of an existing membership;
          // ask the content script for a fresh resolve to learn the item id.
          state.membershipRequested = false
          requestMembershipOnce()
        }
      } else if (removeBoard && deleted?.deletedItemId) {
        noteMembership(removeBoard.projectId, 'not-member', null)
      } else if (addBoard || removeBoard) {
        // Unclassified mutation touching our board — log for diagnosis (T013).
        console.log(LOG, 'Unclassified mutation on injected board:', body.persistedQueryName)
      }
    } catch (err) {
      console.warn(LOG, 'Mutation observation failed:', err)
    }
  }

  // --- 4. PR suggestions feed ------------------------------------------------

  async function augmentSuggestions(res: Response, url: URL): Promise<Response> {
    try {
      requestMembershipOnce()
      const data = (await res.clone().json()) as ProjectsSuggestionsResponse
      if (!Array.isArray(data.projects)) return res

      const repoOwner = state.page?.owner.toLowerCase() ?? ''
      let changed = false
      for (const board of state.boards) {
        if (board.org.toLowerCase() === repoOwner) continue
        if (board.databaseId === null) {
          console.warn(LOG, 'Board missing databaseId, skipped on PR picker:', board.title)
          continue
        }
        if (data.projects.some((p) => p.id === board.databaseId)) continue
        const row: SuggestionRow = {
          id: board.databaseId,
          name: board.title,
          owner: board.org,
          type: 'memex_project',
          template: false,
          selected: state.membership.get(board.projectId)?.status === 'member',
          search_slug: `${board.org}/${board.number}`,
        }
        data.projects.unshift(row)
        changed = true
      }
      if (!changed) return res
      console.log(LOG, 'Injected boards into PR suggestions feed:', url.pathname)
      return overrideBody(res, JSON.stringify(data))
    } catch (err) {
      console.warn(LOG, 'PR suggestions augmentation failed, passing through:', err)
      return res
    }
  }

  // --- 5. PR form POST -------------------------------------------------------

  function prFormPath(): string | null {
    if (!state.page || state.page.kind !== 'pull_request') return null
    return `/${state.page.owner}/${state.page.name}/projects/issues/${state.page.number}`
  }

  /**
   * GitHub's legacy PUT replaces the full membership list but silently ignores
   * cross-org ids (verified live). Strip our ids from the form, delegate the
   * intended change to the extension's GraphQL path, and let the native call
   * proceed for GitHub's own projects.
   */
  async function handlePrFormPost(
    input: RequestInfo | URL,
    init: RequestInit | undefined,
  ): Promise<Response> {
    try {
      let form: FormData | null = null
      if (init?.body instanceof FormData) {
        form = init.body
      } else if (input instanceof Request) {
        form = await input.clone().formData()
      }
      if (!form) return originalFetch(input, init)

      const toggles: NpPrToggleDetail[] = []
      let stripped = false
      for (const board of state.boards) {
        if (board.databaseId === null) continue
        const field = `issue_memex_project_ids[${board.databaseId}]`
        if (!form.has(field)) continue
        // The picker serializes every listed project; the VALUE carries the
        // state ("on" = checked, empty = unchecked). Verified live 2026-08-19.
        const checkedInForm = form.getAll(field).includes('on')
        form.delete(field)
        stripped = true
        const isMember = state.membership.get(board.projectId)?.status === 'member'
        if (checkedInForm !== isMember) {
          toggles.push({ projectId: board.projectId, desired: checkedInForm ? 'member' : 'not-member' })
        }
      }

      for (const toggle of toggles) dispatch(NP_EVENTS.prToggle, toggle)

      if (!stripped && toggles.length === 0) return originalFetch(input, init)

      if (input instanceof Request) {
        const headers = new Headers(input.headers)
        headers.delete('content-type') // let fetch re-derive the multipart boundary
        return originalFetch(
          new Request(input.url, {
            method: input.method,
            headers,
            body: form,
            credentials: input.credentials,
            mode: input.mode,
            referrer: input.referrer,
          }),
        )
      }
      return originalFetch(input, { ...init, body: form })
    } catch (err) {
      console.warn(LOG, 'PR form interception failed, passing through:', err)
      return originalFetch(input, init)
    }
  }

  // --- event wiring ----------------------------------------------------------

  document.addEventListener(NP_EVENTS.config, (ev) => {
    const detail = parseDetail<NpConfigDetail>((ev as CustomEvent).detail)
    if (!detail) return
    const pageChanged =
      JSON.stringify(detail.page) !== JSON.stringify(state.page)
    state.page = detail.page
    // Invariant enforced at the choke point: never inject a board whose org
    // owns the current repo — GitHub's native picker already lists it there.
    const pageOwner = detail.page?.owner.toLowerCase() ?? ''
    state.boards = (Array.isArray(detail.boards) ? detail.boards : []).filter(
      (b) => b.org.toLowerCase() !== pageOwner,
    )
    if (pageChanged) {
      state.contentNodeId = null
      state.membership.clear()
      state.membershipRequested = false
    }
    if (state.page?.kind === 'issue' && armed()) {
      void seedItemPickerCache(state.page.owner, state.page.name, state.boards)
    }
    console.log(
      LOG,
      armed() ? `Armed with ${state.boards.length} board(s)` : 'Dormant (no boards for this page)',
    )
  })

  document.addEventListener(NP_EVENTS.membership, (ev) => {
    const detail = parseDetail<NpMembershipDetail>((ev as CustomEvent).detail)
    if (!detail) return
    state.contentNodeId = detail.contentNodeId
    for (const entry of detail.entries) {
      state.membership.set(entry.projectId, entry)
      if (entry.status === 'member' && entry.itemId && state.page?.kind === 'issue') {
        const board = boardById(entry.projectId)
        // Retry with backoff: membership can resolve before React hydration
        // makes the Relay environment discoverable.
        if (board) {
          const itemId = entry.itemId
          const tryCommit = (attempt: number): void => {
            void commitMembershipEdge(detail.contentNodeId, board, itemId, originalFetch).then(
              (ok) => {
                if (!ok && attempt < 5) setTimeout(() => tryCommit(attempt + 1), 1500 * attempt)
              },
            )
          }
          tryCommit(1)
        }
      }
    }
  })

  document.addEventListener(NP_EVENTS.prToggleResult, (ev) => {
    const detail = parseDetail<NpPrToggleResultDetail>((ev as CustomEvent).detail)
    if (!detail) return
    if (detail.error) {
      console.warn(LOG, 'Delegated PR toggle failed:', detail.error)
    }
    state.membership.set(detail.projectId, {
      projectId: detail.projectId,
      status: detail.status,
      itemId: detail.itemId,
    })
  })

  // --- fetch patch -----------------------------------------------------------

  window.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    let url: URL
    try {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      url = new URL(raw, window.location.origin)
    } catch {
      return originalFetch(input, init)
    }
    if (url.origin !== window.location.origin) return originalFetch(input, init)

    // Capture-and-cache: whenever GitHub itself fires the field list query
    // (any project card expansion, any page), harvest the CURRENT persisted
    // query hash so Status enrichment survives hash rotation. Runs even while
    // dormant — it is a read-only sniff of the outgoing URL.
    if (url.pathname === '/_graphql') {
      const rawBody = url.searchParams.get('body')
      if (rawBody?.includes('ProjectItemSectionFieldListQuery')) {
        try {
          const parsed = JSON.parse(rawBody) as { persistedQueryName?: string; query?: string }
          if (
            parsed.persistedQueryName === 'ProjectItemSectionFieldListQuery' &&
            typeof parsed.query === 'string'
          ) {
            noteFieldListQueryHash(parsed.query)
          }
        } catch {
          // not JSON — ignore
        }
      }
    }

    if (!armed()) return originalFetch(input, init)

    try {
      const method = (
        init?.method ?? (input instanceof Request ? input.method : 'GET')
      ).toUpperCase()

      // 5. PR sidebar form toggle (before the request is sent)
      if (method === 'POST' && url.pathname === prFormPath()) {
        return handlePrFormPost(input, init)
      }

      // 3. native GraphQL mutations: observe, never block
      if (method === 'POST' && url.pathname === '/_graphql') {
        let parsedBody: GraphqlPostBody | null = null
        try {
          if (typeof init?.body === 'string') parsedBody = JSON.parse(init.body) as GraphqlPostBody
          else if (input instanceof Request) {
            parsedBody = JSON.parse(await input.clone().text()) as GraphqlPostBody
          }
        } catch {
          parsedBody = null
        }
        const res = await originalFetch(input, init)
        if (parsedBody) void observeGraphqlMutation(parsedBody, res)
        return res
      }

      // 1. issue picker feed
      if (url.pathname === '/_ghui/item-pickers/projects') {
        const res = await originalFetch(input, init)
        return res.ok ? augmentItemPickers(res, url) : res
      }

      // 4. PR suggestions feed
      if (
        url.pathname.endsWith('/projects_suggestions') &&
        url.searchParams.get('scope') === 'recent'
      ) {
        const res = await originalFetch(input, init)
        return res.ok ? augmentSuggestions(res, url) : res
      }
    } catch (err) {
      console.warn(LOG, 'Interception error, passing through:', err)
    }
    return originalFetch(input, init)
  } as typeof fetch

  console.log(LOG, 'Fetch interceptor installed (dormant until configured)')
} // end guard
