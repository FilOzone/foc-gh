/**
 * Main-world fetch interceptor for project board OR queries.
 *
 * Runs in the PAGE's main world (injected via <script src> from board-filter-main.ts).
 * Monkey-patches window.fetch to intercept calls to /memexes/{id}/paginated_items.
 *
 * On every paginated_items fetch, reads the filter bar's current value and checks
 * for OR syntax. If found, intercepts the call, runs multi-branch fetch + merge,
 * and returns the merged response. If not, passes through unchanged.
 *
 * Strategy: clone the original intercepted URL and only replace the `q` parameter
 * for each branch. This preserves all native params (sortedBy, groupedBy, sliceBy,
 * fieldIds, layout, sumFields, hierarchy) exactly as the React app sends them.
 */

import type { GroupedItemsResponse, GroupItems } from './memex-api.js'
import { mergeResponses } from './result-merger.js'
import { parseORQuery } from './or-query-parser.js'

// Guard against double-injection (Turbo SPA navigation can re-run content scripts)
if ((window as unknown as Record<string, unknown>).__filozFetchInterceptorInstalled) {
  // Already installed — skip
} else {
(window as unknown as Record<string, unknown>).__filozFetchInterceptorInstalled = true

const originalFetch = window.fetch.bind(window)

/** Track in-flight OR query so we can abort on supersession. */
let activeController: AbortController | null = null

/**
 * Fetch a single page and return the parsed JSON.
 */
async function fetchJson(url: string, signal?: AbortSignal): Promise<GroupedItemsResponse> {
  const resp = await originalFetch(url, {
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    signal,
  })
  if (!resp.ok) {
    throw new Error(`paginated_items fetch failed: ${resp.status} ${resp.statusText}`)
  }
  return resp.json()
}

/**
 * Clone a URL and replace the `q` parameter while removing pagination cursors.
 */
function cloneUrlWithQuery(originalUrl: URL, query: string): string {
  const cloned = new URL(originalUrl.href)
  cloned.searchParams.set('q', query)
  // Remove pagination params — we want the first page for each branch
  cloned.searchParams.delete('after')
  // Remove group-scoped pagination (groupedBy[value]) — we want all groups
  cloned.searchParams.delete('groupedBy[value]')
  return cloned.href
}

/**
 * Build a pagination URL for a specific group within a branch response.
 */
function buildPaginationUrl(originalUrl: URL, query: string, group: GroupItems, endCursor: string): string {
  const cloned = new URL(originalUrl.href)
  cloned.searchParams.set('q', query)
  cloned.searchParams.set('after', endCursor)
  // Scope pagination to the specific group
  cloned.searchParams.set('groupedBy[value]', group.groupId)
  return cloned.href
}

/**
 * Fetch all items for a single branch query, following pagination cursors per group.
 */
async function fetchBranch(
  originalUrl: URL,
  query: string,
  signal: AbortSignal,
): Promise<GroupedItemsResponse> {
  const firstUrl = cloneUrlWithQuery(originalUrl, query)
  console.log('[FilOz] Branch fetch:', query, '→', firstUrl)
  const first = await fetchJson(firstUrl, signal)

  // Follow pagination within each group
  const groupedItems: GroupItems[] = first.groupedItems.map((g) => ({
    ...g,
    nodes: [...g.nodes],
  }))

  for (let idx = 0; idx < groupedItems.length; idx++) {
    let current = groupedItems[idx]
    while (current.pageInfo?.hasNextPage && current.pageInfo.endCursor) {
      const nextUrl = buildPaginationUrl(originalUrl, query, current, current.pageInfo.endCursor)
      const nextPage = await fetchJson(nextUrl, signal)
      // When paginating with groupedBy[value], the API may return only the
      // requested group (at index 0), not at the original group index.
      // Find the matching group by groupId rather than assuming index alignment.
      const nextGroup = nextPage.groupedItems?.find(
        (g) => g.groupId === current.groupId,
      ) ?? nextPage.groupedItems?.[0]
      if (!nextGroup) break
      groupedItems[idx].nodes.push(...nextGroup.nodes)
      current = nextGroup
    }
    groupedItems[idx].pageInfo = {
      ...groupedItems[idx].pageInfo,
      hasNextPage: false,
    }
  }

  return { ...first, groupedItems }
}

/**
 * Execute multi-branch fetch and merge for an OR query.
 */
async function executeBranchFetches(
  originalUrl: URL,
  prefix: string,
  branches: string[],
): Promise<GroupedItemsResponse> {
  // Abort any previous in-flight OR query
  activeController?.abort()
  const controller = new AbortController()
  activeController = controller

  const branchQueries = branches.map((branch) =>
    prefix ? `${prefix} ${branch}` : branch,
  )

  console.log('[FilOz] Fetching', branchQueries.length, 'branches:', branchQueries)

  const results = await Promise.all(
    branchQueries.map((query) => fetchBranch(originalUrl, query, controller.signal)),
  )

  activeController = null
  const merged = mergeResponses(results)
  console.log('[FilOz] Merged results:', merged.totalCount.value, 'items')
  return merged
}

// Monkey-patch fetch
window.fetch = async function patchedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  // Parse the URL from the request
  let url: URL
  try {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    url = new URL(rawUrl, window.location.origin)
  } catch {
    return originalFetch(input, init)
  }

  // Only intercept initial paginated_items requests (not pagination follow-ups)
  const match = url.pathname.match(/\/memexes\/(\d+)\/paginated_items/)
  if (!match) return originalFetch(input, init)

  // Skip pagination requests (these are follow-ups we handle internally)
  if (url.searchParams.has('after')) return originalFetch(input, init)

  // Check the fetch URL's q param for OR syntax — this is the source of truth
  // for what GitHub's React app is actually requesting.
  const filterText = url.searchParams.get('q') ?? ''
  const parseResult = parseORQuery(filterText)

  if (parseResult.kind !== 'or_query') {
    if (parseResult.kind === 'invalid_or') {
      console.warn('[FilOz] Invalid OR syntax, passing through:', parseResult.error.message)
    }
    return originalFetch(input, init)
  }

  const { prefix, branches } = parseResult.query

  console.log('[FilOz] Intercepted paginated_items for OR query, memex', match[1])

  try {
    const merged = await executeBranchFetches(url, prefix, branches)

    return new Response(JSON.stringify(merged), {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.log('[FilOz] OR query fetch aborted (superseded)')
      throw err
    }
    console.error('[FilOz] OR query fetch failed, falling through to native:', err)
    return originalFetch(input, init)
  }
} as typeof fetch

console.log('[FilOz] Fetch interceptor installed')

/**
 * Handle initial page load with an OR query (saved view or ?filterQuery= URL).
 *
 * On initial load, GitHub server-renders board data into the HTML (no fetch).
 * It doesn't understand OR syntax, so the embedded data has 0 results.
 * React hydrates and caches this under the exact filter string K.
 *
 * Fix: find GitHub's TanStack Query QueryClient via the React fiber tree and
 * call invalidateQueries() on the paginatedMemexItems queries. Since these
 * queries are active (components are subscribed), React Query refetches via
 * fetch() — which our interceptor catches and returns merged OR data.
 *
 * This avoids modifying the filter string, so there's no trailing space,
 * no "Discard" button, and no URL change.
 *
 * Falls back to the trailing-space nudge if the QueryClient is not found
 * (e.g., if React internals change).
 *
 * See specs/007-project-board-or-filter/research.md § "React Hydration Cache Problem".
 */
function handleInitialOrQuery(): void {
  function waitForFilter(): void {
    const input = document.querySelector<HTMLInputElement>('input#filter-bar-component-input')
    if (input && input.value.trim()) {
      onFilterReady(input)
      return
    }
    const observer = new MutationObserver(() => {
      const el = document.querySelector<HTMLInputElement>('input#filter-bar-component-input')
      if (!el || !el.value.trim()) return
      observer.disconnect()
      onFilterReady(el)
    })
    observer.observe(document.documentElement, { childList: true, subtree: true })
    setTimeout(() => observer.disconnect(), 15_000)
  }

  function onFilterReady(input: HTMLInputElement): void {
    const result = parseORQuery(input.value)
    if (result.kind !== 'or_query') return

    console.log('[FilOz] OR query detected on initial load')

    // Wait for React to finish hydrating and mounting
    setTimeout(() => {
      const qc = findQueryClient()
      if (qc) {
        invalidateOrQueries(qc)
      } else {
        console.warn('[FilOz] QueryClient not found, falling back to nudge')
        nudgeFilter(input)
      }
    }, 500)
  }

  waitForFilter()
}

/**
 * Walk the React fiber tree from #memex-root to find TanStack Query's
 * QueryClient, exposed via a context provider (fiber tag 10).
 */
function findQueryClient(): { invalidateQueries: (opts: unknown) => void } | null {
  try {
    const root = document.querySelector('#memex-root') as HTMLElement & {
      reactRoot?: { _internalRoot?: { current?: unknown } }
    }
    if (!root?.reactRoot?._internalRoot?.current) return null

    type Fiber = {
      tag: number
      child: Fiber | null
      sibling: Fiber | null
      memoizedProps: { value?: Record<string, unknown> } | null
    }

    const fiberRoot = root.reactRoot._internalRoot.current as Fiber

    function walk(fiber: Fiber | null, depth: number): Record<string, unknown> | null {
      if (!fiber || depth > 15) return null
      // tag 10 = ContextProvider. Check if the value has invalidateQueries.
      if (
        fiber.tag === 10 &&
        fiber.memoizedProps?.value &&
        typeof fiber.memoizedProps.value.invalidateQueries === 'function'
      ) {
        return fiber.memoizedProps.value
      }
      return walk(fiber.child, depth + 1) || walk(fiber.sibling, depth + 1)
    }

    return walk(fiberRoot, 0) as { invalidateQueries: (opts: unknown) => void } | null
  } catch (err) {
    console.warn('[FilOz] Error traversing fiber tree:', err)
    return null
  }
}

/**
 * Invalidate all paginatedMemexItems queries in the QueryClient.
 * Since these queries are active (components subscribed), React Query
 * refetches via fetch() → our interceptor catches and returns merged data.
 */
function invalidateOrQueries(qc: { invalidateQueries: (opts: unknown) => void }): void {
  console.log('[FilOz] Invalidating paginatedMemexItems queries via QueryClient')
  qc.invalidateQueries({
    predicate: (q: { queryKey: unknown }) => {
      const key = q.queryKey
      return (
        Array.isArray(key) &&
        key[0] === 'memex' &&
        key[1] === 'paginatedMemexItems'
      )
    },
  })
}

/**
 * Fallback: nudge the filter bar with a trailing space to force a cache-miss
 * fetch. Used when the QueryClient is not found.
 */
function nudgeFilter(input: HTMLInputElement): void {
  input.focus()
  const val = input.value
  if (val.endsWith(' ')) {
    console.log('[FilOz] Nudging filter: removing trailing space to trigger re-fetch')
    input.setSelectionRange(val.length - 1, val.length)
    document.execCommand('delete')
  } else {
    console.log('[FilOz] Nudging filter: appending space to trigger re-fetch')
    input.setSelectionRange(val.length, val.length)
    document.execCommand('insertText', false, ' ')
  }
}

handleInitialOrQuery()

} // end guard
