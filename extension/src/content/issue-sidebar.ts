/**
 * Injects a FilOzone FOC Projects v2 panel beside GitHub's layout sidebar.
 * Selectors: current issue UI uses `[data-testid="sticky-sidebar"]`; older layouts
 * use `.Layout-sidebar`, `[data-testid="issue-viewer-sidebar"]`, or
 * `aside[aria-label="Issues"]`. Panel mounts after `[data-testid="sidebar-projects-section"]`
 * when present (else appends to the sidebar container).
 */
import { pageContextFromLocation } from '../lib/github-url.js'
import type { GetPanelStateMessage, ExtensionMessage } from '../lib/messages.js'
import type { SerializableProjectField } from '../lib/project-board-fields.js'
import { isTargetRepo, loadConfig } from '../lib/project-config.js'

const PANEL_HOST_ID = 'filoz-foc-board-panel-host'

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

function findSidebarContainer(): Element | null {
  const sticky = document.querySelector('[data-testid="sticky-sidebar"]')
  if (sticky) return sticky
  const layout = document.querySelector('.Layout-sidebar')
  if (layout) return layout
  const legacy = document.querySelector('[data-testid="issue-viewer-sidebar"]')
  if (legacy) return legacy
  const assignees = document.querySelector('[data-testid="sidebar-assignees-section"]')
  if (assignees?.parentElement) return assignees.parentElement
  return document.querySelector('aside[aria-label="Issues"]')
}

function placeHostAfterProjects(sidebar: Element, host: HTMLDivElement): void {
  const projects = sidebar.querySelector('[data-testid="sidebar-projects-section"]')
  if (projects) {
    projects.after(host)
    return
  }
  sidebar.append(host)
}

function ensureHost(): HTMLDivElement | null {
  const sidebar = findSidebarContainer()
  if (!sidebar) return null
  let host = document.getElementById(PANEL_HOST_ID) as HTMLDivElement | null
  if (!host) {
    host = document.createElement('div')
    host.id = PANEL_HOST_ID
  }
  placeHostAfterProjects(sidebar, host)
  return host
}

