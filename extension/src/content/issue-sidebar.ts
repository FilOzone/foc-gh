/**
 * FilOzone FOC Projects v2 panel: GitHub-native card in Projects region (spec 002).
 */
import { pageContextFromLocation } from '../lib/github-url.js'
import type { GetPanelStateMessage, ExtensionMessage } from '../lib/messages.js'
import type { SerializableProjectField } from '../lib/project-board-fields.js'
import {
  destroyGlobalBoardsPicker,
  initGlobalBoardsPicker,
} from './global-boards-picker.js'
import { isTargetRepo, loadConfig, resolveGithubBearer, showGlobalBoardsSection } from '../lib/project-config.js'
import { getOrCreatePanelHost, placePanelHost } from './projects-sidebar-mount.js'
import { createFocProjectCard } from './foc-project-card.js'
import { renderEditableProjectFields } from './foc-field-renderer.js'
import { updateProjectItemField } from '../lib/project-item-mutations.js'
import { syncNativeProjectsExpand } from './native-projects-expand.js'

let loadToken = 0

function injectStylesheet(): void {
  const id = 'filoz-foc-sidebar-css'
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = chrome.runtime.getURL('sidebar.css')
  document.documentElement.appendChild(link)
}

function ensureHost(): HTMLDivElement | null {
  const host = getOrCreatePanelHost()
  const ok = placePanelHost(host)
  if (!ok) return null
  return host
}

