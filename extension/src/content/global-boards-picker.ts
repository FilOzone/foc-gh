/**
 * Projects gear → **Global boards** section (spec 006): membership checkboxes + link.
 */
import type { PageContext } from '../lib/github-url.js'
import type { ExtensionMessage, GetGlobalBoardsStateResponse, GlobalBoardRowState } from '../lib/messages.js'
import { loadConfig, showGlobalBoardsSection } from '../lib/project-config.js'

function sendMessage<T>(msg: ExtensionMessage): Promise<T> {
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

let observer: MutationObserver | null = null
let pageCtx: PageContext | null = null
let injectGen = 0
let rowIdSeq = 0
let debounceTimer: ReturnType<typeof setTimeout> | null = null

type PickerKind = 'issue' | 'pr'
type PickerContext = { el: HTMLElement; kind: PickerKind }

function findPicker(): PickerContext | null {
  const input = document.querySelector<HTMLInputElement>(
    'input[placeholder="Filter projects"], input[placeholder*="Filter project"]',
  )
  if (!input) return null

  let el: HTMLElement | null = input.parentElement
  while (el && el !== document.body) {
    if (el.tagName.toLowerCase() === 'project-picker') return { el, kind: 'pr' }
    if (el.getAttribute('role') === 'dialog') return { el, kind: 'issue' }
    el = el.parentElement
  }
  return null
}

function extractNewItemId(data: unknown): string | null {
  const root = data as { addProjectV2ItemById?: { item?: { id?: string } } } | undefined
  const id = root?.addProjectV2ItemById?.item?.id
  return typeof id === 'string' && id.length > 0 ? id : null
}

async function handleCheckboxChange(cb: HTMLInputElement, errEl: HTMLElement): Promise<void> {
  const projectId = cb.dataset.projectId ?? ''
  const contentId = cb.dataset.contentId ?? ''
  const prevItemId = cb.dataset.itemId ?? ''
  errEl.hidden = true
  errEl.textContent = ''

  if (cb.checked) {
    const r = await sendMessage<{ ok: boolean; error?: string; data?: unknown }>({
      type: 'ADD_TO_PROJECT',
      payload: { projectId, contentNodeId: contentId },
    })
    if (!r.ok) {
      cb.checked = false
      errEl.textContent = r.error ?? 'Could not add to board.'
      errEl.hidden = false
      return
    }
    const nid = extractNewItemId(r.data)
    if (nid) cb.dataset.itemId = nid
    document.dispatchEvent(new CustomEvent('filoz:boards-changed'))
    return
  }

  if (!prevItemId) return
  const dr = await sendMessage<{ ok: boolean; error?: string }>({
    type: 'DELETE_PROJECT_ITEM',
    payload: { projectId, itemId: prevItemId },
  })
  if (!dr.ok) {
    cb.checked = true
    errEl.textContent = dr.error ?? 'Could not remove from board.'
    errEl.hidden = false
    return
  }
  cb.dataset.itemId = ''
  document.dispatchEvent(new CustomEvent('filoz:boards-changed'))
}

function renderRow(row: GlobalBoardRowState, contentNodeId: string): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'filoz-global-board-row'

  const cb = document.createElement('input')
  cb.type = 'checkbox'
  cb.disabled = true
  cb.checked = row.itemId !== null
  cb.dataset.projectId = row.projectId
  cb.dataset.itemId = row.itemId ?? ''
  cb.dataset.contentId = contentNodeId
  const rowId = `filoz-global-board-cb-${++rowIdSeq}`
  cb.id = rowId

  const label = document.createElement('label')
  label.htmlFor = rowId
  label.textContent = row.label

  const errEl = document.createElement('div')
  errEl.className = 'filoz-global-board-row-error'
  errEl.hidden = true

  wrap.appendChild(cb)
  wrap.appendChild(label)
  wrap.appendChild(errEl)

  requestAnimationFrame(() => {
    cb.disabled = false
    cb.addEventListener('change', () => {
      void handleCheckboxChange(cb, errEl)
    })
  })

  return wrap
}

/** Build the section shell (heading + Loading… status). Caller sets data attributes. */
function buildGlobalSection(): HTMLElement {
  const section = document.createElement('section')
  section.className = 'filoz-global-boards'
  section.setAttribute('aria-label', 'Global boards')

  const heading = document.createElement('div')
  heading.className = 'filoz-global-boards-heading'
  heading.textContent = 'Global boards'
  section.appendChild(heading)

  const status = document.createElement('div')
  status.className = 'filoz-global-boards-status filoz-muted'
  status.textContent = 'Loading…'
  section.appendChild(status)

  return section
}

