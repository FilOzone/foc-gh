/**
 * Places the FOC panel inside GitHub’s right sidebar Projects region,
 * before the Milestone block when present (see specs/002 contracts).
 */

const PANEL_HOST_ID = 'filoz-foc-board-panel-host'

export function findLayoutSidebar(): Element | null {
  const sticky = document.querySelector('[data-testid="sticky-sidebar"]')
  if (sticky) return sticky
  const layout = document.querySelector('.Layout-sidebar')
  if (layout) return layout
  const legacy = document.querySelector('[data-testid="issue-viewer-sidebar"]')
  if (legacy) return legacy
  const assignees = document.querySelector('[data-testid="sidebar-assignees-section"]')
  if (assignees?.parentElement) return assignees.parentElement
  const issuesAside = document.querySelector('aside[aria-label="Issues"]')
  if (issuesAside) return issuesAside
  const prAside = document.querySelector(
    'aside[aria-label="Pull request"], aside[aria-label="Pull requests"]',
  )
  if (prAside) return prAside
  const prConversation = document.querySelector('#pr-conversation-sidebar')
  if (prConversation) return prConversation
  return document.querySelector('[data-testid="conversation-sidebar"]')
}

function findMilestoneDiscussionItem(sidebar: Element): Element | null {
  const byTest = sidebar.querySelector('[data-testid="sidebar-milestones-section"]')
  if (byTest) {
    return byTest.closest('.discussion-sidebar-item') ?? byTest
  }
  const form = sidebar.querySelector('form[aria-label="Select milestones"]')
  return form?.closest('.discussion-sidebar-item') ?? null
}

/** Insert after native Projects chrome when no milestone anchor exists. */
function placeAfterProjectsBlock(sidebar: Element, host: HTMLDivElement): void {
  const projects = sidebar.querySelector('[data-testid="sidebar-projects-section"]')
  if (projects) {
    projects.after(host)
    return
  }
  const prProjectsForm = sidebar.querySelector('form[aria-label="Select projects"]')
  const prProjectsItem =
    prProjectsForm?.closest('.discussion-sidebar-item') ?? prProjectsForm?.parentElement
  if (prProjectsItem) {
    prProjectsItem.after(host)
    return
  }
  sidebar.append(host)
}

/**
 * Mounts `host` inside the layout sidebar: before Milestone when found,
 * else after the Projects section (legacy behavior).
 */
export function placePanelHost(host: HTMLDivElement): boolean {
  const sidebar = findLayoutSidebar()
  if (!sidebar) return false

  if (host.parentElement) {
    host.parentElement.removeChild(host)
  }

  const milestoneItem = findMilestoneDiscussionItem(sidebar)
  const parent = milestoneItem?.parentElement
  if (milestoneItem && parent) {
    parent.insertBefore(host, milestoneItem)
    return true
  }

  placeAfterProjectsBlock(sidebar, host)
  return true
}

export function getOrCreatePanelHost(): HTMLDivElement {
  let host = document.getElementById(PANEL_HOST_ID) as HTMLDivElement | null
  if (!host) {
    host = document.createElement('div')
    host.id = PANEL_HOST_ID
  }
  return host
}

export { PANEL_HOST_ID }
