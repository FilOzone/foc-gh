/** Mirrors cross-org + auth data model (see specs data-model docs). */

export const STORAGE_KEYS = {
  githubApiToken: 'github_api_token',
  githubTokenKind: 'github_token_kind',
  /** Active credential: pat, oauth, or none. */
  authMethod: 'auth_method',
  /** Epoch ms when OAuth access token expires, if GitHub returned expires_in. */
  oauthTokenExpiresAt: 'oauth_token_expires_at',
  crossOrgBoardUrls: 'cross_org_board_urls',
  crossOrgTargetRepos: 'cross_org_target_repos',
  statusFieldName: 'status_field_name',
  /** When true (default), FOC sidebar card field body loads expanded on issues/PRs. */
  issuePrProjectsAutoExpand: 'issue_pr_projects_auto_expand',
} as const

export const DEFAULT_BOARD_URLS = ['https://github.com/orgs/FilOzone/projects/14'] as const

export const DEFAULT_TARGET_REPOS = [
  'filecoin-project/curio',
  'filecoin-project/filecoin-pin',
  'filecoin-project/FIPs',
  'filecoin-project/filecoin-pin-website',
  'filecoin-project/github-mgmt',
] as const

export const DEFAULT_STATUS_FIELD_NAME = 'Status'

export type AuthMethod = 'pat' | 'oauth' | 'none'

export type StoredConfig = {
  githubApiToken: string
  githubTokenKind: 'oauth' | 'pat' | ''
  authMethod: AuthMethod
  oauthTokenExpiresAt: number | null
  crossOrgBoardUrls: string[]
  crossOrgTargetRepos: string[]
  statusFieldName: string
  issuePrProjectsAutoExpand: boolean
}

export function normalizeRepoKey(owner: string, name: string): string {
  return `${owner.toLowerCase()}/${name.toLowerCase()}`
}

/** Parse org projects URL → org login + project number */
export function parseOrgProjectUrl(url: string): { org: string; number: number } | null {
  const t = url.trim()
  const m = t.match(/github\.com\/orgs\/([^/]+)\/projects\/(\d+)/i)
  if (!m) return null
  return { org: m[1], number: Number(m[2]) }
}

/** Whether to show the **Global boards** picker section (spec 006 / data-model visibility). */
export function showGlobalBoardsSection(repoOwner: string, boardUrls: string[]): boolean {
  const orgs: string[] = []
  for (const raw of boardUrls) {
    const p = parseOrgProjectUrl(raw.trim())
    if (p) orgs.push(p.org.toLowerCase())
  }
  if (orgs.length === 0) return false
  const repo = repoOwner.trim().toLowerCase()
  return orgs.some((o) => o !== repo)
}

function readStoredAuthMethod(raw: Record<string, unknown>): AuthMethod | undefined {
  const explicit = raw[STORAGE_KEYS.authMethod]
  if (explicit === 'pat' || explicit === 'oauth' || explicit === 'none') {
    return explicit
  }
  return undefined
}

/**
 * Returns a non-empty bearer for `api.github.com` when the user has an active
 * credential (PAT or OAuth access token). Respects `auth_method` and migration.
 */
export function resolveGithubBearer(cfg: StoredConfig): string | null {
  const t = cfg.githubApiToken.trim()
  if (!t) return null
  if (cfg.authMethod === 'none') return null
  return t
}

export async function loadConfig(): Promise<StoredConfig> {
  const raw = await chrome.storage.local.get([
    STORAGE_KEYS.githubApiToken,
    STORAGE_KEYS.githubTokenKind,
    STORAGE_KEYS.authMethod,
    STORAGE_KEYS.oauthTokenExpiresAt,
    STORAGE_KEYS.crossOrgBoardUrls,
    STORAGE_KEYS.crossOrgTargetRepos,
    STORAGE_KEYS.statusFieldName,
    STORAGE_KEYS.issuePrProjectsAutoExpand,
  ])

  const urls = raw[STORAGE_KEYS.crossOrgBoardUrls] as string[] | undefined
  const repos = raw[STORAGE_KEYS.crossOrgTargetRepos] as string[] | undefined
  const autoRaw = raw[STORAGE_KEYS.issuePrProjectsAutoExpand]
  const issuePrProjectsAutoExpand = autoRaw === false ? false : true

  const token = String(raw[STORAGE_KEYS.githubApiToken] ?? '')
  const legacyKind = (raw[STORAGE_KEYS.githubTokenKind] as StoredConfig['githubTokenKind']) ?? ''
  const trimmed = token.trim()

  const stored = readStoredAuthMethod(raw as Record<string, unknown>)
  let authMethod: AuthMethod
  if (stored !== undefined) {
    authMethod = stored
  } else if (trimmed.length === 0) {
    authMethod = 'none'
  } else {
    authMethod = legacyKind === 'oauth' ? 'oauth' : 'pat'
  }

  if (authMethod === 'none' && trimmed.length > 0) {
    authMethod = legacyKind === 'oauth' ? 'oauth' : 'pat'
  }

  const expRaw = raw[STORAGE_KEYS.oauthTokenExpiresAt]
  const oauthTokenExpiresAt =
    typeof expRaw === 'number' && Number.isFinite(expRaw) ? expRaw : null

  return {
    githubApiToken: token,
    githubTokenKind: legacyKind,
    authMethod,
    oauthTokenExpiresAt,
    crossOrgBoardUrls:
      Array.isArray(urls) && urls.length > 0 ? urls : [...DEFAULT_BOARD_URLS],
    crossOrgTargetRepos:
      Array.isArray(repos) && repos.length > 0 ? repos : [...DEFAULT_TARGET_REPOS],
    statusFieldName: String(raw[STORAGE_KEYS.statusFieldName] ?? DEFAULT_STATUS_FIELD_NAME),
    issuePrProjectsAutoExpand,
  }
}

export function isTargetRepo(config: StoredConfig, owner: string, name: string): boolean {
  const key = normalizeRepoKey(owner, name)
  return config.crossOrgTargetRepos.some((r) => r.trim().toLowerCase() === key)
}
