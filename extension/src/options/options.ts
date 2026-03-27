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
const statusFieldEl = document.querySelector<HTMLInputElement>('#statusField')
const saveBtn = document.querySelector<HTMLButtonElement>('#save')
const statusEl = document.querySelector<HTMLParagraphElement>('#status')
const diagRunBtn = document.querySelector<HTMLButtonElement>('#diag-run')
const diagOutEl = document.querySelector<HTMLPreElement>('#diag-out')

function linesToList(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}

function listToLines(list: string[]): string {
  return list.join('\n')
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
  if (statusFieldEl) {
    statusFieldEl.value = String(
      raw[STORAGE_KEYS.statusFieldName] ?? DEFAULT_STATUS_FIELD_NAME,
    )
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

function sendDiagnostics(): Promise<{ ok?: boolean; report?: string; error?: string }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'DEBUG_DIAGNOSTICS' }, (response) => {
      const err = chrome.runtime.lastError
      if (err) {
        resolve({ ok: false, report: `Extension error: ${err.message}` })
        return
      }
      resolve(response as { ok?: boolean; report?: string; error?: string })
    })
  })
}

void load()
saveBtn?.addEventListener('click', () => void save())

diagRunBtn?.addEventListener('click', () => {
  void (async () => {
    if (diagOutEl) diagOutEl.textContent = 'Running…'
    diagRunBtn.disabled = true
    try {
      const res = await sendDiagnostics()
      const text =
        typeof res.report === 'string'
          ? res.report
          : res.error
            ? `Error: ${res.error}`
            : JSON.stringify(res, null, 2)
      if (diagOutEl) diagOutEl.textContent = text
    } finally {
      diagRunBtn.disabled = false
    }
  })()
})