function populateSection(section: HTMLElement, res: GetGlobalBoardsStateResponse): void {
  section.querySelector('.filoz-global-boards-status')?.remove()

  if (!res.ok) {
    const err = document.createElement('div')
    err.className = 'filoz-global-boards-status filoz-muted'
    err.textContent = res.error
    section.appendChild(err)
    return
  }

  for (const row of res.rows) {
    section.appendChild(renderRow(row, res.contentNodeId))
  }

  if (res.rows.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'filoz-muted'
    empty.style.cssText = 'font-size:12px;padding:4px 2px'
    empty.textContent = 'No Global board URLs configured.'
    section.appendChild(empty)
  }
}

/**
 * Issue picker: mount Global boards as a <li> at the bottom of the ActionList <ul>.
 * The UL is a direct child of FilteredActionList-Container (display:flex;flex-direction:row)
 * and is itself display:block, so it scrolls correctly with the project list.
 */
async function injectGlobalSectionForIssue(
  ctx: PickerContext,
  page: PageContext,
  gen: number,
): Promise<void> {
  const ul = ctx.el.querySelector<HTMLElement>(
    'ul[class*="FilteredActionList-ActionList"], ul[class*="ActionList-ActionList"]',
  )
  if (!ul) return

  const section = buildGlobalSection()

  // Wrap in <li> — valid UL child; suppress bullet/padding
  const li = document.createElement('li')
  li.setAttribute('data-filoz-global-boards', '1')
  li.style.cssText = 'list-style:none;padding:0;margin:0'
  li.appendChild(section)
  ul.appendChild(li)

  let res: GetGlobalBoardsStateResponse
  try {
    res = await sendMessage<GetGlobalBoardsStateResponse>({
      type: 'GET_GLOBAL_BOARDS_STATE',
      payload: { owner: page.owner, name: page.name, number: page.number, kind: page.kind },
    })
  } catch (e) {
    if (gen !== injectGen) { li.remove(); return }
    const status = section.querySelector('.filoz-global-boards-status')
    if (status) status.textContent = String(e)
    return
  }

  if (gen !== injectGen) { li.remove(); return }
  // Re-position after async fetch — React may have added more groups during the await
  if (ul.lastElementChild !== li) ul.appendChild(li)
  populateSection(section, res)
}

/**
 * PR picker: inject a "Global" tab button into the <nav role="tablist"> inside
 * <tab-container> and a matching panel below the existing panels.
 *
 * Catalyst tab-container manages its own tabs by index; we add our tab OUTSIDE that
 * management and handle show/hide manually, listening to native tab clicks to restore
 * the correct state when the user switches away.
 */
