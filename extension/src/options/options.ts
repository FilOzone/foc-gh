import {
  DEFAULT_BOARD_URLS,
  DEFAULT_TARGET_REPOS,
  STORAGE_KEYS,
} from '../lib/project-config.js'

const authModeGithubEl = document.querySelector<HTMLInputElement>('#auth-mode-github')
const authModePatEl = document.querySelector<HTMLInputElement>('#auth-mode-pat')
const oauthPanelEl = document.querySelector<HTMLDivElement>('#oauth-panel')
const patPanelEl = document.querySelector<HTMLDivElement>('#pat-panel')
const oauthStatusEl = document.querySelector<HTMLParagraphElement>('#oauth-status')
const connectGithubBtn = document.querySelector<HTMLButtonElement>('#connect-github')
const disconnectGithubBtn = document.querySelector<HTMLButtonElement>('#disconnect-github')

const tokenEl = document.querySelector<HTMLInputElement>('#token')
const boardsEl = document.querySelector<HTMLTextAreaElement>('#boards')
const reposEl = document.querySelector<HTMLTextAreaElement>('#repos')
const saveBtn = document.querySelector<HTMLButtonElement>('#save')
const statusEl = document.querySelector<HTMLParagraphElement>('#status')
const diagRunBtn = document.querySelector<HTMLButtonElement>('#diag-run')
const diagOutEl = document.querySelector<HTMLPreElement>('#diag-out')
const sampleUrlEl = document.querySelector<HTMLInputElement>('#sample-url')
const sampleRunBtn = document.querySelector<HTMLButtonElement>('#sample-run')
const sampleOutEl = document.querySelector<HTMLPreElement>('#sample-out')
const issuePrProjectsAutoExpandEl = document.querySelector<HTMLInputElement>('#issuePrProjectsAutoExpand')

function authMode(): 'github' | 'pat' {
  return authModePatEl?.checked === true ? 'pat' : 'github'
}

function syncAuthPanels(): void {
  const mode = authMode()
  oauthPanelEl?.classList.toggle('hidden', mode !== 'github')
  patPanelEl?.classList.toggle('hidden', mode !== 'pat')
}

function linesToList(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}

function listToLines(list: string[]): string {
  return list.join('\n')
}

type GetAuthStatusResponse = {
  ok: true
  authMethod: 'pat' | 'oauth' | 'none'
  hasToken: boolean
}

async function fetchAuthStatus(): Promise<GetAuthStatusResponse | { ok: false; error?: string }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' }, (r) => {
      const err = chrome.runtime.lastError
      if (err) {
        resolve({ ok: false, error: err.message })
        return
      }
      resolve(r as GetAuthStatusResponse)
    })
  })
}

async function refreshAuthUi(): Promise<void> {
  const res = await fetchAuthStatus()
  if (!res.ok) {
    if (oauthStatusEl) oauthStatusEl.textContent = res.error ?? 'Could not read auth status.'
    return
  }

  const method = res.authMethod
  const has = res.hasToken

  if (oauthStatusEl) {
    if (method === 'oauth' && has) {
      oauthStatusEl.textContent = 'Connected via GitHub (OAuth).'
    } else if (method === 'pat' && has) {
      oauthStatusEl.textContent =
        'A personal access token is saved. Select “Personal access token” above to view or change it.'
    } else {
      oauthStatusEl.textContent = 'Not connected — use Connect GitHub or save a PAT.'
    }
  }

  disconnectGithubBtn?.classList.toggle('hidden', !(method === 'oauth' && has))
}

