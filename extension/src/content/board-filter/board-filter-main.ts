/**
 * Board Filter content script entry point.
 *
 * Architecture: content script (this file) → main-world script (board-data-injector.ts)
 *   → fetch interception → merge
 *
 * This content script injects the main-world fetch interceptor script into the page.
 * The interceptor is self-contained: it reads the filter bar value on every
 * paginated_items fetch and decides whether to intercept based on OR syntax detection.
 *
 * The content script also handles SPA navigation by re-injecting if needed.
 */

const LOG_PREFIX = '[FilOz:board-filter]'

/** Inject the main-world fetch interceptor. */
function injectMainWorldScript(): void {
  const id = 'filoz-board-data-injector'
  if (document.getElementById(id)) return

  const script = document.createElement('script')
  script.id = id
  script.src = chrome.runtime.getURL('board-data-injector.js')
  ;(document.head ?? document.documentElement).appendChild(script)
  console.log(LOG_PREFIX, 'Main-world interceptor injected')
}

// Entry point
console.log(LOG_PREFIX, 'Content script loaded')
injectMainWorldScript()
