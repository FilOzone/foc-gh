import type { SerializableProjectField } from '../lib/project-board-fields.js'
import {
  DEFAULT_BOARD_URLS,
  DEFAULT_STATUS_FIELD_NAME,
  DEFAULT_TARGET_REPOS,
  STORAGE_KEYS,
} from '../lib/project-config.js'

const tokenEl = document.querySelector<HTMLInputElement>('#token')
const tokenKindEl = document.querySelector<HTMLSelectElement>('#tokenKind')
const boardsEl = document.querySelector<HTMLTextAreaElement>('#boards')
const reposEl = document.querySelector<HTMLTextAreaElement>('#repos')
const statusFieldEl = document.querySelector<HTMLSelectElement>('#statusField')
const statusRefreshBtn = document.querySelector<HTMLButtonElement>('#status-refresh')
const saveBtn = document.querySelector<HTMLButtonElement>('#save')
const statusEl = document.querySelector<HTMLParagraphElement>('#status')
const diagRunBtn = document.querySelector<HTMLButtonElement>('#diag-run')
const diagOutEl = document.querySelector<HTMLPreElement>('#diag-out')
const sampleUrlEl = document.querySelector<HTMLInputElement>('#sample-url')
const sampleRunBtn = document.querySelector<HTMLButtonElement>('#sample-run')
const sampleOutEl = document.querySelector<HTMLPreElement>('#sample-out')

function linesToList(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}

function listToLines(list: string[]): string {
  return list.join('\n')
}

type PrimaryBoardFieldsResponse =
  | {
      ok: true
      projectTitle?: string
      fields: SerializableProjectField[]
      totalCount?: number
    }
  | { ok: false; error?: string }

function populateStatusSelect(singleSelectNames: string[], saved: string): void {
  if (!statusFieldEl) return
  const want = saved.trim() || DEFAULT_STATUS_FIELD_NAME
  statusFieldEl.innerHTML = ''

  const oPlaceholder = document.createElement('option')
  oPlaceholder.value = ''
  oPlaceholder.textContent = singleSelectNames.length ? '— Select column —' : '— Click “Load columns” —'
  statusFieldEl.append(oPlaceholder)

  const seen = new Set<string>()
  for (const n of singleSelectNames) {
    if (seen.has(n)) continue
    seen.add(n)
    const o = document.createElement('option')
    o.value = n
    o.textContent = n
    statusFieldEl.append(o)
  }

  if (want && !seen.has(want)) {
    const o = document.createElement('option')
    o.value = want
    o.textContent = `${want} (custom / saved)`
    statusFieldEl.append(o)
  }

  if (want) {
    const has = Array.from(statusFieldEl.options).some((o) => o.value === want)
    statusFieldEl.value = has ? want : ''
  }
}

async function refreshBoardColumns(): Promise<void> {
  if (!statusFieldEl || !statusRefreshBtn) return
  const prev = statusFieldEl.value || DEFAULT_STATUS_FIELD_NAME
  statusRefreshBtn.disabled = true
  try {
    const res = await new Promise<PrimaryBoardFieldsResponse>((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_PRIMARY_BOARD_FIELD_DEFINITIONS' }, (r) => {
        const err = chrome.runtime.lastError
        if (err) {
          resolve({ ok: false, error: err.message })
          return
        }
        resolve(r as PrimaryBoardFieldsResponse)
      })
    })
    if (!res.ok) {
      populateStatusSelect([], prev)
      if (statusEl) statusEl.textContent = res.error ?? 'Could not load board columns.'
      return
    }
    const names = res.fields
      .filter((f): f is SerializableProjectField & { kind: 'single_select' } => f.kind === 'single_select')
      .map((f) => f.name)
    populateStatusSelect(names, prev)
    const extra =
      typeof res.totalCount === 'number' && res.totalCount > names.length ?
        ` (${res.totalCount} columns on board; showing ${names.length} single-select).`
      : ''
    if (statusEl) {
      statusEl.textContent = `Loaded ${names.length} single-select column(s) from ${res.projectTitle ?? 'project'}.${extra}`
    }
  } finally {
    statusRefreshBtn.disabled = false
  }
}

async function load(): Promise<void> {
  const raw = await chrome.storage.local.get([
    STORAGE_KEYS.githubApiToken,
    STORAGE_KEYS.githubTokenKind,
    STORAGE_KEYS.crossOrgBoardUrls,
    STORAGE_KEYS.crossOrgTargetRepos,
    STORAGE_KEYS.statusFieldName,
  ])

  if (tokenEl) tokenEl.value = String(raw[STORAGE_KEYS.githubApiToken] ?? '')
  if (tokenKindEl) {
    tokenKindEl.value =
      raw[STORAGE_KEYS.githubTokenKind] === 'oauth' ? 'oauth' : 'pat'
  }
  const urls = raw[STORAGE_KEYS.crossOrgBoardUrls] as string[] | undefined
  const repos = raw[STORAGE_KEYS.crossOrgTargetRepos] as string[] | undefined
  if (boardsEl) {
    boardsEl.value = listToLines(
      Array.isArray(urls) && urls.length > 0 ? urls : [...DEFAULT_BOARD_URLS],
    )
  }
  if (reposEl) {
    reposEl.value = listToLines(
      Array.isArray(repos) && repos.length > 0 ? repos : [...DEFAULT_TARGET_REPOS],
    )
  }
  const savedStatus = String(raw[STORAGE_KEYS.statusFieldName] ?? DEFAULT_STATUS_FIELD_NAME)
  populateStatusSelect([], savedStatus)
  if (tokenEl?.value?.trim()) {
    await refreshBoardColumns()
  }
}

