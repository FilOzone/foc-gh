#!/usr/bin/env node
/**
 * Stream the extension's service worker console output via CDP.
 *
 * Requires Chrome launched with --remote-debugging-port=9222.
 * Zero dependencies — uses Node built-in fetch + WebSocket.
 *
 * Usage:
 *   node scripts/sw-logs.mjs              # stream until Ctrl-C
 *   node scripts/sw-logs.mjs --port=9333  # custom port
 *
 * Reconnects automatically when the service worker restarts (e.g. after
 * extension reload).
 */

const CDP_PORT = (() => {
  const flag = process.argv.find((a) => a.startsWith('--port='))
  return flag ? Number(flag.split('=')[1]) : 9222
})()

const CDP_BASE = `http://127.0.0.1:${CDP_PORT}`
const EXTENSION_ID = 'akbchnphednohmffplmejpefockadcbg'
const POLL_INTERVAL_MS = 2000

function ts() {
  return new Date().toLocaleTimeString()
}

function formatValue(obj) {
  if (!obj) return ''
  if (obj.type === 'string') return obj.value
  if (obj.type === 'number' || obj.type === 'boolean') return String(obj.value)
  if (obj.type === 'undefined') return 'undefined'
  if (obj.type === 'object') {
    if (obj.subtype === 'null') return 'null'
    if (obj.preview?.properties) {
      const props = obj.preview.properties.map((p) => `${p.name}: ${p.value}`).join(', ')
      return obj.preview.overflow ? `{ ${props}, … }` : `{ ${props} }`
    }
    if (obj.description) return obj.description
    return JSON.stringify(obj.value ?? obj.description ?? '(object)')
  }
  return obj.description ?? String(obj.value ?? '')
}

/** Try /json endpoint first (works when SW is in the target list). */
async function findSwViaJson() {
  const res = await fetch(`${CDP_BASE}/json`)
  if (!res.ok) return null
  const targets = await res.json()
  return targets.find(
    (t) =>
      t.type === 'service_worker' &&
      t.url?.includes(`chrome-extension://${EXTENSION_ID}/`),
  )
}

/** Get the browser-level WebSocket URL. */
async function getBrowserWsUrl() {
  const res = await fetch(`${CDP_BASE}/json/version`)
  if (!res.ok) throw new Error(`/json/version returned ${res.status}`)
  const data = await res.json()
  return data.webSocketDebuggerUrl
}

/** Use the browser WebSocket to discover and auto-attach to extension SW. */
function streamViaBrowserAttach(browserWsUrl) {
  return new Promise((resolve) => {
    const ws = new WebSocket(browserWsUrl)
    let idSeq = 0
    let attached = false
    let sessionId = null

    ws.addEventListener('open', () => {
      // Auto-attach to service workers — catches them when they activate
      ws.send(JSON.stringify({
        id: ++idSeq,
        method: 'Target.setAutoAttach',
        params: {
          autoAttach: true,
          waitForDebuggerOnStart: false,
          flatten: true,
          filter: [{ type: 'service_worker' }],
        },
      }))
      // Also discover existing targets
      ws.send(JSON.stringify({
        id: ++idSeq,
        method: 'Target.setDiscoverTargets',
        params: {
          discover: true,
          filter: [{ type: 'service_worker' }],
        },
      }))
    })

    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)

      // Auto-attached to a target — check if it's our SW
      if (msg.method === 'Target.attachedToTarget') {
        const info = msg.params?.targetInfo
        if (
          info?.type === 'service_worker' &&
          info?.url?.includes(`chrome-extension://${EXTENSION_ID}/`)
        ) {
          sessionId = msg.params.sessionId
          attached = true
          console.log(`[${ts()}] connected to service worker`)
          ws.send(JSON.stringify({ id: ++idSeq, sessionId, method: 'Runtime.enable' }))
          ws.send(JSON.stringify({ id: ++idSeq, sessionId, method: 'Log.enable' }))
        }
        return
      }

      // Console output from the SW session
      if (msg.sessionId === sessionId) {
        if (msg.method === 'Runtime.consoleAPICalled') {
          const { type, args } = msg.params
          const text = (args || []).map(formatValue).join(' ')
          const label = type === 'log' ? 'LOG' : type.toUpperCase()
          console.log(`[${ts()}] [${label}] ${text}`)
          return
        }
        if (msg.method === 'Runtime.exceptionThrown') {
          const detail = msg.params?.exceptionDetails
          const text =
            detail?.exception?.description ??
            detail?.text ??
            JSON.stringify(detail)
          console.log(`[${ts()}] [EXCEPTION] ${text}`)
          return
        }
        if (msg.method === 'Log.entryAdded') {
          const entry = msg.params?.entry
          if (entry) {
            const level = (entry.level || 'info').toUpperCase()
            console.log(`[${ts()}] [${level}] ${entry.text}`)
          }
          return
        }
      }

      // Target detached — our SW stopped
      if (msg.method === 'Target.detachedFromTarget') {
        if (attached && msg.params?.sessionId === sessionId) {
          console.log(`[${ts()}] service worker stopped (will reconnect on next activation)`)
          attached = false
          sessionId = null
        }
        return
      }
    })

    ws.addEventListener('close', () => resolve('closed'))
    ws.addEventListener('error', () => resolve('error'))
  })
}

async function main() {
  console.log(`Streaming service worker logs (CDP port ${CDP_PORT})`)
  console.log(`Extension: ${EXTENSION_ID}`)
  console.log('Press Ctrl-C to stop.\n')

  let browserWsUrl
  try {
    browserWsUrl = await getBrowserWsUrl()
  } catch (err) {
    console.error(
      `Cannot connect to Chrome CDP on port ${CDP_PORT}: ${err.message}\n` +
        `Launch Chrome with: --remote-debugging-port=${CDP_PORT}`,
    )
    process.exit(1)
  }

  console.log(`[${ts()}] waiting for service worker (navigate to a GitHub issue/PR to activate)...`)
  const reason = await streamViaBrowserAttach(browserWsUrl)
  console.log(`[${ts()}] disconnected (${reason})`)
}

main()
