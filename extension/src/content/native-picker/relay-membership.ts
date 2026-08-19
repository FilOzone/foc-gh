/**
 * Relay store surgery for cross-org membership display (spec 008, US2).
 *
 * GitHub server-side filters cross-org project memberships out of every issue
 * page payload, so the native sidebar shows "No projects" and the picker shows
 * the row unchecked even when the item IS on the board. GitHub's own add
 * mutation proves the fix: its Relay updater inserts an edge into
 * `client:<issueId>:__ProjectSection_projectItems_connection(allowSameEnterprise:true)`
 * and the sidebar + picker immediately render it. This module performs the
 * same insert for memberships the extension resolved itself.
 *
 * Mirrors the fiber-walk discovery family used by the OR filter
 * (board-filter/board-data-injector.ts findQueryClient). All private React and
 * Relay internals are touched inside try/catch; failure logs a warning and
 * leaves native behavior untouched (feed augmentation still covers soft navs).
 */

import type { InjectedBoard } from './feed-shapes.js'

const LOG = '[FilOz:native-picker]'

type RecordProxy = {
  getDataID(): string
  getLinkedRecord(name: string): RecordProxy | null
  getLinkedRecords(name: string): Array<RecordProxy | null> | null
  setLinkedRecord(record: RecordProxy, name: string): RecordProxy
  setLinkedRecords(records: Array<RecordProxy | null>, name: string): RecordProxy
  setValue(value: unknown, name: string): RecordProxy
}

type StoreProxy = {
  get(dataId: string): RecordProxy | null
  create(dataId: string, typeName: string): RecordProxy
}

type RelayEnvironment = {
  commitUpdate(updater: (store: StoreProxy) => void): unknown
  getStore(): unknown
}

type Fiber = {
  tag: number
  child: Fiber | null
  sibling: Fiber | null
  memoizedProps: { value?: Record<string, unknown> } | null
}

function isRelayEnvironment(value: unknown): value is RelayEnvironment {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as RelayEnvironment).commitUpdate === 'function' &&
    typeof (value as RelayEnvironment).getStore === 'function'
  )
}

function fiberRootsFromDom(): Fiber[] {
  const roots: Fiber[] = []
  const candidates = document.querySelectorAll('react-app, [data-target="react-app.reactRoot"]')
  for (const el of candidates) {
    const withRoot = el as Element & {
      reactRoot?: Element & { _internalRoot?: { current?: Fiber } }
    }
    const fromProp = withRoot.reactRoot?._internalRoot?.current
    if (fromProp) {
      roots.push(fromProp)
      continue
    }
    // React 18 stamps the mount container with a __reactContainer$<hash>
    // property. On issue pages `react-app.reactRoot` is the container DOM
    // element (verified live 2026-08-19), so check both it and the host.
    for (const host of [withRoot.reactRoot, el]) {
      if (!host) continue
      for (const key of Object.keys(host)) {
        if (key.startsWith('__reactContainer$')) {
          const fiber = (host as unknown as Record<string, unknown>)[key] as Fiber | undefined
          if (fiber) roots.push(fiber)
        }
      }
    }
  }
  return roots
}

/**
 * Walk fibers looking for a context provider whose value is either the Relay
 * environment itself or a `{ environment }` wrapper (ReactRelayContext).
 * The provider sits ~90 levels deep on issue pages, so this is an iterative
 * walk bounded by node count rather than depth.
 */
function findRelayEnvironment(): RelayEnvironment | null {
  try {
    for (const root of fiberRootsFromDom()) {
      const stack: Fiber[] = [root]
      const seen = new Set<Fiber>()
      let visited = 0
      while (stack.length > 0 && visited < 10_000) {
        const fiber = stack.pop()
        if (!fiber || seen.has(fiber)) continue
        seen.add(fiber)
        visited++
        const value = fiber.memoizedProps?.value
        if (value) {
          if (isRelayEnvironment(value)) return value
          const wrapped = (value as { environment?: unknown }).environment
          if (isRelayEnvironment(wrapped)) return wrapped
        }
        if (fiber.child) stack.push(fiber.child)
        if (fiber.sibling) stack.push(fiber.sibling)
      }
    }
    return null
  } catch (err) {
    console.warn(LOG, 'Relay environment discovery failed:', err)
    return null
  }
}

function ensureProjectRecord(store: StoreProxy, board: InjectedBoard): RecordProxy {
  const existing = store.get(board.projectId)
  const project = existing ?? store.create(board.projectId, 'ProjectV2')
  project.setValue(board.projectId, 'id')
  project.setValue(board.title, 'title')
  project.setValue(false, 'closed')
  project.setValue(board.number, 'number')
  project.setValue(board.url, 'url')
  project.setValue(false, 'template')
  project.setValue(board.viewerCanUpdate, 'viewerCanUpdate')
  project.setValue(false, 'hasReachedItemsLimit')
  project.setValue('ProjectV2', '__typename')
  return project
}

/**
 * Insert a membership edge for `board` into the issue's projectItems
 * connection. Idempotent by item id. Returns true when the edge is present
 * after the call (inserted now or already there).
 */
export function commitMembershipEdge(
  contentNodeId: string,
  board: InjectedBoard,
  itemId: string,
): boolean {
  const env = findRelayEnvironment()
  if (!env) {
    console.warn(LOG, 'Relay environment not found; sidebar membership not injected')
    return false
  }
  const connectionId = `client:${contentNodeId}:__ProjectSection_projectItems_connection(allowSameEnterprise:true)`
  let committed = false
  try {
    env.commitUpdate((store) => {
      const connection = store.get(connectionId)
      if (!connection) return

      const edges = connection.getLinkedRecords('edges') ?? []
      const already = edges.some(
        (edge) => edge?.getLinkedRecord('node')?.getDataID() === itemId,
      )
      if (already) {
        committed = true
        return
      }

      const item = store.get(itemId) ?? store.create(itemId, 'ProjectV2Item')
      item.setValue(itemId, 'id')
      item.setValue(false, 'isArchived')
      item.setValue('ProjectV2Item', '__typename')
      item.setLinkedRecord(ensureProjectRecord(store, board), 'project')

      const edge = store.create(`client:${connectionId}:filoz-edge:${itemId}`, 'ProjectV2ItemEdge')
      edge.setLinkedRecord(item, 'node')
      connection.setLinkedRecords([...edges, edge], 'edges')
      committed = true
    })
  } catch (err) {
    console.warn(LOG, 'Relay membership commit failed:', err)
    return false
  }
  if (committed) console.log(LOG, 'Injected membership edge for', board.title)
  return committed
}
