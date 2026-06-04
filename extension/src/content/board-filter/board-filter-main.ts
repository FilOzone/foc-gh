/**
 * Board Filter content script entry point.
 *
 * Architecture: content script (this file) → main-world script (board-data-injector.ts)
 *   → fetch interception → merge
 *
 * Runs at document_start to inject the main-world fetch interceptor BEFORE
 * GitHub's React app initializes. This is critical so the interceptor can
 * patch window.fetch before the React app makes its first API call.
 *
 * The config check (which boards are enabled) runs async but the injection
 * must happen synchronously at startup to avoid missing the initial fetch.
 * If the board doesn't match the config, the injector is a no-op (it only
 * activates when OR syntax is detected in the filter bar).
 */

import { loadConfig, isOrFilterBoard } from '../../lib/project-config.js'

const LOG_PREFIX = '[FilOz:board-filter]'

/** Inject the main-world fetch interceptor immediately. */
function injectMainWorldScript(): void {
  const id = 'filoz-board-data-injector'
  if (document.getElementById(id)) return

  const script = document.createElement('script')
  script.id = id
  script.src = chrome.runtime.getURL('board-data-injector.js')
  ;(document.head ?? document.documentElement).appendChild(script)
  console.log(LOG_PREFIX, 'Main-world interceptor injected')
}

// Check the URL — if it looks like a project board, inject immediately.
// The config check runs async afterward; the injector is harmless on
// non-configured boards (only activates when OR syntax is in the filter bar).
const url = window.location.href
if (/github\.com\/orgs\/[^/]+\/projects\/\d+\/views\/\d+/.test(url)) {
  console.log(LOG_PREFIX, 'Content script loaded (document_start)')
  injectMainWorldScript()

  // Async config check — if the board doesn't match, remove the injector
  void loadConfig().then((cfg) => {
    const baseUrl = url.replace(/\/views\/\d+.*$/, '')
    if (!isOrFilterBoard(cfg, baseUrl)) {
      console.log(LOG_PREFIX, 'OR filter not enabled for this board, disabling')
      // Signal the injector to deactivate
      document.dispatchEvent(new CustomEvent('filoz-or-filter-disabled'))
    } else {
      console.log(LOG_PREFIX, 'OR filter enabled for this board')
    }
  })
}
