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
  /** Whether target-repo membership checks use the built-in defaults or the user's custom list. */
  crossOrgTargetReposMode: 'cross_org_target_repos_mode',
  /** When true (default), FOC sidebar card field body loads expanded on issues/PRs. */
  issuePrProjectsAutoExpand: 'issue_pr_projects_auto_expand',
  /** URL patterns (glob-style) for project boards where OR filter support is enabled. */
  orFilterBoardPatterns: 'or_filter_board_patterns',
} as const

export const DEFAULT_BOARD_URLS = ['https://github.com/orgs/FilOzone/projects/14'] as const

/**
 * Glob-style owner/repo patterns (e.g. `filecoin-project/*`), same syntax as
 * {@link DEFAULT_OR_FILTER_BOARD_PATTERNS}. FilOzone repos are intentionally
 * absent: the FOC board lives in that org, so GitHub's native UI already
 * covers membership there; proactive cross-org checks only matter elsewhere.
 */
export const DEFAULT_TARGET_REPOS = ['filecoin-project/*', 'filbeam/*'] as const

export const DEFAULT_OR_FILTER_BOARD_PATTERNS = [
  'https://github.com/orgs/FilOzone/projects/*',
] as const

export const DEFAULT_STATUS_FIELD_NAME = 'Status'

export type AuthMethod = 'pat' | 'oauth' | 'none'

export type TargetRepoMode = 'default' | 'custom'

export type StoredConfig = {
  githubApiToken: string
  githubTokenKind: 'oauth' | 'pat' | ''
  authMethod: AuthMethod
  oauthTokenExpiresAt: number | null
  crossOrgBoardUrls: string[]
  /** User-entered custom repo patterns, independent of {@link crossOrgTargetReposMode}. */
  crossOrgTargetRepos: string[]
  crossOrgTargetReposMode: TargetRepoMode
  issuePrProjectsAutoExpand: boolean
  orFilterBoardPatterns: string[]
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

/**
 * Determines the effective target-repo mode. Installs that already had a custom
 * `crossOrgTargetRepos` list saved before this mode setting existed default to
 * "custom" on upgrade, so their existing configuration keeps working unchanged.
 */
function readTargetRepoMode(
  raw: Record<string, unknown>,
  storedRepos: string[] | undefined,
): TargetRepoMode {
  const explicit = raw[STORAGE_KEYS.crossOrgTargetReposMode]
  if (explicit === 'default' || explicit === 'custom') return explicit
  return Array.isArray(storedRepos) ? 'custom' : 'default'
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
    STORAGE_KEYS.crossOrgTargetReposMode,
    STORAGE_KEYS.issuePrProjectsAutoExpand,
    STORAGE_KEYS.orFilterBoardPatterns,
  ])

  const urls = raw[STORAGE_KEYS.crossOrgBoardUrls] as string[] | undefined
  const repos = raw[STORAGE_KEYS.crossOrgTargetRepos] as string[] | undefined
  const orPatterns = raw[STORAGE_KEYS.orFilterBoardPatterns] as string[] | undefined
  const targetReposMode = readTargetRepoMode(raw as Record<string, unknown>, repos)
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
    crossOrgTargetRepos: Array.isArray(repos) ? repos : [],
    crossOrgTargetReposMode: targetReposMode,
    issuePrProjectsAutoExpand,
    orFilterBoardPatterns:
      Array.isArray(orPatterns) ? orPatterns : [...DEFAULT_OR_FILTER_BOARD_PATTERNS],
  }
}

/**
 * Convert a glob-style URL pattern to a RegExp.
 * Supports `*` as wildcard for any characters.
 */
function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`, 'i')
}

/** Check whether a URL matches any of the configured OR filter board patterns. */
export function isOrFilterBoard(config: StoredConfig, pageUrl: string): boolean {
  return config.orFilterBoardPatterns.some((pattern) => {
    try {
      return globToRegExp(pattern.trim()).test(pageUrl)
    } catch {
      return false
    }
  })
}

/** The `owner/repo` glob patterns actually in effect, given the current mode. */
export function activeTargetRepoPatterns(config: StoredConfig): string[] {
  return config.crossOrgTargetReposMode === 'custom'
    ? config.crossOrgTargetRepos
    : [...DEFAULT_TARGET_REPOS]
}

export function isTargetRepo(config: StoredConfig, owner: string, name: string): boolean {
  const key = normalizeRepoKey(owner, name)
  return activeTargetRepoPatterns(config).some((pattern) => {
    try {
      return globToRegExp(pattern.trim()).test(key)
    } catch {
      return false
    }
  })
}
