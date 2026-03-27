/**
 * GitHub-like FOC project card shell: header (title + status row), expand/collapse, body slot.
 */

export type FocProjectCard = {
  root: HTMLElement
  body: HTMLElement
  /** Slot to inject the Status control into (always visible, even when collapsed). */
  statusSlot: HTMLElement
  setExpanded: (expanded: boolean) => void
  isExpanded: () => boolean
}

const EXPANDED_KEY = 'filoz-foc-card-expanded'

function sessionExpandedDefault(): boolean {
  try {
    const v = sessionStorage.getItem(EXPANDED_KEY)
    if (v === '0') return false
    if (v === '1') return true
  } catch {
    /* ignore */
  }
  return true
}

function persistExpanded(expanded: boolean): void {
  try {
    sessionStorage.setItem(EXPANDED_KEY, expanded ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function projectsIconSvg(): string {
  return `<svg class="filoz-foc-card-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M0 0h7v7H0V0Zm9 0h7v7H9V0ZM0 9h7v7H0V9Zm9 0h7v7H9V9Z"/></svg>`
}

const CHEVRON_DOWN =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.94l3.72-3.72a.749.749 0 0 1 1.06 0Z"/></svg>'
const CHEVRON_UP =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3.22 10.72a.749.749 0 0 1 0-1.06l4.25-4.25a.749.749 0 0 1 1.06 0l4.25 4.25a.749.749 0 1 1-1.06 1.06L8 6.06 4.28 9.78a.749.749 0 0 1-1.06 0Z"/></svg>'

export function createFocProjectCard(opts: { title: string; boardUrl?: string }): FocProjectCard {
  const root = document.createElement('div')
  root.className = 'filoz-foc-card'

  const header = document.createElement('div')
  header.className = 'filoz-foc-card-header'

  // Row 1: icon + title
  const titleRow = document.createElement('div')
  titleRow.className = 'filoz-foc-card-title-row'

  const iconWrap = document.createElement('span')
  iconWrap.className = 'filoz-foc-card-icon-wrap'
  iconWrap.innerHTML = projectsIconSvg()

  const titleEl = opts.boardUrl
    ? document.createElement('a')
    : document.createElement('span')
  titleEl.className = 'filoz-foc-card-title'
  titleEl.textContent = opts.title
  if (opts.boardUrl && titleEl instanceof HTMLAnchorElement) {
    titleEl.href = opts.boardUrl
    titleEl.target = '_blank'
    titleEl.rel = 'noopener'
  }

  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.className = 'filoz-foc-card-chevron'
  toggle.setAttribute('aria-label', `Expand or collapse ${opts.title} project fields`)

  titleRow.append(iconWrap, titleEl, toggle)

  // Row 2: "Status" label + status control slot (no chevron — matches issue card layout)
  const statusRow = document.createElement('div')
  statusRow.className = 'filoz-foc-card-status-row'

  const statusLabel = document.createElement('span')
  statusLabel.className = 'filoz-foc-card-status-label'
  statusLabel.textContent = 'Status'

  const statusSlot = document.createElement('div')
  statusSlot.className = 'filoz-foc-card-status-slot'

  statusRow.append(statusLabel, statusSlot)
  header.append(titleRow, statusRow)

  const body = document.createElement('div')
  body.className = 'filoz-foc-card-body'

  let expanded = sessionExpandedDefault()

  const applyExpanded = (): void => {
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false')
    toggle.innerHTML = expanded ? CHEVRON_UP : CHEVRON_DOWN
    body.hidden = !expanded
    persistExpanded(expanded)
  }

  const setExpanded = (v: boolean): void => {
    expanded = v
    applyExpanded()
  }

  toggle.addEventListener('click', () => {
    setExpanded(!expanded)
  })

  root.append(header, body)
  applyExpanded()

  return { root, body, statusSlot, setExpanded, isExpanded: () => expanded }
}