function clearHost(): void {
  document.getElementById(PANEL_HOST_ID)?.remove()
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

function el(html: string): HTMLElement {
  const t = document.createElement('template')
  t.innerHTML = html.trim()
  const n = t.content.firstElementChild
  if (!n || !(n instanceof HTMLElement)) {
    throw new Error('invalid template')
  }
  return n
}

async function render(host: HTMLDivElement, ctx: NonNullable<ReturnType<typeof pageContextFromLocation>>): Promise<void> {
  const myToken = ++loadToken
  const cfg = await loadConfig()

  if (!isTargetRepo(cfg, ctx.owner, ctx.name)) {
    clearHost()
    return
  }

  host.innerHTML = ''
  const panel = el(`
    <div class="filoz-foc-panel">
      <h3>FOC program project</h3>
      <p class="filoz-muted">Cross-org panel — see <a href="${cfg.crossOrgBoardUrls[0] ?? '#'}" target="_blank" rel="noopener">board</a></p>
      <div class="filoz-body">Loading…</div>
    </div>
  `) as HTMLDivElement

  const body = panel.querySelector('.filoz-body') as HTMLDivElement

  if (!cfg.githubApiToken) {
    body.innerHTML = `
      <p class="filoz-error">No API token configured.</p>
      <button type="button" class="filoz-open-options">Open options</button>
    `
    body.querySelector('.filoz-open-options')?.addEventListener('click', () => {
      void chrome.runtime.openOptionsPage()
    })
    host.append(panel)
    return
  }

  host.append(panel)

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
    body.innerHTML = `<p class="filoz-error">${String(e)}</p>`
    return
  }

  if (myToken !== loadToken) return

  if (!state.ok) {
    if (state.code === 'NO_TOKEN') {
      body.innerHTML = `
        <p class="filoz-error">${state.error}</p>
        <button type="button" class="filoz-open-options">Open options</button>
      `
      body.querySelector('.filoz-open-options')?.addEventListener('click', () => {
        void chrome.runtime.openOptionsPage()
      })
      return
    }
    body.innerHTML = `<p class="filoz-error">${state.error}</p>`
    return
  }

  const s = state as PanelStateOk
  const linkedItem = s.item

  if (!linkedItem) {
    body.innerHTML = `
      <p><strong>${escapeHtml(s.projectTitle)}</strong> — not linked.</p>
      <button type="button" class="filoz-add-btn">Add to FOC project</button>
      <p class="filoz-add-err filoz-error" hidden></p>
    `
    const addBtn = body.querySelector('.filoz-add-btn') as HTMLButtonElement
    const addErr = body.querySelector('.filoz-add-err') as HTMLParagraphElement
    addBtn.addEventListener('click', async () => {
      addErr.hidden = true
      addBtn.disabled = true
      try {
        const res = await sendMessage<{ ok: boolean; error?: string }>({
          type: 'ADD_TO_PROJECT',
          payload: { projectId: s.projectId, contentNodeId: s.contentNodeId },
        })
        if (!res.ok) {
          addErr.textContent = res.error ?? 'Add failed'
          addErr.hidden = false
          addBtn.disabled = false
          return
        }
        await render(host, ctx)
      } catch (e) {
        addErr.textContent = String(e)
        addErr.hidden = false
        addBtn.disabled = false
      }
    })
    return
  }

  const fields = linkedItem.fieldLabels
  const rowsHtml = Object.keys(fields)
    .sort()
    .map((k) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(fields[k] ?? '')}</dd>`)
    .join('')

  const catalogRows = s.boardFields
    .map((f) => {
      if (f.kind === 'single_select') {
        return `<dt>${escapeHtml(f.name)}</dt><dd>${escapeHtml(f.dataType)} — ${String(f.options.length)} option(s)</dd>`
      }
      if (f.kind === 'iteration') {
        return `<dt>${escapeHtml(f.name)}</dt><dd>${escapeHtml(f.dataType)} — ${String(f.iterations.length)} active, ${String(f.completedIterations.length)} completed (sample)</dd>`
      }
      return `<dt>${escapeHtml(f.name)}</dt><dd>${escapeHtml(f.dataType)}</dd>`
    })
    .join('')

  body.innerHTML = `
    <p>On <strong>${escapeHtml(s.projectTitle)}</strong></p>
    <details class="filoz-board-catalog"><summary>Board columns (${s.boardFields.length})</summary><dl>${catalogRows}</dl></details>
    <p class="filoz-values-heading">Values on this card</p>
    <dl>${rowsHtml}</dl>
    <div class="filoz-status-wrap"></div>
    <p class="filoz-status-msg filoz-success" hidden></p>
  `

  const statusWrap = body.querySelector('.filoz-status-wrap') as HTMLDivElement
  const statusMsg = body.querySelector('.filoz-status-msg') as HTMLParagraphElement

  if (ctx.kind === 'pull_request') {
    const p = document.createElement('p')
    p.className = 'filoz-muted'
    p.textContent =
      'Updating single-select fields on pull requests may be limited by GitHub; if a mutation fails, edit on the board.'
    statusWrap.append(p)
  }

  const singleSelects = s.boardFields.filter((f) => f.kind === 'single_select')
  if (singleSelects.length === 0) {
    statusWrap.append(
      el(`<p class="filoz-muted">No single-select columns on this board (nothing to update from the panel).</p>`),
    )
    return
  }

  const primaryName = (cfg.statusFieldName || 'Status').trim().toLowerCase()
  singleSelects.sort((a, b) => {
    const an = a.name.trim().toLowerCase()
    const bn = b.name.trim().toLowerCase()
    const ap = an === primaryName ? 0 : 1
    const bp = bn === primaryName ? 0 : 1
    if (ap !== bp) return ap - bp
    return a.name.localeCompare(b.name)
  })

  for (const fld of singleSelects) {
    const row = document.createElement('div')
    row.className = 'filoz-sel-row'

    const lab = document.createElement('label')
    lab.textContent = fld.name
    lab.setAttribute('for', `filoz-sel-${fld.id.replace(/[^a-z0-9_-]/gi, '-')}`)

    const sel = document.createElement('select')
    sel.id = `filoz-sel-${fld.id.replace(/[^a-z0-9_-]/gi, '-')}`
    sel.setAttribute('aria-label', fld.name)

    const currentVal = fields[fld.name] ?? ''
    const opt0 = document.createElement('option')
    opt0.value = ''
    opt0.textContent = '(choose)'
    sel.append(opt0)
    for (const o of fld.options) {
      const opt = document.createElement('option')
      opt.value = o.id
      opt.textContent = o.name
      if (o.name === currentVal) opt.selected = true
      sel.append(opt)
    }

    const updateBtn = document.createElement('button')
    updateBtn.type = 'button'
    updateBtn.textContent = 'Update'

    updateBtn.addEventListener('click', async () => {
      if (myToken !== loadToken) return
      statusMsg.hidden = true
      const optionId = sel.value
      if (!optionId) return
      updateBtn.disabled = true
      try {
        const res = await sendMessage<{ ok: boolean; error?: string }>({
          type: 'UPDATE_STATUS',
          payload: {
            projectId: s.projectId,
            itemId: linkedItem.itemId,
            fieldId: fld.id,
            optionId,
            fieldName: fld.name,
          },
        })
        if (!res.ok) {
          statusMsg.textContent = res.error ?? 'Update failed'
          statusMsg.classList.remove('filoz-success')
          statusMsg.classList.add('filoz-error')
          statusMsg.hidden = false
          updateBtn.disabled = false
          return
        }
        statusMsg.textContent = `Updated ${fld.name}.`
        statusMsg.classList.add('filoz-success')
        statusMsg.classList.remove('filoz-error')
        statusMsg.hidden = false
        await render(host, ctx)
      } catch (e) {
        statusMsg.textContent = String(e)
        statusMsg.classList.remove('filoz-success')
        statusMsg.classList.add('filoz-error')
        statusMsg.hidden = false
        updateBtn.disabled = false
      }
    })

    row.append(lab, sel, updateBtn)
    statusWrap.append(row)
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function sync(): Promise<void> {
  const ctx = pageContextFromLocation(window.location)
  if (!ctx) {
    clearHost()
    return
  }

  const cfg = await loadConfig()
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
  const run = (): void => {
    void sync()
  }
  for (const ev of ['turbo:load', 'turbo:render', 'pjax:end', 'soft-nav:end', 'pjax:success']) {
    document.addEventListener(ev, run)
  }
  window.addEventListener('popstate', run)
}

void sync()
bindNavigation()
