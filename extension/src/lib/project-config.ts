/** Mirrors [data-model.md](../../specs/001-cross-org-board-ui/data-model.md) */

export const STORAGE_KEYS = {
  githubApiToken: 'github_api_token',
  githubTokenKind: 'github_token_kind',
  crossOrgBoardUrls: 'cross_org_board_urls',
  crossOrgTargetRepos: 'cross_org_target_repos',
  statusFieldName: 'status_field_name',
} as const

export const DEFAULT_BOARD_URLS = ['https://github.com/orgs/FilOzone/projects/14'] as const

export const DEFAULT_TARGET_REPOS = [
  'filecoin-project/curio',
  'filecoin-project/filecoin-pin',
] as const

export const DEFAULT_STATUS_FIELD_NAME = 'Status'

export type StoredConfig = {
  githubApiToken: string
  githubTokenKind: 'oauth' | 'pat' | ''
  crossOrgBoardUrls: string[]
  crossOrgTargetRepos: string[]
  statusFieldName: string
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

export async function loadConfig(): Promise<StoredConfig> {
  const raw = await chrome.storage.local.get([
    STORAGE_KEYS.githubApiToken,
    STORAGE_KEYS.githubTokenKind,
    STORAGE_KEYS.crossOrgBoardUrls,
    STORAGE_KEYS.crossOrgTargetRepos,
    STORAGE_KEYS.statusFieldName,
  ])

  const urls = raw[STORAGE_KEYS.crossOrgBoardUrls] as string[] | undefined
  const repos = raw[STORAGE_KEYS.crossOrgTargetRepos] as string[] | undefined

  return {
    githubApiToken: String(raw[STORAGE_KEYS.githubApiToken] ?? ''),
    githubTokenKind: (raw[STORAGE_KEYS.githubTokenKind] as StoredConfig['githubTokenKind']) ?? '',
    crossOrgBoardUrls:
      Array.isArray(urls) && urls.length > 0 ? urls : [...DEFAULT_BOARD_URLS],
    crossOrgTargetRepos:
      Array.isArray(repos) && repos.length > 0 ? repos : [...DEFAULT_TARGET_REPOS],
    statusFieldName: String(raw[STORAGE_KEYS.statusFieldName] ?? DEFAULT_STATUS_FIELD_NAME),
  }
}

export function isTargetRepo(config: StoredConfig, owner: string, name: string): boolean {
  const key = normalizeRepoKey(owner, name)
  return config.crossOrgTargetRepos.some((r) => r.trim().toLowerCase() === key)
}
