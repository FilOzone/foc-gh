/**
 * Native picker content script entry point (spec 008).
 *
 * Architecture: content script (this file, isolated world, document_start)
 *   → main-world injector (native-picker-injector.ts) → feed augmentation.
 *
 * The main-world script must be injected synchronously at startup so its
 * fetch patch beats GitHub's first captured fetch reference (same constraint
 * as board-filter). Config and membership resolution run async afterwards;
 * the injector stays a pure passthrough until armed.
 *
 * Membership resolution cost note: `GET_GLOBAL_BOARDS_STATE` can involve a
 * REST membership scan for cross-org boards, so it runs at page load only for
 * proactive target repos (matching the FOC card's existing cost profile).
 * Elsewhere it is deferred until the injector observes a picker feed request
 * (`filoz-np-request-membership`), i.e. the user actually opened the picker —
 * the same moment the retired custom picker paid this cost.
 */

import { pageContextFromLocation, type PageContext } from '../../lib/github-url.js'
import {
  isTargetRepo,
  loadConfig,
  showGlobalBoardsSection,
} from '../../lib/project-config.js'
import type {
  ExtensionMessage,
  GetGlobalBoardsStateResponse,
  GetNativePickerBoardsResponse,
} from '../../lib/messages.js'
import type {
  InjectedBoard,
  MembershipEntry,
  NpConfigDetail,
  NpMembershipDetail,
  NpPrToggleDetail,
  NpPrToggleResultDetail,
} from './feed-shapes.js'
import { NP_EVENTS, parseDetail } from './feed-shapes.js'

const LOG = '[FilOz:native-picker]'

/**
 * Keep the FOC field card (spec 002) in sync with picker toggles. The board's
 * REST membership search index lags mutations by minutes, so the card layer
 * cannot be left to re-discover membership on its own. Instead the mutation
 * result is forwarded as an authoritative hint via `filoz:boards-changed`
 * detail (consumed by issue-sidebar.ts, passed to GET_PANEL_STATE). Removal
 * additionally clears the card from the DOM immediately.
 */
function syncFocFieldCard(boardProjectId: string, itemId: string | null): void {
  if (itemId === null) {
    document.getElementById('filoz-foc-board-panel-host')?.remove()
  }
  dispatch('filoz:boards-changed', { projectId: boardProjectId, itemId })
}

function injectMainWorldScript(): void {
  const id = 'filoz-native-picker-injector'
  if (document.getElementById(id)) return
  const script = document.createElement('script')
  script.id = id
  script.src = chrome.runtime.getURL('native-picker-injector.js')
  ;(document.head ?? document.documentElement).appendChild(script)
}

async function sendMessage<T>(msg: ExtensionMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response) => {
      const err = chrome.runtime.lastError
      if (err) {
        reject(new Error(err.message))
        return
      }
      resolve(response as T)
    })
  })
}

function dispatch(name: string, detail: unknown): void {
  document.dispatchEvent(new CustomEvent(name, { detail: JSON.stringify(detail) }))
}

/** Session state for the currently displayed issue/PR. */
let generation = 0
let currentCtx: PageContext | null = null
let currentBoards: InjectedBoard[] = []
let contentNodeId: string | null = null
let membershipPromise: Promise<void> | null = null
const membership = new Map<string, MembershipEntry>()