async function save(): Promise<void> {
  const urls = boardsEl ? linesToList(boardsEl.value) : [...DEFAULT_BOARD_URLS]
  const repos = reposEl ? linesToList(reposEl.value) : [...DEFAULT_TARGET_REPOS]
  await chrome.storage.local.set({
    [STORAGE_KEYS.githubApiToken]: tokenEl?.value ?? '',
    [STORAGE_KEYS.githubTokenKind]: tokenKindEl?.value === 'oauth' ? 'oauth' : 'pat',
    [STORAGE_KEYS.crossOrgBoardUrls]: urls.length ? urls : [...DEFAULT_BOARD_URLS],
    [STORAGE_KEYS.crossOrgTargetRepos]: repos.length ? repos : [...DEFAULT_TARGET_REPOS],
    [STORAGE_KEYS.statusFieldName]: statusFieldEl?.value?.trim()
      ? statusFieldEl.value.trim()
      : DEFAULT_STATUS_FIELD_NAME,
  })
  if (statusEl) statusEl.textContent = 'Saved.'
}

type DiagStreamMessage =
  | { type: 'diagLine'; line: string }
  | { type: 'complete'; ok?: boolean; report: string }
  | { type: 'error'; message?: string }

function renderStreamingDiag(
  pre: HTMLPreElement,
  reportIntro: string,
  logLines: string[],
): void {
  const logBlock =
    logLines.length > 0 ? `\n\n--- Request log ---\n${logLines.join('\n')}` : '\n\n--- Request log ---\n'
  pre.textContent = `${reportIntro}${logBlock}`
  pre.scrollTop = pre.scrollHeight
}

void load()
saveBtn?.addEventListener('click', () => void save())
statusRefreshBtn?.addEventListener('click', () => void refreshBoardColumns())

diagRunBtn?.addEventListener('click', () => {
  if (!diagOutEl || !diagRunBtn) return
  diagRunBtn.disabled = true
  const logLines: string[] = []
  let reportSoFar = 'Running…'
  renderStreamingDiag(diagOutEl, reportSoFar, logLines)

  const port = chrome.runtime.connect({ name: 'diagnostics' })
  port.postMessage({ type: 'DEBUG_DIAGNOSTICS_STREAM' })

  const finish = (): void => {
    diagRunBtn.disabled = false
  }

  port.onMessage.addListener((msg: unknown) => {
    const m = msg as DiagStreamMessage
    if (m.type === 'diagLine' && m.line) {
      logLines.push(m.line)
      renderStreamingDiag(diagOutEl, reportSoFar, logLines)
      return
    }
    if (m.type === 'complete' && typeof m.report === 'string') {
      reportSoFar = m.report
      renderStreamingDiag(diagOutEl, reportSoFar, logLines)
      finish()
      return
    }
    if (m.type === 'error') {
      diagOutEl.textContent = `${diagOutEl.textContent}\n\nError: ${m.message ?? 'unknown'}`
      diagOutEl.scrollTop = diagOutEl.scrollHeight
      finish()
    }
  })

  port.onDisconnect.addListener(finish)
})

sampleRunBtn?.addEventListener('click', () => {
  if (!sampleOutEl || !sampleRunBtn) return
  const url = sampleUrlEl?.value?.trim() ?? ''
  sampleOutEl.textContent = url ? 'Running…' : 'Enter an issue or PR URL first.'
  if (!url) return

  sampleRunBtn.disabled = true
  const logLines: string[] = []
  let reportSoFar = 'Running…'
  renderStreamingDiag(sampleOutEl, reportSoFar, logLines)

  const port = chrome.runtime.connect({ name: 'diagnostics' })
  port.postMessage({ type: 'DEBUG_SAMPLE_BOARD_LINK_STREAM', url })

  const finish = (): void => {
    sampleRunBtn.disabled = false
  }

  port.onMessage.addListener((msg: unknown) => {
    const m = msg as DiagStreamMessage
    if (m.type === 'diagLine' && m.line) {
      logLines.push(m.line)
      renderStreamingDiag(sampleOutEl, reportSoFar, logLines)
      return
    }
    if (m.type === 'complete' && typeof m.report === 'string') {
      reportSoFar = m.report
      renderStreamingDiag(sampleOutEl, reportSoFar, logLines)
      finish()
      return
    }
    if (m.type === 'error') {
      sampleOutEl.textContent = `${sampleOutEl.textContent}\n\nError: ${m.message ?? 'unknown'}`
      sampleOutEl.scrollTop = sampleOutEl.scrollHeight
      finish()
    }
  })

  port.onDisconnect.addListener(finish)
})
