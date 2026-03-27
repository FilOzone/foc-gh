/**
 * Runs in the PAGE's main world (injected via <script src> from native-projects-expand.ts).
 *
 * WHY A SEPARATE FILE: two constraints force this approach —
 *   1. Isolated world: content scripts share the DOM but not the JS heap. GitHub's
 *      Catalyst custom element prototype methods (setOpen, isOpen) are registered in
 *      the page's main world, so they are invisible to content scripts. This file must
 *      run in the page context where those methods exist.
 *   2. GitHub CSP: inline <script> injection (script.textContent = ...) is blocked by
 *      GitHub's Content-Security-Policy response header. Injecting a
 *      <script src="chrome-extension://..."> bypasses CSP because Chrome exempts
 *      extension web_accessible_resources from page CSP enforcement.
 *
 * Retries up to 20 times (100ms apart) to handle lazy Catalyst bundle loading.
 */
;(function () {
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
