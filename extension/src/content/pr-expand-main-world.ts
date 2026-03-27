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
 * WHY mousedown NOT .click(): Catalyst binds data-action="mousedown:collapsible-sidebar-widget#onMouseDown".
 * element.click() only dispatches a "click" event — it does NOT fire "mousedown".
 * So .click() never invokes the Catalyst handler. Dispatching a real MouseEvent for
 * "mousedown" with bubbles:true triggers the Catalyst flow, which fetches content from
 * the widget's `url` attribute and opens the widget with the full field list.
 *
 * WHY data-filoz-expanded: this script is injected on every MutationObserver tick.
 * isOpen is not set synchronously — Catalyst updates it after the async content fetch.
 * A second injection firing while the fetch is in-flight would see isOpen=false and
 * dispatch mousedown again, toggling the widget closed. The data attribute persists
 * across injections and prevents double-firing.
 *
 * Retries up to 20 times (100ms apart) to handle lazy Catalyst bundle loading.
 */
;(function () {
  const HANDLED = 'data-filoz-expanded'
  let attempts = 0
  function tryExpand(): void {
    const widgets = document.querySelectorAll('collapsible-sidebar-widget') as NodeListOf<
      HTMLElement & { isOpen: boolean; setOpen: () => void }
    >
    let anyPending = false
    widgets.forEach((w) => {
      if (w.hasAttribute(HANDLED)) return
      if (typeof w.setOpen === 'function') {
        if (w.isOpen) {
          w.setAttribute(HANDLED, '1')
        } else {
          // Find the caret toggle (not the "See more fields..." button)
          const toggleBtn = Array.from(
            w.querySelectorAll<HTMLButtonElement>('button[data-action*="collapsible-sidebar-widget"]'),
          ).find((b) => !b.getAttribute('aria-label')?.toLowerCase().includes('more'))
          if (toggleBtn) {
            w.setAttribute(HANDLED, '1')
            toggleBtn.dispatchEvent(
              new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }),
            )
          }
        }
      } else {
        anyPending = true
      }
    })
    if (anyPending && ++attempts < 20) setTimeout(tryExpand, 100)
  }
  tryExpand()
})()
