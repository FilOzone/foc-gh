/**
 * Board Filter content script entry point.
 *
 * Architecture: content script (this file) → main-world script (board-data-injector.ts)
 *   → fetch interception → merge
 *
 * This content script checks whether the current project board URL matches
 * the configured OR filter patterns. If it does, it injects the main-world
 * fetch interceptor. If not, it does nothing (no interception, no overhead).
 */

import { loadConfig, isOrFilterBoard } from '../../lib/project-config.js'

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

async function init(): Promise<void> {
  console.log(LOG_PREFIX, 'Content script loaded')

  const cfg = await loadConfig()
  // Strip /views/N from the URL for pattern matching — patterns target the project, not the view
  const baseUrl = window.location.href.replace(/\/views\/\d+.*$/, '')

  if (!isOrFilterBoard(cfg, baseUrl)) {
    console.log(LOG_PREFIX, 'OR filter not enabled for this board, skipping')
    return
  }

  console.log(LOG_PREFIX, 'OR filter enabled for this board')
  injectMainWorldScript()
}

void init()