async function injectGlobalTabForPR(
  ctx: PickerContext,
  page: PageContext,
  gen: number,
): Promise<void> {
  const tabContainer = ctx.el.querySelector<HTMLElement>('tab-container')
  if (!tabContainer) return

  const tabList = tabContainer.querySelector<HTMLElement>('[role="tablist"]')
  if (!tabList) return

  // Build Global tab button — styled via .filoz-pr-global-tab, no hashed class names
  const globalTabBtn = document.createElement('button')
  globalTabBtn.setAttribute('role', 'tab')
  globalTabBtn.setAttribute('type', 'button')
  globalTabBtn.setAttribute('aria-selected', 'false')
  globalTabBtn.setAttribute('data-filoz-global-tab', '1')
  globalTabBtn.className = 'filoz-pr-global-tab'
  globalTabBtn.textContent = 'Global'
  tabList.appendChild(globalTabBtn)

  // The native content container holds: the tablist nav + native panels + virtual-list.
  // We must NOT hide the nav (that's the tab bar). Only hide panels and content list.
  const nativeContent = [...tabContainer.children].find(
    (c): c is HTMLElement =>
      c instanceof HTMLElement && !c.hasAttribute('data-filoz-global-boards'),
  )
  if (!nativeContent) return

  // Elements inside nativeContent to hide when Global is active (panels + project list)
  const getNativeHideables = (): HTMLElement[] => [
    ...nativeContent.querySelectorAll<HTMLElement>('[role="tabpanel"]'),
    ...nativeContent.querySelectorAll<HTMLElement>('virtual-list'),
  ]

  // Build Global tab panel (hidden by default, shown when tab is active)
  const panel = document.createElement('div')
  panel.setAttribute('role', 'tabpanel')
  panel.setAttribute('data-filoz-global-boards', '1')
  panel.className = 'filoz-global-boards-panel'
  panel.hidden = true

  const section = buildGlobalSection()
  section.querySelector('.filoz-global-boards-heading')?.remove()
  section.style.borderTop = 'none'
  section.style.marginTop = '0'
  panel.appendChild(section)
  tabContainer.appendChild(panel)

  // Global tab click: hide native panels/list (keep nav visible), show our panel.
  // stopPropagation() prevents Catalyst from firing tab-container-change, which
  // would immediately undo our show/hide.
  globalTabBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    tabList.querySelectorAll<HTMLElement>('[role="tab"]:not([data-filoz-global-tab])').forEach(t => {
      t.setAttribute('aria-selected', 'false')
    })
    getNativeHideables().forEach(el => { el.hidden = true })
    globalTabBtn.setAttribute('aria-selected', 'true')
    panel.hidden = false
  })

  // Native tab clicks: restore native panels/list, hide our panel
  const restoreNative = (): void => {
    getNativeHideables().forEach(el => { el.hidden = false })
    panel.hidden = true
    globalTabBtn.setAttribute('aria-selected', 'false')
  }
  tabList.querySelectorAll<HTMLElement>('[role="tab"]:not([data-filoz-global-tab])').forEach(t => {
    t.addEventListener('click', restoreNative)
  })
  tabContainer.addEventListener('tab-container-change', restoreNative)

  let res: GetGlobalBoardsStateResponse
  try {
    res = await sendMessage<GetGlobalBoardsStateResponse>({
      type: 'GET_GLOBAL_BOARDS_STATE',
      payload: { owner: page.owner, name: page.name, number: page.number, kind: page.kind },
    })
  } catch (e) {
    if (gen !== injectGen) { globalTabBtn.remove(); panel.remove(); return }
    const status = section.querySelector('.filoz-global-boards-status')
    if (status) status.textContent = String(e)
    return
  }

  if (gen !== injectGen) { globalTabBtn.remove(); panel.remove(); return }
  populateSection(section, res)
}

async function injectGlobalBoards(ctx: PickerContext, page: PageContext): Promise<void> {
  const { el: dialog } = ctx

  if (ctx.kind === 'issue') {
    // Issue picker: React renders groups asynchronously, so our <li> may not be last.
    // Re-position to end on each DOM mutation without cancelling the in-flight fetch.
    const existingLi = dialog.querySelector<HTMLElement>('li[data-filoz-global-boards="1"]')
    if (existingLi) {
      const ul = dialog.querySelector<HTMLElement>(
        'ul[class*="FilteredActionList-ActionList"], ul[class*="ActionList-ActionList"]',
      )
      if (ul && ul.lastElementChild !== existingLi) ul.appendChild(existingLi)
      return
    }
  } else {
    if (dialog.querySelector('[data-filoz-global-boards="1"]')) return
  }

  const cfgEarly = await loadConfig()
  if (!showGlobalBoardsSection(page.owner, cfgEarly.crossOrgBoardUrls)) return

  const gen = ++injectGen
  dialog.querySelector('[data-filoz-global-boards="1"]')?.remove()
  dialog.querySelector('[data-filoz-global-tab]')?.remove()

  if (ctx.kind === 'pr') {
    await injectGlobalTabForPR(ctx, page, gen)
  } else {
    await injectGlobalSectionForIssue(ctx, page, gen)
  }
}

function scheduleInject(): void {
  if (debounceTimer !== null) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    const page = pageCtx
    if (!page) return
    const picker = findPicker()
    if (picker) void injectGlobalBoards(picker, page)
  }, 80)
}

function onDomChange(): void {
  scheduleInject()
}

export function initGlobalBoardsPicker(page: PageContext): void {
  pageCtx = page
  if (observer) observer.disconnect()
  observer = new MutationObserver(() => {
    onDomChange()
  })
  observer.observe(document.body, { childList: true, subtree: true })
  scheduleInject()
}

export function destroyGlobalBoardsPicker(): void {
  pageCtx = null
  rowIdSeq = 0
  injectGen += 1
  if (observer) {
    observer.disconnect()
    observer = null
  }
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  const picker = findPicker()
  if (picker) {
    picker.el.querySelector('[data-filoz-global-boards="1"]')?.remove()
    picker.el.querySelector('[data-filoz-global-tab]')?.remove()
  }
}
