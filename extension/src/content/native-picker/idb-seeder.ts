/**
 * Seeds GitHub's React Query IndexedDB persister so injected boards appear on
 * the very FIRST picker open (spec 008, contracts/github-feeds.md section 5).
 *
 * GitHub persists picker query results per user in
 * `offline_cache_v2::<login>::queries` and serves the stored copy for first
 * paint, refetching in the background. Without seeding, an injected row only
 * appears from the second open onward. Every step here is best-effort: a
 * missing DB/entry, schema drift, or any exception is a silent no-op (the
 * fetch interceptor remains the source of truth).
 */

import type { InjectedBoard } from './feed-shapes.js'
import { buildPickerFeedNode } from './feed-shapes.js'

const LOG = '[FilOz:native-picker]'

type PersistedEntry = {
  state?: {
    data?: {
      recentOwnerProjects?: unknown[]
      ownerProjects?: unknown[]
    }
  }
}

function openDb(name: string): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(name)
    } catch {
      resolve(null)
      return
    }
    // Do not create the DB if GitHub hasn't; abort fresh creations.
    req.onupgradeneeded = () => {
      req.transaction?.abort()
      resolve(null)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
    req.onblocked = () => resolve(null)
  })
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** The transformed feed node shape stored under state.data (same as the picker feed node). */
function hasBoard(list: unknown[] | undefined, projectId: string): boolean {
  return (list ?? []).some(
    (n) => typeof n === 'object' && n !== null && (n as { id?: string }).id === projectId,
  )
}

export async function seedItemPickerCache(
  owner: string,
  repo: string,
  boards: InjectedBoard[],
): Promise<void> {
  if (boards.length === 0) return
  try {
    const login = document
      .querySelector('meta[name="user-login"]')
      ?.getAttribute('content')
      ?.trim()
    if (!login) return

    const db = await openDb(`offline_cache_v2::${login}::queries`)
    if (!db) return
    try {
      if (!db.objectStoreNames.contains('queries')) return

      const key = `key-${JSON.stringify(['item_picker', 'projects', { owner, query: '', repo }])}`
      const tx = db.transaction('queries', 'readwrite')
      const store = tx.objectStore('queries')
      const entry = (await idbRequest(store.get(key))) as PersistedEntry | undefined
      const data = entry?.state?.data
      if (!data || !Array.isArray(data.recentOwnerProjects)) return

      let changed = false
      for (const board of boards) {
        if (hasBoard(data.recentOwnerProjects, board.projectId)) continue
        if (hasBoard(data.ownerProjects, board.projectId)) continue
        data.recentOwnerProjects.unshift(buildPickerFeedNode(board))
        changed = true
      }
      if (changed) {
        // Stores with an inline keyPath reject explicit keys; support both layouts.
        await idbRequest(store.keyPath === null ? store.put(entry, key) : store.put(entry))
        console.log(LOG, 'Seeded persisted picker cache for', `${owner}/${repo}`)
      }
      await new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve()
        tx.onabort = () => resolve()
        tx.onerror = () => resolve()
      })
    } finally {
      db.close()
    }
  } catch (err) {
    console.warn(LOG, 'Persisted cache seeding skipped:', err)
  }
}
