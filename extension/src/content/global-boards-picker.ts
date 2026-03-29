/**
 * Projects picker → **Global boards** placeholder (spec 006).
 *
 * Listing boards and add/remove from this picker is not implemented yet; see
 * docs/global-boards-picker-status.md.
 */
import type { PageContext } from '../lib/github-url.js'
import { loadConfig, showGlobalBoardsSection } from '../lib/project-config.js'

let observer: MutationObserver | null = null
let pageCtx: PageContext | null = null
let injectGen = 0
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

function buildComingSoonSection(): HTMLElement {
  const section = document.createElement('section')
  section.className = 'filoz-global-boards'
  section.setAttribute('aria-label', 'Global boards')

  const heading = document.createElement('div')
  heading.className = 'filoz-global-boards-heading'
  heading.textContent = 'Global boards'
  section.appendChild(heading)

  const body = document.createElement('div')
  body.className = 'filoz-global-boards-status filoz-muted'
  body.style.marginTop = '4px'
  body.textContent =
    'Coming soon. Choosing global boards in this picker (add/remove from the issue or PR) is not implemented yet. Use the board on github.com or the FOC sidebar on configured repos.'
  section.appendChild(body)

  return section
}

/**
 * Issue picker: mount Global boards as a <li> at the bottom of the ActionList <ul>.
 */
function injectGlobalSectionForIssue(ctx: PickerContext, gen: number): void {
  const ul = ctx.el.querySelector<HTMLElement>(
    'ul[class*="FilteredActionList-ActionList"], ul[class*="ActionList-ActionList"]',
  )
  if (!ul) return

  const section = buildComingSoonSection()

  const li = document.createElement('li')
  li.setAttribute('data-filoz-global-boards', '1')
  li.style.cssText = 'list-style:none;padding:0;margin:0'
  li.appendChild(section)
  ul.appendChild(li)

  if (gen !== injectGen) {
    li.remove()
    return
  }
  if (ul.lastElementChild !== li) ul.appendChild(li)
}

/**
 * PR picker: "Global" tab + panel with the same placeholder.
 */
function injectGlobalTabForPR(ctx: PickerContext, gen: number): void {
  const tabContainer = ctx.el.querySelector<HTMLElement>('tab-container')
  if (!tabContainer) return

  const tabList = tabContainer.querySelector<HTMLElement>('[role="tablist"]')
  if (!tabList) return

  const globalTabBtn = document.createElement('button')
  globalTabBtn.setAttribute('role', 'tab')
  globalTabBtn.setAttribute('type', 'button')
  globalTabBtn.setAttribute('aria-selected', 'false')
  globalTabBtn.setAttribute('data-filoz-global-tab', '1')
  globalTabBtn.className = 'filoz-pr-global-tab'
  globalTabBtn.textContent = 'Global'
  tabList.appendChild(globalTabBtn)

  const nativeContent = [...tabContainer.children].find(
    (c): c is HTMLElement =>
      c instanceof HTMLElement && !c.hasAttribute('data-filoz-global-boards'),
  )
  if (!nativeContent) return

  const getNativeHideables = (): HTMLElement[] => [
    ...nativeContent.querySelectorAll<HTMLElement>('[role="tabpanel"]'),
    ...nativeContent.querySelectorAll<HTMLElement>('virtual-list'),
  ]

  const panel = document.createElement('div')
  panel.setAttribute('role', 'tabpanel')
  panel.setAttribute('data-filoz-global-boards', '1')
  panel.className = 'filoz-global-boards-panel'
  panel.hidden = true

  const section = buildComingSoonSection()
  section.querySelector('.filoz-global-boards-heading')?.remove()
  section.style.borderTop = 'none'
  section.style.marginTop = '0'
  panel.appendChild(section)
  tabContainer.appendChild(panel)

  globalTabBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    tabList.querySelectorAll<HTMLElement>('[role="tab"]:not([data-filoz-global-tab])').forEach((t) => {
      t.setAttribute('aria-selected', 'false')
    })
    getNativeHideables().forEach((el) => {
      el.hidden = true
    })
    globalTabBtn.setAttribute('aria-selected', 'true')
    panel.hidden = false
  })

  const restoreNative = (): void => {
    getNativeHideables().forEach((el) => {
      el.hidden = false
    })
    panel.hidden = true
    globalTabBtn.setAttribute('aria-selected', 'false')
  }
  tabList.querySelectorAll<HTMLElement>('[role="tab"]:not([data-filoz-global-tab])').forEach((t) => {
    t.addEventListener('click', restoreNative)
  })
  tabContainer.addEventListener('tab-container-change', restoreNative)

  if (gen !== injectGen) {
    globalTabBtn.remove()
    panel.remove()
  }
}

async function injectGlobalBoards(ctx: PickerContext, page: PageContext): Promise<void> {
  const { el: dialog } = ctx

  if (ctx.kind === 'issue') {
    const existingLi = dialog.querySelector<HTMLElement>('li[data-filoz-global-boards="1"]')
    if (existingLi) {
      const ul = dialog.querySelector<HTMLElement>(
        'ul[class*="FilteredActionList-ActionList"], ul[class*="ActionList-ActionList"]',
      )
      if (ul && ul.lastElementChild !== existingLi) ul.appendChild(existingLi)
      return
    }
  } else if (dialog.querySelector('[data-filoz-global-boards="1"]')) {
    return
  }

  const cfgEarly = await loadConfig()
  if (!showGlobalBoardsSection(page.owner, cfgEarly.crossOrgBoardUrls)) return

  const gen = ++injectGen
  dialog.querySelector('[data-filoz-global-boards="1"]')?.remove()
  dialog.querySelector('[data-filoz-global-tab]')?.remove()

  if (ctx.kind === 'pr') {
    injectGlobalTabForPR(ctx, gen)
  } else {
    injectGlobalSectionForIssue(ctx, gen)
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
