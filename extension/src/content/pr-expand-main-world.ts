/**
 * Runs in the PAGE's main world (injected via <script src> from native-projects-expand.ts).
 * Content scripts cannot access collapsible-sidebar-widget prototype methods due to
 * isolated world restrictions. This file runs in page context where Catalyst methods
 * (setOpen, isOpen) are accessible on custom elements.
 *
 * Retries up to 20 times (100ms apart) to handle lazy Catalyst bundle loading.
 */
;(function () {
  console.log('[FilOzone] pr-expand-main-world running')
  let attempts = 0
  function tryExpand(): void {
    const widgets = document.querySelectorAll('collapsible-sidebar-widget') as NodeListOf<
      HTMLElement & { isOpen: boolean; setOpen: () => void }
    >
    let anyPending = false
    widgets.forEach((w) => {
      if (typeof w.setOpen === 'function') {
        if (!w.isOpen) w.setOpen()
      } else {
        anyPending = true
      }
    })
    if (anyPending && ++attempts < 20) setTimeout(tryExpand, 100)
  }
  tryExpand()
})()
