/**
 * Relay store surgery for cross-org membership display (spec 008, US2).
 *
 * GitHub server-side filters cross-org project memberships out of every issue
 * page payload (Projects section and picker checked state), but two things ARE
 * served cross-org over the user's session: GitHub's own add/remove mutations,
 * and node-by-id queries such as `ProjectItemSectionFieldListQuery` (verified
 * live 2026-08-19). This module inserts a membership edge into
 * `client:<issueId>:__ProjectSection_projectItems_connection(allowSameEnterprise:true)`
 * enriched with the item's Status value and the board's Status field
 * definition, so GitHub renders the project card natively, identical to a
 * same-org board: collapsed Status row, expandable field list (which GitHub
 * itself lazily fetches by item id), and native field editing.
 *
 * All private React and Relay internals are touched inside try/catch; failure
 * logs a warning and leaves native behavior untouched.
 */

import type { InjectedBoard } from './feed-shapes.js'

const LOG = '[FilOz:native-picker]'

const STATUS_FIELD_ARGS = { name: 'Status' }

type RecordProxy = {
  getDataID(): string
  getLinkedRecord(name: string, args?: Record<string, unknown>): RecordProxy | null
  getLinkedRecords(name: string, args?: Record<string, unknown>): Array<RecordProxy | null> | null
  setLinkedRecord(record: RecordProxy, name: string, args?: Record<string, unknown>): RecordProxy
  setLinkedRecords(
    records: Array<RecordProxy | null>,
    name: string,
    args?: Record<string, unknown>,
  ): RecordProxy
  setValue(value: unknown, name: string, args?: Record<string, unknown>): RecordProxy
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

// --- Status enrichment via GitHub's own node-by-id query ---------------------

type JsonObject = Record<string, unknown>

type StatusData = {
  /** ProjectV2SingleSelectField def node named Status (scalars + options). */
  field: JsonObject | null
  /** ProjectV2ItemFieldSingleSelectValue node for that field, if a status is set. */
  value: JsonObject | null
}

/**
 * Fetch the item's field defs and values with the same persisted query GitHub
 * uses when a project card is expanded. Served cross-org (session cookies).
 */
async function fetchStatusData(
  fetcher: typeof fetch,
  itemId: string,
): Promise<StatusData | null> {
  try {
    const body = JSON.stringify({
      persistedQueryName: 'ProjectItemSectionFieldListQuery',
      query: 'db338523457639ec271344f360559dce',
      variables: { id: itemId },
    })
    const res = await fetcher(`/_graphql?body=${encodeURIComponent(body)}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      data?: {
        node?: {
          project?: { fields?: { edges?: Array<{ node?: JsonObject } | null> } }
          fieldValues?: { edges?: Array<{ node?: JsonObject } | null> }
        }
      }
    }
    const node = data.data?.node
    if (!node) return null
    const field =
      (node.project?.fields?.edges ?? [])
        .map((e) => e?.node)
        .find((n) => n?.name === 'Status' && n?.__typename === 'ProjectV2SingleSelectField') ??
      null
    const fieldId = field?.id
    const value =
      (node.fieldValues?.edges ?? [])
        .map((e) => e?.node)
        .find(
          (n) =>
            n?.__typename === 'ProjectV2ItemFieldSingleSelectValue' &&
            (fieldId === undefined || (n?.field as JsonObject | undefined)?.id === fieldId),
        ) ?? null
    return { field, value }
  } catch (err) {
    console.warn(LOG, 'Status data fetch failed:', err)
    return null
  }
}

/** Copy all scalar (non-object) properties of src onto a record. */
function setScalars(record: RecordProxy, src: JsonObject): void {
  for (const [key, val] of Object.entries(src)) {
    if (val === null || typeof val !== 'object') record.setValue(val, key)
  }
}

function buildStatusFieldRecord(store: StoreProxy, field: JsonObject): RecordProxy | null {
  const id = field.id as string | undefined
  if (!id) return null
  const record = store.get(id) ?? store.create(id, (field.__typename as string) ?? 'ProjectV2SingleSelectField')
  setScalars(record, field)
  const options = Array.isArray(field.options) ? (field.options as JsonObject[]) : []
  const optionRecords: RecordProxy[] = []
  for (const opt of options) {
    const optId = opt.id as string | undefined
    if (!optId) continue
    const optRecord = store.get(optId) ?? store.create(optId, 'ProjectV2SingleSelectFieldOption')
    setScalars(optRecord, opt)
    optionRecords.push(optRecord)
  }
  if (optionRecords.length > 0) record.setLinkedRecords(optionRecords, 'options')
  return record
}

function ensureProjectRecord(
  store: StoreProxy,
  board: InjectedBoard,
  statusField: RecordProxy | null,
): RecordProxy {
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
  if (statusField) project.setLinkedRecord(statusField, 'field', STATUS_FIELD_ARGS)
  return project
}

/**
 * Insert a membership edge for `board` into the issue's projectItems
 * connection, enriched with the Status value/field so GitHub renders the card
 * with full same-org parity. Idempotent by item id. Returns true when the edge
 * is present after the call.
 */
export async function commitMembershipEdge(
  contentNodeId: string,
  board: InjectedBoard,
  itemId: string,
  fetcher: typeof fetch,
): Promise<boolean> {
  const env = findRelayEnvironment()
  if (!env) {
    console.warn(LOG, 'Relay environment not found; sidebar membership not injected')
    return false
  }
  const status = await fetchStatusData(fetcher, itemId)
  const connectionId = `client:${contentNodeId}:__ProjectSection_projectItems_connection(allowSameEnterprise:true)`
  let committed = false
  try {
    env.commitUpdate((store) => {
      const connection = store.get(connectionId)
      if (!connection) return

      const statusField = status?.field ? buildStatusFieldRecord(store, status.field) : null
      const project = ensureProjectRecord(store, board, statusField)

      const item = store.get(itemId) ?? store.create(itemId, 'ProjectV2Item')
      item.setValue(itemId, 'id')
      item.setValue(false, 'isArchived')
      item.setValue('ProjectV2Item', '__typename')
      item.setLinkedRecord(project, 'project')
      if (status?.value?.id) {
        const valueRecord =
          store.get(status.value.id as string) ??
          store.create(status.value.id as string, 'ProjectV2ItemFieldSingleSelectValue')
        setScalars(valueRecord, status.value)
        if (statusField) valueRecord.setLinkedRecord(statusField, 'field')
        item.setLinkedRecord(valueRecord, 'fieldValueByName', STATUS_FIELD_ARGS)
      } else {
        item.setValue(null, 'fieldValueByName', STATUS_FIELD_ARGS)
      }

      const edges = connection.getLinkedRecords('edges') ?? []
      const already = edges.some(
        (edge) => edge?.getLinkedRecord('node')?.getDataID() === itemId,
      )
      if (already) {
        committed = true
        return
      }
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