function clearHost(): void {
  document.getElementById('filoz-foc-board-panel-host')?.remove()
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

type PanelStateOk = {
  ok: true
  projectId: string
  projectTitle: string
  projectUrl?: string
  primaryBoardUrl: string
  contentNodeId: string
  boardFields: SerializableProjectField[]
  item: { itemId: string; fieldLabels: Record<string, string> } | null
}

type PanelStateErr = {
  ok: false
  code?: 'NO_TOKEN'
  error: string
}

type PanelState = PanelStateOk | PanelStateErr

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Render the Status single-select pill into the card header slot. */
function renderStatusInSlot(
  slot: HTMLElement,
  opts: {
    projectId: string
    itemId: string
    statusField: Extract<SerializableProjectField, { kind: 'single_select' }>
    currentValue: string
    stale: () => boolean
    onReload: () => void | Promise<void>
  },
): void {
  slot.innerHTML = ''
  const { projectId, itemId, statusField, currentValue, stale, onReload } = opts

  const wrap = document.createElement('div')
  wrap.className = 'filoz-status-select-wrap'

  const sel = document.createElement('select')
  sel.className = 'filoz-status-select'
  sel.setAttribute('aria-label', statusField.name)

  const empty = document.createElement('option')
  empty.value = ''
  empty.textContent = '—'
  sel.append(empty)

  for (const o of statusField.options) {
    const opt = document.createElement('option')
    opt.value = o.id
    opt.textContent = o.name
    if (o.name === currentValue || o.id === currentValue) opt.selected = true
    sel.append(opt)
  }

  const errEl = document.createElement('p')
  errEl.className = 'filoz-field-err filoz-error'
  errEl.hidden = true

  sel.addEventListener('change', async () => {
    if (stale()) return
    const optionId = sel.value
    if (!optionId) return
    errEl.hidden = true
    sel.disabled = true
    const res = await updateProjectItemField({
      projectId,
      itemId,
      fieldId: statusField.id,
      fieldName: statusField.name,
      value: { kind: 'single_select', optionId },
    })
    sel.disabled = false
    if (!res.ok) {
      errEl.textContent = res.error ?? 'Update failed'
      errEl.hidden = false
      return
    }
    await onReload()
  })

  const chevronSvg = document.createElement('span')
  chevronSvg.className = 'filoz-status-select-arrow'
  chevronSvg.setAttribute('aria-hidden', 'true')
  chevronSvg.innerHTML =
    '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.94l3.72-3.72a.749.749 0 0 1 1.06 0Z"/></svg>'

  wrap.append(sel, chevronSvg)
  slot.append(wrap, errEl)
}

async function render(
  host: HTMLDivElement,
  ctx: NonNullable<ReturnType<typeof pageContextFromLocation>>,
): Promise<void> {
  const myToken = ++loadToken
  const cfg = await loadConfig()

  if (!isTargetRepo(cfg, ctx.owner, ctx.name)) {
    clearHost()
    return
  }

  host.innerHTML = ''
  const card = createFocProjectCard({
    title: 'FOC',
    boardUrl: cfg.crossOrgBoardUrls[0],
    initialExpanded: cfg.issuePrProjectsAutoExpand,
  })
  host.append(card.root)

  const bodySlot = card.body
  bodySlot.innerHTML = '<p class="filoz-muted" style="padding:8px 0;margin:0">Loading…</p>'

  if (!resolveGithubBearer(cfg)) {
    card.statusSlot.innerHTML = ''
    bodySlot.innerHTML = `
      <p class="filoz-error">No GitHub API credentials configured. Connect GitHub or add a PAT in extension options.</p>
      <button type="button" class="filoz-btn filoz-open-options">Open options</button>
    `
    bodySlot.querySelector('.filoz-open-options')?.addEventListener('click', () => {
      void chrome.runtime.openOptionsPage()
    })
    return
  }

  let state: PanelState
  try {
    state = await sendMessage<PanelState>({
      type: 'GET_PANEL_STATE',
      payload: {
        owner: ctx.owner,
        name: ctx.name,
        number: ctx.number,
        kind: ctx.kind,
      },
    } satisfies GetPanelStateMessage)
  } catch (e) {
    if (myToken !== loadToken) return
    bodySlot.innerHTML = `<p class="filoz-error">${escapeHtml(String(e))}</p>`
    return
  }

  if (myToken !== loadToken) return

  if (!state.ok) {
    if (state.code === 'NO_TOKEN') {
      bodySlot.innerHTML = `
        <p class="filoz-error">${escapeHtml(state.error)}</p>
        <button type="button" class="filoz-btn filoz-open-options">Open options</button>
      `
      bodySlot.querySelector('.filoz-open-options')?.addEventListener('click', () => {
        void chrome.runtime.openOptionsPage()
      })
      return
    }
    bodySlot.innerHTML = `<p class="filoz-error">${escapeHtml(state.error)}</p>`
    return
  }

  const s = state as PanelStateOk

  // Update title from actual project name and URL
  const titleEl = card.root.querySelector('.filoz-foc-card-title')
  if (titleEl) {
    titleEl.textContent = s.projectTitle
    if (s.projectUrl && titleEl instanceof HTMLAnchorElement) {
      titleEl.href = s.projectUrl
    }
  }

  const linkedItem = s.item

  if (!linkedItem) {
    // Not on the board — hide the inline card entirely.
    // Use the gear picker (Global boards section) to add this issue/PR to the board.
    clearHost()
    return
  }

  const statusName = (cfg.statusFieldName || 'Status').trim()

  // Render Status in header slot
  const statusField = s.boardFields.find(
    (f): f is Extract<SerializableProjectField, { kind: 'single_select' }> =>
      f.kind === 'single_select' && f.name.trim().toLowerCase() === statusName.toLowerCase(),
  )
  if (statusField) {
    renderStatusInSlot(card.statusSlot, {
      projectId: s.projectId,
      itemId: linkedItem.itemId,
      statusField,
      currentValue: linkedItem.fieldLabels[statusField.name] ?? '',
      stale: () => myToken !== loadToken,
      onReload: async () => { await render(host, ctx) },
    })
  }

  // Render remaining editable fields in body
  bodySlot.innerHTML = ''
  renderEditableProjectFields(bodySlot, {
    projectId: s.projectId,
    itemId: linkedItem.itemId,
    boardFields: s.boardFields,
    fieldLabels: linkedItem.fieldLabels,
    statusFieldName: statusName,
    stale: () => myToken !== loadToken,
    onReload: async () => { await render(host, ctx) },
  })
}

async function sync(): Promise<void> {
  const ctx = pageContextFromLocation(window.location)
  if (!ctx) {
    clearHost()
    destroyGlobalBoardsPicker()
    syncNativeProjectsExpand(false)
    return
  }

  const cfg = await loadConfig()
  syncNativeProjectsExpand(cfg.issuePrProjectsAutoExpand)

  // Gear picker runs on all pages where visibility applies — not gated by target repos
  if (showGlobalBoardsSection(ctx.owner, cfg.crossOrgBoardUrls)) {
    injectStylesheet()
    initGlobalBoardsPicker(ctx)
  } else {
    destroyGlobalBoardsPicker()
  }

  if (!isTargetRepo(cfg, ctx.owner, ctx.name)) {
    clearHost()
    return
  }

  injectStylesheet()
  const host = ensureHost()
  if (!host) return
  await render(host, ctx)
}

function bindNavigation(): void {
  const run = (): void => { void sync() }
  for (const ev of ['turbo:load', 'turbo:render', 'pjax:end', 'soft-nav:end', 'pjax:success']) {
    document.addEventListener(ev, run)
  }
  window.addEventListener('popstate', run)
  document.addEventListener('filoz:boards-changed', run)
}

void sync()
bindNavigation()