async function load(): Promise<void> {
  const raw = await chrome.storage.local.get([
    STORAGE_KEYS.githubApiToken,
    STORAGE_KEYS.githubTokenKind,
    STORAGE_KEYS.authMethod,
    STORAGE_KEYS.crossOrgBoardUrls,
    STORAGE_KEYS.crossOrgTargetRepos,
    STORAGE_KEYS.issuePrProjectsAutoExpand,
  ])

  const storedMethod = raw[STORAGE_KEYS.authMethod] as string | undefined
  const legacyKind = raw[STORAGE_KEYS.githubTokenKind] === 'oauth' ? 'oauth' : 'pat'
  const tokenStr = String(raw[STORAGE_KEYS.githubApiToken] ?? '').trim()

  if (storedMethod === 'pat') {
    if (authModePatEl) authModePatEl.checked = true
  } else if (storedMethod === 'oauth') {
    if (authModeGithubEl) authModeGithubEl.checked = true
  } else if (tokenStr.length > 0) {
    if (legacyKind === 'oauth') {
      if (authModeGithubEl) authModeGithubEl.checked = true
    } else {
      if (authModePatEl) authModePatEl.checked = true
    }
  } else {
    if (authModeGithubEl) authModeGithubEl.checked = true
  }

  syncAuthPanels()

  if (tokenEl) {
    if (authMode() === 'pat') {
      tokenEl.placeholder = ''
      tokenEl.value = String(raw[STORAGE_KEYS.githubApiToken] ?? '')
    } else {
      tokenEl.value = ''
      tokenEl.placeholder = 'Token is managed via Connect GitHub when signed in.'
    }
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
  if (issuePrProjectsAutoExpandEl) {
    issuePrProjectsAutoExpandEl.checked = raw[STORAGE_KEYS.issuePrProjectsAutoExpand] !== false
  }

  await refreshAuthUi()
}

async function save(): Promise<void> {
  const urls = boardsEl ? linesToList(boardsEl.value) : [...DEFAULT_BOARD_URLS]
  const repos = reposEl ? linesToList(reposEl.value) : [...DEFAULT_TARGET_REPOS]

  const common: Record<string, unknown> = {
    [STORAGE_KEYS.crossOrgBoardUrls]: urls.length ? urls : [...DEFAULT_BOARD_URLS],
    [STORAGE_KEYS.crossOrgTargetRepos]: repos.length ? repos : [...DEFAULT_TARGET_REPOS],
    [STORAGE_KEYS.issuePrProjectsAutoExpand]: issuePrProjectsAutoExpandEl?.checked !== false,
  }

  if (authMode() === 'pat') {
    const tok = tokenEl?.value?.trim() ?? ''
    common[STORAGE_KEYS.githubApiToken] = tok
    common[STORAGE_KEYS.githubTokenKind] = 'pat'
    common[STORAGE_KEYS.authMethod] = tok ? 'pat' : 'none'
    await chrome.storage.local.set(common)
    if (tok) {
      await chrome.storage.local.remove(STORAGE_KEYS.oauthTokenExpiresAt)
    }
  } else {
    await chrome.storage.local.set(common)
  }

  if (statusEl) statusEl.textContent = 'Saved.'
  await refreshAuthUi()
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

authModeGithubEl?.addEventListener('change', () => {
  syncAuthPanels()
  if (tokenEl) {
    tokenEl.value = ''
    tokenEl.placeholder = 'Token is managed via Connect GitHub when signed in.'
  }
  void refreshAuthUi()
})

authModePatEl?.addEventListener('change', () => {
  void (async () => {
    syncAuthPanels()
    const raw = await chrome.storage.local.get([STORAGE_KEYS.githubApiToken, STORAGE_KEYS.authMethod])
    if (tokenEl) {
      tokenEl.placeholder = ''
      if (raw[STORAGE_KEYS.authMethod] === 'pat') {
        tokenEl.value = String(raw[STORAGE_KEYS.githubApiToken] ?? '')
      } else {
        tokenEl.value = ''
      }
    }
    await refreshAuthUi()
  })()
})

connectGithubBtn?.addEventListener('click', () => {
  void (async () => {
    if (!connectGithubBtn) return
    connectGithubBtn.disabled = true
    try {
      const res = await new Promise<{ ok?: boolean; error?: string }>((resolve) => {
        chrome.runtime.sendMessage({ type: 'GITHUB_OAUTH_START' }, (r) => {
          const err = chrome.runtime.lastError
          if (err) {
            resolve({ ok: false, error: err.message })
            return
          }
          resolve(r as { ok?: boolean; error?: string })
        })
      })
      if (!res.ok) {
        if (statusEl) statusEl.textContent = res.error ?? 'GitHub sign-in failed or was cancelled.'
        return
      }
      if (statusEl) statusEl.textContent = 'Connected to GitHub.'
      if (authModeGithubEl) authModeGithubEl.checked = true
      syncAuthPanels()
      await refreshAuthUi()
    } finally {
      connectGithubBtn.disabled = false
    }
  })()
})

disconnectGithubBtn?.addEventListener('click', () => {
  void (async () => {
    await new Promise<void>((resolve) => {
      chrome.runtime.sendMessage({ type: 'GITHUB_OAUTH_DISCONNECT' }, () => {
        resolve()
      })
    })
    if (statusEl) statusEl.textContent = 'Disconnected from GitHub (OAuth).'
    await refreshAuthUi()
  })()
})

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
