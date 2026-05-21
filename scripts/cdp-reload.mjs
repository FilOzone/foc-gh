#!/usr/bin/env node
/**
 * Reload the unpacked extension via Chrome DevTools Protocol.
 *
 * Requires Chrome launched with --remote-debugging-port=9222.
 * Zero dependencies — uses Node built-in fetch + WebSocket.
 *
 * Usage:
 *   node scripts/cdp-reload.mjs
 *   node scripts/cdp-reload.mjs --port=9333   # custom port
 */

const CDP_PORT = (() => {
  const flag = process.argv.find((a) => a.startsWith('--port='))
  return flag ? Number(flag.split('=')[1]) : 9222
})()

const CDP_BASE = `http://127.0.0.1:${CDP_PORT}`

// Extension ID from the stable manifest key (matches npm run build output).
const EXTENSION_ID = 'akbchnphednohmffplmejpefockadcbg'

async function listTargets() {
  const res = await fetch(`${CDP_BASE}/json`)
  if (!res.ok) throw new Error(`CDP /json returned ${res.status}`)
  return res.json()
}

/** Send a CDP command over a short-lived WebSocket and return the result. */
function cdpSend(wsUrl, method, params = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    const id = 1
    const timeout = setTimeout(() => {
      ws.close()
      reject(new Error(`CDP command ${method} timed out`))
    }, 10_000)

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ id, method, params }))
    })
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id === id) {
        clearTimeout(timeout)
        ws.close()
        if (msg.error) reject(new Error(msg.error.message))
        else resolve(msg.result)
      }
    })
    ws.addEventListener('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

async function reloadExtension() {
  let targets
  try {
    targets = await listTargets()
  } catch (err) {
    console.error(
      `ERROR: Cannot connect to Chrome CDP on port ${CDP_PORT}.\n` +
        `Launch Chrome with: --remote-debugging-port=${CDP_PORT}\n` +
        `  ${err.message}`,
    )
    process.exit(1)
  }

  /** Refresh any open GitHub tabs so content scripts reconnect after extension reload. */
  async function refreshGithubTabs(allTargets) {
    const ghTabs = allTargets.filter(
      (t) => t.type === 'page' && t.url?.includes('github.com') && t.webSocketDebuggerUrl,
    )
    for (const tab of ghTabs) {
      try {
        await cdpSend(tab.webSocketDebuggerUrl, 'Page.reload')
      } catch { /* tab may have closed */ }
    }
    if (ghTabs.length > 0) {
      console.log(`refreshed ${ghTabs.length} GitHub tab(s)`)
    }
  }

  // Find the extension's service worker target — most reliable way to call chrome.runtime.reload()
  const swTarget = targets.find(
    (t) =>
      t.type === 'service_worker' &&
      t.url?.includes(`chrome-extension://${EXTENSION_ID}/`),
  )

  if (swTarget?.webSocketDebuggerUrl) {
    await cdpSend(swTarget.webSocketDebuggerUrl, 'Runtime.evaluate', {
      expression: 'chrome.runtime.reload()',
    })
    console.log('reloaded (via service worker)')
    await refreshGithubTabs(targets)
    return
  }

  // Fallback: find the chrome://extensions page and click the reload button
  const extPage = targets.find(
    (t) => t.url?.startsWith('chrome://extensions') && t.webSocketDebuggerUrl,
  )

  if (!extPage) {
    console.error(
      'ERROR: No service worker target and no chrome://extensions tab found.\n' +
        'Open chrome://extensions in your browser, or ensure the extension is loaded.',
    )
    process.exit(1)
  }

  const result = await cdpSend(extPage.webSocketDebuggerUrl, 'Runtime.evaluate', {
    expression: `(function() {
      function findBtn(root) {
        var btn = root.getElementById ? root.getElementById('dev-reload-button') : null;
        if (btn) return btn;
        var all = root.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
          if (all[i].id === 'dev-reload-button') return all[i];
          if (all[i].shadowRoot) {
            var r = findBtn(all[i].shadowRoot);
            if (r) return r;
          }
        }
        return null;
      }
      var btn = findBtn(document);
      if (btn) { btn.click(); return 'reloaded'; }
      return 'not found';
    })()`,
  })

  const val = result?.result?.value
  if (val === 'reloaded') {
    console.log('reloaded (via extensions page)')
    await refreshGithubTabs(targets)
  } else {
    console.error(`ERROR: Could not find reload button (got: ${val})`)
    process.exit(1)
  }
}

reloadExtension()