function sameCtx(a: PageContext | null, b: PageContext | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

async function resolveMembership(myGen: number): Promise<void> {
  const ctx = currentCtx
  if (!ctx || currentBoards.length === 0) return
  try {
    const res = await sendMessage<GetGlobalBoardsStateResponse>({
      type: 'GET_GLOBAL_BOARDS_STATE',
      payload: { owner: ctx.owner, name: ctx.name, number: ctx.number, kind: ctx.kind },
    })
    if (myGen !== generation) return
    if (!res.ok) {
      console.warn(LOG, 'Membership resolution failed:', res.error)
      return
    }
    contentNodeId = res.contentNodeId
    const entries: MembershipEntry[] = []
    for (const board of currentBoards) {
      const row = res.rows.find((r) => r.projectId === board.projectId)
      const entry: MembershipEntry = {
        projectId: board.projectId,
        status: row?.itemId ? 'member' : 'not-member',
        itemId: row?.itemId ?? null,
      }
      membership.set(entry.projectId, entry)
      entries.push(entry)
    }
    dispatch(NP_EVENTS.membership, {
      contentNodeId: res.contentNodeId,
      entries,
    } satisfies NpMembershipDetail)
  } catch (err) {
    console.warn(LOG, 'Membership resolution error:', err)
  }
}

function resolveMembershipOnce(): void {
  const myGen = generation
  if (!membershipPromise) {
    membershipPromise = resolveMembership(myGen)
  }
}

async function sync(): Promise<void> {
  const ctx = pageContextFromLocation(window.location)
  if (sameCtx(ctx, currentCtx) && (ctx === null || currentBoards.length > 0)) return

  generation += 1
  const myGen = generation
  currentCtx = ctx
  currentBoards = []
  contentNodeId = null
  membership.clear()
  membershipPromise = null

  if (!ctx) {
    dispatch(NP_EVENTS.config, { page: null, boards: [] } satisfies NpConfigDetail)
    return
  }

  const cfg = await loadConfig()
  if (myGen !== generation) return
  if (!showGlobalBoardsSection(ctx.owner, cfg.crossOrgBoardUrls)) {
    dispatch(NP_EVENTS.config, { page: ctx, boards: [] } satisfies NpConfigDetail)
    return
  }

  try {
    const res = await sendMessage<GetNativePickerBoardsResponse>({
      type: 'GET_NATIVE_PICKER_BOARDS',
    })
    if (myGen !== generation) return
    if (!res.ok) {
      console.warn(LOG, 'Board metadata unavailable:', res.error)
      dispatch(NP_EVENTS.config, { page: ctx, boards: [] } satisfies NpConfigDetail)
      return
    }
    currentBoards = res.boards.filter(
      (b) => b.org.toLowerCase() !== ctx.owner.toLowerCase(),
    )
    dispatch(NP_EVENTS.config, { page: ctx, boards: currentBoards } satisfies NpConfigDetail)

    // Proactive repos resolve membership at page load (sidebar display, checked
    // state); other repos defer until the picker is actually opened.
    if (currentBoards.length > 0 && isTargetRepo(cfg, ctx.owner, ctx.name)) {
      resolveMembershipOnce()
    }
  } catch (err) {
    console.warn(LOG, 'Config resolution error:', err)
  }
}

function bindEvents(): void {
  document.addEventListener(NP_EVENTS.requestMembership, () => {
    resolveMembershipOnce()
  })

  document.addEventListener(NP_EVENTS.nativeMutation, (ev) => {
    const detail = parseDetail<{ projectId: string; action: string; itemId: string | null }>(
      (ev as CustomEvent).detail,
    )
    if (!detail) return
    membership.set(detail.projectId, {
      projectId: detail.projectId,
      status: detail.action === 'added' ? 'member' : 'not-member',
      itemId: detail.itemId,
    })
  })

  document.addEventListener(NP_EVENTS.prToggle, (ev) => {
    const detail = parseDetail<NpPrToggleDetail>((ev as CustomEvent).detail)
    if (!detail) return
    void handlePrToggle(detail)
  })

  const run = (): void => {
    void sync()
  }
  for (const evName of ['turbo:load', 'turbo:render', 'pjax:end', 'soft-nav:end', 'pjax:success']) {
    document.addEventListener(evName, run)
  }
  window.addEventListener('popstate', run)
}

async function handlePrToggle(detail: NpPrToggleDetail): Promise<void> {
  // Never mutate a project the user has not configured (untrusted event input).
  const board = currentBoards.find((b) => b.projectId === detail.projectId)
  if (!board) {
    console.warn(LOG, 'Ignoring toggle for unconfigured project')
    return
  }
  const fail = (error: string): void => {
    const current = membership.get(board.projectId)
    dispatch(NP_EVENTS.prToggleResult, {
      projectId: board.projectId,
      status: current?.status ?? 'not-member',
      itemId: current?.itemId ?? null,
      error,
    } satisfies NpPrToggleResultDetail)
  }
  try {
    // Both directions need resolved state (contentNodeId for add, itemId for remove).
    resolveMembershipOnce()
    await membershipPromise
    if (detail.desired === 'member') {
      if (!contentNodeId) {
        fail('Could not resolve issue/PR node id.')
        return
      }
      const res = await sendMessage<{ ok: boolean; error?: string; data?: unknown }>({
        type: 'ADD_TO_PROJECT',
        payload: { projectId: board.projectId, contentNodeId },
      })
      if (!res.ok) {
        fail(res.error ?? 'Add failed.')
        return
      }
      const itemId =
        (res.data as { addProjectV2ItemById?: { item?: { id?: string } } })?.addProjectV2ItemById
          ?.item?.id ?? null
      membership.set(board.projectId, { projectId: board.projectId, status: 'member', itemId })
      dispatch(NP_EVENTS.prToggleResult, {
        projectId: board.projectId,
        status: 'member',
        itemId,
      } satisfies NpPrToggleResultDetail)
      syncFocFieldCard(board.projectId, itemId)
    } else {
      const itemId = membership.get(board.projectId)?.itemId
      if (!itemId) {
        fail('No project item id known for removal.')
        return
      }
      const res = await sendMessage<{ ok: boolean; error?: string }>({
        type: 'DELETE_PROJECT_ITEM',
        payload: { projectId: board.projectId, itemId },
      })
      if (!res.ok) {
        fail(res.error ?? 'Remove failed.')
        return
      }
      membership.set(board.projectId, {
        projectId: board.projectId,
        status: 'not-member',
        itemId: null,
      })
      dispatch(NP_EVENTS.prToggleResult, {
        projectId: board.projectId,
        status: 'not-member',
        itemId: null,
      } satisfies NpPrToggleResultDetail)
      syncFocFieldCard(board.projectId, null)
    }
    console.log(LOG, `Delegated PR toggle done: ${board.title} → ${detail.desired}`)
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err))
  }
}

// Inject synchronously at document_start; everything else is async.
injectMainWorldScript()
bindEvents()
void sync()
