/**
 * When enabled, expands native GitHub Projects panels in the issue/PR sidebar.
 * - Issues: uses React-controlled `button[aria-expanded="false"]` toggle
 * - PRs: uses `collapsible-sidebar-widget` custom element with `.setOpen()`
 * Runs on all matching issue/PR URLs (not limited to extension target repos).
 * Uses stable host selectors (data-testid, ARIA, custom element tag) per constitution.
 */

import { findLayoutSidebar } from './projects-sidebar-mount.js'

let projectsObserver: MutationObserver | null = null
let sidebarWaitObserver: MutationObserver | null = null
let rafExpand = 0

function findNativeProjectsRoot(sidebar: Element): Element | null {
  // Issue layout: React-based section with data-testid
  const byTest = sidebar.querySelector('[data-testid="sidebar-projects-section"]')
  if (byTest) return byTest
  // PR layout: classic form-based sidebar item
  const prForm = sidebar.querySelector('form[aria-label="Select projects"]')
  return prForm?.closest('.discussion-sidebar-item') ?? null
}

/**
 * Expand collapsible-sidebar-widget elements by injecting an extension-hosted
 * script into the page's main world. Content scripts run in an isolated world
 * and cannot access custom element prototype methods (setOpen/isOpen) registered
 * by the page's Catalyst bundle. Inline script injection is blocked by GitHub's
 * CSP. Injecting a <script src="chrome-extension://..."> works because Chrome
 * grants extension resource URLs regardless of the page CSP.
 */
function expandWidgetsViaMainWorld(): void {
  const script = document.createElement('script')
  script.src = chrome.runtime.getURL('pr-expand-main-world.js')
  ;(document.head ?? document.documentElement).appendChild(script)
  script.remove()
}

function expandAll(root: Element): void {
  // Issue layout: React toggle buttons (aria-expanded="false" → click)
  root.querySelectorAll<HTMLButtonElement>('button[aria-expanded="false"]').forEach((btn) => {
    btn.click()
  })
  // PR layout: collapsible-sidebar-widget — must run in page's main world
  if (root.querySelector('collapsible-sidebar-widget')) {
    expandWidgetsViaMainWorld()
  }
}

function scheduleExpand(root: Element): void {
  if (rafExpand) cancelAnimationFrame(rafExpand)
  rafExpand = requestAnimationFrame(() => {
    rafExpand = 0
    expandAll(root)
  })
}

function disconnectObservers(): void {
  projectsObserver?.disconnect()
  projectsObserver = null
  sidebarWaitObserver?.disconnect()
  sidebarWaitObserver = null
  if (rafExpand) {
    cancelAnimationFrame(rafExpand)
    rafExpand = 0
  }
}

function attachProjectsRoot(root: Element): void {
  scheduleExpand(root)
  projectsObserver = new MutationObserver(() => scheduleExpand(root))
  projectsObserver.observe(root, { childList: true, subtree: true })
}

/**
 * Enables or disables auto-expansion of native GitHub project panels in the sidebar.
 * When enabled, always expands — no per-item session state.
 * When disabled, disconnects observers without collapsing anything.
 */
export function syncNativeProjectsExpand(enabled: boolean): void {
  disconnectObservers()
  if (!enabled) return

  const sidebar = findLayoutSidebar()
  if (!sidebar) return

  const existing = findNativeProjectsRoot(sidebar)
  if (existing) {
    attachProjectsRoot(existing)
    return
  }

  sidebarWaitObserver = new MutationObserver(() => {
    const root = findNativeProjectsRoot(sidebar)
    if (!root) return
    sidebarWaitObserver?.disconnect()
    sidebarWaitObserver = null
    attachProjectsRoot(root)
  })
  sidebarWaitObserver.observe(sidebar, { childList: true, subtree: true })
}
