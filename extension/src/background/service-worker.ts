import type { ExtensionMessage, GetGlobalBoardsStateResponse, GlobalBoardRowState } from '../lib/messages.js'
import {
  findSingleSelectFieldByName,
  linesForBoardFieldDiagnostics,
  parseProjectV2FieldDefinitions,
  type SerializableProjectField,
} from '../lib/project-board-fields.js'
import { parseGithubIssuePrInput } from '../lib/github-url.js'
import { handleGetAuthStatus, handleGithubOAuthDisconnect, handleGithubOAuthStart } from './github-oauth-handler.js'
import {
  DEFAULT_STATUS_FIELD_NAME,
  loadConfig,
  parseOrgProjectUrl,
  resolveGithubBearer,
} from '../lib/project-config.js'
import {
  MUTATION_ADD_PROJECT_ITEM,
  MUTATION_DELETE_PROJECT_ITEM,
  MUTATION_UPDATE_ITERATION,
  MUTATION_UPDATE_NUMBER,
  MUTATION_UPDATE_SINGLE_SELECT,
  MUTATION_UPDATE_TEXT,
  QUERY_ISSUE_NODE_ID,
  QUERY_NODE_PROJECT_ITEMS,
  QUERY_PR_NODE_ID,
  QUERY_PROJECT_STATUS_FIELD,
  QUERY_PROJECT_V2,
  QUERY_PROJECT_V2_FIELD_DEFINITIONS,
  QUERY_PROJECT_V2_ITEM_FIELD_VALUES,
  QUERY_PROJECT_V2_ITEMS_PAGE,
  QUERY_REPO_ACCESS,
  QUERY_VIEWER,
} from '../lib/queries.js'

type GqlError = { message: string }

type DiagnosticsResponse = { ok: boolean; report: string }

/** When non-null, all GitHub API calls append timing rows for the options diagnostics UI. */
type DiagnosticsSession = {
  started: number
  entries: Array<{
    endOffsetMs: number
    durationMs: number
    method: string
    target: string
    status: string
    detail?: string
  }>
}

let diagnosticsSession: DiagnosticsSession | null = null

/** When set (options page connected for live log), each recorded request is posted immediately. */
let diagnosticsStreamPort: chrome.runtime.Port | null = null

function startDiagnosticsSession(): void {
  diagnosticsSession = { started: performance.now(), entries: [] }
}

type DiagnosticsSessionEntry = DiagnosticsSession['entries'][number]

function formatDiagnosticEntryLine(e: DiagnosticsSessionEntry): string {
  const d = e.detail ? `\n    ${e.detail}` : ''
  return `@${e.endOffsetMs}ms (+${e.durationMs}ms)\t${e.method}\t${e.status}\t${e.target}${d}`
}

function postDiagnosticStreamLine(entry: DiagnosticsSessionEntry): void {
  const p = diagnosticsStreamPort
  if (!p) return
  try {
    p.postMessage({ type: 'diagLine', line: formatDiagnosticEntryLine(entry) })
  } catch {
    /* port closed */
  }
}

function graphqlOperationLabel(query: string): string {
  const compact = query.replace(/\s+/g, ' ').trim()
  const named = compact.match(/^(query|mutation)\s+(\w+)/i)
  if (named) return `${named[1]} ${named[2]}`
  const anon = compact.match(/^(query|mutation)\s*\{/i)
  if (anon) return `${anon[1]} (anonymous)`
  return 'GraphQL'
}

function variablesSummary(variables: Record<string, unknown> | undefined): string | undefined {
  if (!variables || Object.keys(variables).length === 0) return undefined
  try {
    const s = JSON.stringify(variables)
    return s.length > 180 ? `${s.slice(0, 177)}…` : s
  } catch {
    return '(unserializable vars)'
  }
}

function recordDiagnosticHttp(entry: {
  durationMs: number
  method: string
  target: string
  status: string
  detail?: string
}): void {
  const s = diagnosticsSession
  if (!s) return
  const endOffsetMs = Math.round(performance.now() - s.started)
  const row: DiagnosticsSessionEntry = { endOffsetMs, ...entry }
  s.entries.push(row)
  postDiagnosticStreamLine(row)
}

function firstError(errors: GqlError[] | undefined): string {
  return errors?.[0]?.message ?? 'Unknown GitHub GraphQL error'
}

function withDiagnosticsRequestLog(result: DiagnosticsResponse): DiagnosticsResponse {
  const s = diagnosticsSession
  const log =
    s?.entries.length ?
      s.entries
        .map((e) => {
          const d = e.detail ? `\n    ${e.detail}` : ''
          return `@${e.endOffsetMs}ms (+${e.durationMs}ms)\t${e.method}\t${e.status}\t${e.target}${d}`
        })
        .join('\n')
    : '(no HTTP/GraphQL calls recorded before this result)'
  return {
    ok: result.ok,
    report: `${result.report}\n\n--- Request log (ordered; @ = ms since diagnostic start, + = request duration) ---\n${log}`,
  }
}

async function graphqlRequest(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<{ data?: unknown; errors?: GqlError[] }> {
  const t0 = performance.now()
  const op = graphqlOperationLabel(query)
  const vs = variablesSummary(variables)

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ query, variables }),
  })

  const durationMs = Math.round(performance.now() - t0)
  const target = 'POST https://api.github.com/graphql'

  if (!res.ok) {
    const text = await res.text()
    recordDiagnosticHttp({
      durationMs,
      method: 'POST',
      target,
      status: `HTTP ${res.status}`,
      detail: `${op}${vs ? ` ${vs}` : ''} body=${text.slice(0, 120)}`,
    })
    return { errors: [{ message: `HTTP ${res.status}: ${text.slice(0, 240)}` }] }
  }

  const json = (await res.json()) as { data?: unknown; errors?: GqlError[] }
  let status = 'OK'
  let detail = `${op}${vs ? ` ${vs}` : ''}`
  if (json.errors?.length) {
    status = 'GraphQL errors'
    detail = `${detail} → ${firstError(json.errors).slice(0, 160)}`
  }
  recordDiagnosticHttp({
    durationMs,
    method: 'POST',
    target,
    status,
    detail,
  })
  return json
}

function formatRequestedReviewer(reviewer: unknown): string | null {
  if (!reviewer || typeof reviewer !== 'object') return null
  const r = reviewer as Record<string, unknown>
  if (typeof r.login === 'string' && r.login) return r.login
  if (typeof r.name === 'string' && r.name) {
    const org = (r.organization as { login?: string } | undefined)?.login
    return typeof org === 'string' && org ? `${org}/${r.name}` : r.name
  }
  return null
}

/** Map a `fieldValues.nodes[]` entry to a display string; supports all GitHub `ProjectV2ItemField*Value` types we query. */
function formatProjectFieldValueNode(n: FieldValueNode): string | null {
  const labelNodes = n.labels?.nodes
  if (Array.isArray(labelNodes) && labelNodes.length > 0) {
    const names = labelNodes
      .map((x) => x?.name)
      .filter((x): x is string => typeof x === 'string' && x.length > 0)
    if (names.length) return names.join(', ')
  }

  const ms = n.milestone
  if (ms && typeof ms === 'object') {
    if (typeof ms.title === 'string' && ms.title) return ms.title
    if (typeof ms.url === 'string' && ms.url) return ms.url
    if (typeof ms.number === 'number' && Number.isFinite(ms.number)) return `#${ms.number}`
  }

  const repo = n.repository
  if (repo && typeof repo === 'object') {
    if (typeof repo.nameWithOwner === 'string' && repo.nameWithOwner) return repo.nameWithOwner
    if (typeof repo.url === 'string') return repo.url
  }

  const prNodes = n.pullRequests?.nodes
  if (Array.isArray(prNodes) && prNodes.length > 0) {
    const parts = prNodes
      .map((pr) => {
        if (!pr || typeof pr !== 'object') return null
        const p = pr as { title?: string; url?: string; number?: number }
        if (typeof p.title === 'string' && typeof p.url === 'string') return `${p.title} (${p.url})`
        if (typeof p.title === 'string') return p.title
        if (typeof p.url === 'string') return p.url
        if (typeof p.number === 'number' && Number.isFinite(p.number)) return `#${p.number}`
        return null
      })
      .filter((x): x is string => x !== null)
    if (parts.length) return parts.join(', ')
  }

  const userNodes = n.users?.nodes
  if (Array.isArray(userNodes) && userNodes.length > 0) {
    const logins = userNodes
      .map((u) => u?.login)
      .filter((x): x is string => typeof x === 'string' && x.length > 0)
    if (logins.length) return logins.join(', ')
  }

  const revNodes = n.reviewers?.nodes
  if (Array.isArray(revNodes) && revNodes.length > 0) {
    const parts = revNodes
      .map((x) => formatRequestedReviewer(x))
      .filter((x): x is string => x !== null)
    if (parts.length) return parts.join(', ')
  }

  if (typeof n.iterationId === 'string' && typeof n.title === 'string' && n.title) {
    const bits: string[] = [n.title]
    const sd = n.startDate
    if (sd != null && String(sd)) bits.push(String(sd))
    if (typeof n.duration === 'number' && Number.isFinite(n.duration)) bits.push(`${n.duration}d`)
    return bits.join(' · ')
  }

  if (typeof n.number === 'number' && Number.isFinite(n.number)) {
    return String(n.number)
  }

  if (typeof n.text === 'string') {
    return n.text
  }

  if (typeof n.date === 'string' && n.date) {
    return n.date
  }

  if (typeof n.name === 'string' && n.name) {
    return n.name
  }

  return null
}

function collectFieldLabels(fieldValues: { nodes?: FieldValueNode[] } | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const n of fieldValues?.nodes ?? []) {
    const fname = n.field?.name
    if (!fname) continue
    const v = formatProjectFieldValueNode(n)
    if (v !== null && v !== '') out[fname] = v
  }
  return out
}

type FieldValueNode = {
  name?: string
  number?: number
  text?: string
  date?: string
  title?: string
  iterationId?: string
  startDate?: unknown
  duration?: number
  field?: { name?: string }
  labels?: { nodes?: Array<{ name?: string } | null> | null } | null
  milestone?: { title?: string; url?: string; number?: number }
  repository?: { nameWithOwner?: string; url?: string }
  pullRequests?: {
    nodes?: Array<{ title?: string; url?: string; number?: number } | null> | null
  } | null
  users?: { nodes?: Array<{ login?: string } | null> | null } | null
  reviewers?: { nodes?: unknown[] | null } | null
}

type ProjectItemNode = {
  id: string
  project?: {
    id?: string
    title?: string
    url?: string
    number?: number
    owner?: { login?: string }
  }
  fieldValues?: { nodes?: FieldValueNode[] }
}

type NodeWithItems = {
  id?: string
  projectItems?: { nodes?: ProjectItemNode[] }
}

function matchProjectItem(
  nodes: ProjectItemNode[] | undefined,
  projectId: string,
  orgLogin: string,
  projectNumber: number,
): ProjectItemNode | null {
  if (!nodes) return null
  for (const it of nodes) {
    if (it.project?.id === projectId) return it
  }
  const orgLower = orgLogin.toLowerCase()
  for (const it of nodes) {
    const p = it.project
    if (p?.number !== projectNumber) continue
    const login = p.owner?.login?.toLowerCase()
    if (login === orgLower) return it
  }
  return null
}

function githubRestHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

function nextUrlFromGitHubLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null
  for (const part of linkHeader.split(',')) {
    const m = part.trim().match(/^<([^>]+)>;\s*rel="next"/)
    if (m) return m[1]
  }
  return null
}

type RestProjectItemRow = {
  node_id?: string
  /** REST list-items schema: top-level enum `Issue` | `PullRequest` | `DraftIssue` (not `content.type`). */
  content_type?: string
  content?: {
    number?: number | string
    type?: string
    url?: string
    repository?: {
      full_name?: string
      name?: string
      owner?: { login?: string }
    }
  }
}

function restRepositoryFullName(row: RestProjectItemRow): string | null {
  const r = row.content?.repository
  if (!r) return null
  if (r.full_name) return r.full_name.toLowerCase()
  const login = r.owner?.login
  const name = r.name
  if (login && name) return `${login}/${name}`.toLowerCase()
  return null
}

/** REST often returns `number` as a string; match `url` when needed. */
function restContentIssuePrNumber(
  content: RestProjectItemRow['content'],
  kind: 'issue' | 'pull_request',
): number | null {
  if (!content) return null
  if (typeof content.number === 'number' && Number.isFinite(content.number)) return content.number
  if (typeof content.number === 'string') {
    const n = Number(content.number)
    if (Number.isFinite(n)) return n
  }
  const u = content.url
  if (typeof u !== 'string') return null
  if (kind === 'issue') {
    const m = u.match(/\/issues\/(\d+)(?:[/?#]|$)/i)
    return m ? Number(m[1]) : null
  }
  const m = u.match(/\/pull\/(\d+)(?:[/?#]|$)/i)
  return m ? Number(m[1]) : null
}

/** Normalize REST `content_type` / legacy `content.type` / URL to issue | PR | draft | unknown. */
function restRowIssuePrKind(row: RestProjectItemRow): 'issue' | 'pull_request' | 'draft' | 'unknown' {
  const top = row.content_type
  if (typeof top === 'string') {
    const t = top.replace(/\s+/g, '').replace(/_/g, '').toLowerCase()
    if (t === 'issue') return 'issue'
    if (t === 'pullrequest') return 'pull_request'
    if (t === 'draftissue') return 'draft'
  }
  const c = row.content
  const ct = (c?.type ?? '').replace(/\s+/g, '').replace(/_/g, '').toLowerCase()
  if (ct === 'issue') return 'issue'
  if (ct === 'pullrequest') return 'pull_request'
  const u = c?.url
  if (typeof u === 'string') {
    if (/\/issues\/\d+/i.test(u)) return 'issue'
    if (/\/pull\/\d+/i.test(u)) return 'pull_request'
  }
  return 'unknown'
}

function restRowMatchesIssuePr(
  row: RestProjectItemRow,
  owner: string,
  name: string,
  number: number,
  kind: 'issue' | 'pull_request',
): boolean {
  const c = row.content
  const num = restContentIssuePrNumber(c, kind)
  if (num !== number) return false

  const wantRepo = `${owner}/${name}`.toLowerCase()
  const full = restRepositoryFullName(row)
  if (full) {
    if (full !== wantRepo) return false
  } else if (c?.url && typeof c.url === 'string') {
    const path = `/${owner}/${name}/`.toLowerCase()
    if (!c.url.toLowerCase().includes(path)) return false
  } else {
    return false
  }

  const rk = restRowIssuePrKind(row)
  if (rk === 'draft') return false
  if (kind === 'issue') return rk === 'issue'
  return rk === 'pull_request'
}

const REST_ITEMS_MAX_PAGES = 25

/**
 * Build `q` for GET .../projectsV2/.../items (same language as project view filters).
 * Uses issue/PR number as the keyword token (matches title / text fields) plus repo and type.
 * @see https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/filtering-projects
 */
function buildRestProjectItemsQuery(
  owner: string,
  name: string,
  kind: 'issue' | 'pull_request',
  issueOrPrNumber: number,
): string {
  const typeToken = kind === 'issue' ? 'is:issue' : 'is:pr'
  return `repo:${owner}/${name} ${typeToken} ${issueOrPrNumber}`
}

function buildRestProjectItemsQueryBroad(
  owner: string,
  name: string,
  kind: 'issue' | 'pull_request',
): string {
  const typeToken = kind === 'issue' ? 'is:issue' : 'is:pr'
  return `repo:${owner}/${name} ${typeToken}`
}

/**
 * List org project items with a given `q` until a row matches the issue/PR.
 * @param queryLabel — shown in diagnostics only (e.g. "narrow q", "broad q").
 */
async function findProjectItemWithRestQuery(
  token: string,
  org: string,
  projectNumber: number,
  projectGraphqlId: string,
  owner: string,
  name: string,
  number: number,
  kind: 'issue' | 'pull_request',
  q: string,
  queryLabel: string,
): Promise<ProjectItemNode | null> {
  const first = new URL(
    `https://api.github.com/orgs/${encodeURIComponent(org)}/projectsV2/${projectNumber}/items`,
  )
  first.searchParams.set('per_page', '100')
  first.searchParams.set('q', q)
  let url: string | null = first.toString()

  for (let page = 0; page < REST_ITEMS_MAX_PAGES && url; page++) {
    const t0 = performance.now()
    let res: Response
    try {
      res = await fetch(url, { headers: githubRestHeaders(token) })
    } catch (e) {
      try {
        const u = new URL(url)
        recordDiagnosticHttp({
          durationMs: Math.round(performance.now() - t0),
          method: 'GET',
          target: `GET https://api.github.com${u.pathname}${u.search}`,
          status: 'fetch failed',
          detail: `project items ${queryLabel} page ${page} ${String(e)}`,
        })
      } catch {
        /* ignore log shape */
      }
      return null
    }

    let logTarget = url
    try {
      const u = new URL(url)
      logTarget = `GET https://api.github.com${u.pathname}${u.search}`
    } catch {
      logTarget = `GET ${url}`
    }

    if (!res.ok) {
      recordDiagnosticHttp({
        durationMs: Math.round(performance.now() - t0),
        method: 'GET',
        target: logTarget,
        status: `HTTP ${res.status}`,
        detail: `list Project v2 items ${queryLabel} page ${page}`,
      })
      return null
    }

    let raw: unknown
    try {
      raw = await res.json()
    } catch {
      recordDiagnosticHttp({
        durationMs: Math.round(performance.now() - t0),
        method: 'GET',
        target: logTarget,
        status: 'invalid JSON body',
        detail: `list Project v2 items ${queryLabel} page ${page}`,
      })
      return null
    }

    recordDiagnosticHttp({
      durationMs: Math.round(performance.now() - t0),
      method: 'GET',
      target: logTarget,
      status: `${res.status}`,
      detail: `list Project v2 items ${queryLabel} page ${page}`,
    })
    const rows = Array.isArray(raw) ? raw : (raw as { items?: RestProjectItemRow[] }).items
    if (!Array.isArray(rows)) return null

    for (const row of rows) {
      if (!restRowMatchesIssuePr(row as RestProjectItemRow, owner, name, number, kind)) continue
      const itemNodeId = (row as RestProjectItemRow).node_id
      if (typeof itemNodeId !== 'string' || !itemNodeId) continue

      const fvRes = await graphqlRequest(token, QUERY_PROJECT_V2_ITEM_FIELD_VALUES, {
        itemId: itemNodeId,
      })
      const fvNode = (fvRes.data as { node?: { fieldValues?: ProjectItemNode['fieldValues'] } })?.node

      return {
        id: itemNodeId,
        project: { id: projectGraphqlId },
        fieldValues: fvRes.errors?.length ? undefined : fvNode?.fieldValues,
      }
    }

    url = nextUrlFromGitHubLink(res.headers.get('Link'))
  }

  return null
}

/**
 * Fast path: GitHub REST list project items supports `q` (same language as the UI).
 * Tries a narrow query (repo + type + number), then a broad query (repo + type only) so we
 * still client-filter by number when the API omits rows for the numeric token.
 */
async function findProjectItemViaRest(
  token: string,
  org: string,
  projectNumber: number,
  projectGraphqlId: string,
  owner: string,
  name: string,
  number: number,
  kind: 'issue' | 'pull_request',
): Promise<ProjectItemNode | null> {
  const narrow = buildRestProjectItemsQuery(owner, name, kind, number)
  const broad = buildRestProjectItemsQueryBroad(owner, name, kind)

  const a = await findProjectItemWithRestQuery(
    token,
    org,
    projectNumber,
    projectGraphqlId,
    owner,
    name,
    number,
    kind,
    narrow,
    'narrow q',
  )
  if (a) return a
  if (broad === narrow) return null
  return findProjectItemWithRestQuery(
    token,
    org,
    projectNumber,
    projectGraphqlId,
    owner,
    name,
    number,
    kind,
    broad,
    'broad q',
  )
}

async function executeApiDiagnostics(): Promise<DiagnosticsResponse> {
  const lines: string[] = []
  const cfg = await loadConfig()
  const bearer = resolveGithubBearer(cfg)

  lines.push('Using saved options — if you just pasted a new PAT, click Save first.')
  lines.push('')

  if (!bearer) {
    lines.push('FAIL: No token in storage. Connect GitHub or enter a PAT and click Save.')
    return { ok: false, report: lines.join('\n') }
  }
  const tokenHint = bearer.length > 8 ? `${bearer.substring(0, 8)}…` : '(short)'
  lines.push(`PASS: Token is non-empty in storage (auth: ${cfg.authMethod}, prefix: ${tokenHint}).`)

  const viewerRes = await graphqlRequest(bearer, QUERY_VIEWER)
  if (viewerRes.errors?.length) {
    lines.push(`FAIL: Viewer (whoami) — ${firstError(viewerRes.errors)}`)
    return { ok: false, report: lines.join('\n') }
  }
  const login = (viewerRes.data as { viewer?: { login?: string } })?.viewer?.login
  lines.push(`PASS: Authenticated as @${login ?? '(unknown)'}.`)

  const primaryUrl = cfg.crossOrgBoardUrls[0]
  if (!primaryUrl) {
    lines.push('FAIL: No primary board URL configured.')
    return { ok: false, report: lines.join('\n') }
  }

  const parsed = parseOrgProjectUrl(primaryUrl)
  if (!parsed) {
    lines.push(
      `FAIL: Board URL must match .../orgs/ORG/projects/N — got: ${primaryUrl.slice(0, 120)}`,
    )
    return { ok: false, report: lines.join('\n') }
  }
  lines.push(`PASS: Parsed board → org "${parsed.org}", project #${parsed.number}.`)

  const projRes = await graphqlRequest(bearer, QUERY_PROJECT_V2, {
    org: parsed.org,
    number: parsed.number,
  })
  if (projRes.errors?.length) {
    lines.push(`FAIL: projectV2 — ${firstError(projRes.errors)}`)
    return { ok: false, report: lines.join('\n') }
  }

  const project = (projRes.data as { organization?: { projectV2?: { id: string; title: string } } })
    ?.organization?.projectV2
  if (!project?.id) {
    lines.push('FAIL: projectV2 is null (check org access and project number).')
    return { ok: false, report: lines.join('\n') }
  }

  lines.push(`PASS: Project "${project.title}" (id starts with ${project.id.slice(0, 16)}…).`)

  const [pageRes, defsRes] = await Promise.all([
    graphqlRequest(bearer, QUERY_PROJECT_V2_ITEMS_PAGE, {
      projectId: project.id,
      after: null,
    }),
    graphqlRequest(bearer, QUERY_PROJECT_V2_FIELD_DEFINITIONS, {
      projectId: project.id,
    }),
  ])

  if (pageRes.errors?.length) {
    lines.push(`FAIL: List project items — ${firstError(pageRes.errors)}`)
    lines.push('Hint: Fine-grained PAT needs read access to this organization and Projects.')
    return { ok: false, report: lines.join('\n') }
  }

  const itemsConn = (pageRes.data as { node?: { items?: { nodes?: unknown[]; pageInfo?: { hasNextPage?: boolean } } } })
    ?.node?.items
  const count = itemsConn?.nodes?.length ?? 0
  const more = itemsConn?.pageInfo?.hasNextPage === true
  lines.push(`PASS: Can read board rows (sample page: ${count} item(s); more pages: ${more}).`)

  let diagOk = true

  if (defsRes.errors?.length) {
    diagOk = false
    lines.push(`FAIL: Board column discovery — ${firstError(defsRes.errors)}`)
    lines.push('  The sidebar card will not show interactive fields (Status dropdown, etc.).')
    lines.push('  This is often caused by an OAuth token that needs to be refreshed.')
    lines.push('  Try: Disconnect GitHub in options, then Connect GitHub again.')
    lines.push('  Alternatively, switch to a classic PAT with repo + project scopes.')
  } else {
    const boardFields = parseProjectV2FieldDefinitions(defsRes.data)
    const total =
      (defsRes.data as { node?: { fields?: { totalCount?: number } } })?.node?.fields?.totalCount
    if (typeof total === 'number' && total > boardFields.length) {
      lines.push(
        `PASS: Fetched ${boardFields.length} column definition(s) (API reports ${total} total; increase query first:100 if needed).`,
      )
    } else {
      lines.push(`PASS: Fetched ${boardFields.length} column definition(s).`)
    }
    lines.push('')
    lines.push(...linesForBoardFieldDiagnostics(boardFields))

    const statusName = DEFAULT_STATUS_FIELD_NAME.trim()
    const sel = findSingleSelectFieldByName(boardFields, statusName)
    if (sel) {
      lines.push('')
      lines.push(
        `PASS: Configured status column "${statusName}" exists as SINGLE_SELECT (${sel.options.length} option(s)).`,
      )
    } else {
      lines.push('')
      lines.push(
        `WARN: No SINGLE_SELECT column named "${statusName}" (sidebar header uses this name by default).`,
      )
    }
  }

  // ── Per-repo access check ───────────────────────────────────────────────
  lines.push('')
  lines.push('━━━ Target repo access (each configured repo) ━━━')
  lines.push('')

  const repos = cfg.crossOrgTargetRepos.map((r) => r.trim()).filter(Boolean)
  if (repos.length === 0) {
    lines.push('SKIP: No target repos configured.')
  } else {
    for (const repo of repos) {
      const parts = repo.split('/')
      if (parts.length !== 2) {
        lines.push(`SKIP: "${repo}" — not in owner/name format.`)
        continue
      }
      const [owner, name] = parts
      const repoRes = await graphqlRequest(bearer, QUERY_REPO_ACCESS, {
        owner,
        name,
      })
      if (repoRes.errors?.length) {
        diagOk = false
        const msg = firstError(repoRes.errors)
        lines.push(`FAIL: ${repo} — ${msg}`)
        if (msg.includes('OAuth App access restrictions')) {
          lines.push(`  → The "${owner}" org restricts third-party OAuth apps.`)
          lines.push(`    Approve this app at: github.com/organizations/${owner}/settings/oauth_application_policy`)
          lines.push(`    Or switch to a classic PAT.`)
        }
      } else {
        const nwo = (repoRes.data as { repository?: { nameWithOwner?: string } })
          ?.repository?.nameWithOwner
        if (nwo) {
          lines.push(`PASS: ${nwo} — accessible.`)
        } else {
          lines.push(`FAIL: ${repo} — repository not found or no access.`)
          diagOk = false
        }
      }
    }
  }

  lines.push('')
  if (diagOk) {
    lines.push(
      'All checks passed. If an issue still shows "not linked", run the visibility check below with that specific issue URL.',
    )
  } else {
    lines.push(
      'Some checks FAILED — see details above. If using OAuth, try disconnecting and reconnecting. If the problem persists, switch to a classic PAT.',
    )
  }

  return { ok: diagOk, report: lines.join('\n') }
}

async function runDiagnostics(): Promise<DiagnosticsResponse> {
  startDiagnosticsSession()
  try {
    return withDiagnosticsRequestLog(await executeApiDiagnostics())
  } finally {
    diagnosticsSession = null
  }
}

type PanelStateSuccess = {
  ok: true
  projectId: string
  projectTitle: string
  projectUrl?: string
  primaryBoardUrl: string
  contentNodeId: string
  /** Column definitions from `ProjectV2.fields` (names, types, single-select options, iterations). */
  boardFields: SerializableProjectField[]
  /** Non-null when the field-definitions GraphQL query returned an error (sidebar should warn). */
  fieldDefsError: string | null
  item: { itemId: string; fieldLabels: Record<string, string> } | null
}

function appendBoardSampleSection(lines: string[], ok: PanelStateSuccess): void {
  lines.push(`Board URL: ${ok.primaryBoardUrl}`)
  lines.push(`Project: ${ok.projectTitle}`)
  if (ok.projectUrl) lines.push(`Open project: ${ok.projectUrl}`)
  lines.push(`GraphQL content id: ${ok.contentNodeId}`)
  lines.push('')
  lines.push(...linesForBoardFieldDiagnostics(ok.boardFields))
  lines.push('')

  if (!ok.item) {
    lines.push(
      'RESULT: Not on this board — no matching project item (GraphQL projectItems + REST list-items).',
    )
    lines.push(
      'If the card appears on github.com, widen PAT project access or confirm the board URL.',
    )
    lines.push('')
    return
  }

  lines.push(`RESULT: On board — ProjectV2 item id: ${ok.item.itemId}`)
  lines.push('')
  lines.push('Field values on the card (iteration, people, reviewers, labels, milestone, repo, linked PRs, etc.):')
  const keys = Object.keys(ok.item.fieldLabels).sort()
  if (keys.length === 0) {
    lines.push('  (no field values returned — check token scope and field count limit)')
  } else {
    for (const k of keys) {
      const v = ok.item.fieldLabels[k] ?? ''
      lines.push(`  • ${k}: ${v}`)
    }
  }
  lines.push('')
  lines.push(
    'Note: Up to 50 field values are requested; omit empty or unsupported GitHub value shapes.',
  )
  lines.push('')
}

async function executeSampleBoardLinkDiagnostics(sampleInput: string): Promise<DiagnosticsResponse> {
  const lines: string[] = []
  lines.push('Issue / PR visibility on each configured Global board URL')
  lines.push('')

  const ctx = parseGithubIssuePrInput(sampleInput)
  if (!ctx) {
    lines.push('FAIL: Could not parse as a GitHub issue or pull request URL/path.')
    lines.push('Examples: https://github.com/owner/repo/issues/123 — owner/repo/pull/456')
    return { ok: false, report: lines.join('\n') }
  }

  const kindLabel = ctx.kind === 'issue' ? 'issue' : 'pull request'
  lines.push(`Resolved: ${ctx.owner}/${ctx.name} ${kindLabel} #${ctx.number}`)
  lines.push('')

  const cfg = await loadConfig()
  const bearer = resolveGithubBearer(cfg)
  if (!bearer) {
    lines.push('FAIL: No API token in storage. Save options first.')
    return { ok: false, report: lines.join('\n') }
  }

  const urls = cfg.crossOrgBoardUrls.map((u) => u.trim()).filter((u) => u.length > 0)
  if (urls.length === 0) {
    lines.push('FAIL: No Global board URLs configured in options.')
    return { ok: false, report: lines.join('\n') }
  }

  for (const boardUrl of urls) {
    lines.push(`━━━ ${boardUrl} ━━━`)
    const state = await getPanelStateForBoardUrl(ctx, boardUrl, bearer)
    if (typeof state !== 'object' || state === null) {
      lines.push('FAIL: Empty response from panel resolver.')
      lines.push('')
      continue
    }
    const st = state as { ok?: boolean; code?: string; error?: string }
    if (st.ok !== true) {
      lines.push(`FAIL: ${st.code === 'NO_TOKEN' ? 'No token (unexpected).' : st.error ?? 'Could not resolve board.'}`)
      lines.push('')
      continue
    }
    appendBoardSampleSection(lines, state as PanelStateSuccess)
  }

  return { ok: true, report: lines.join('\n').trimEnd() }
}

async function runSampleBoardLinkDiagnostics(sampleInput: string): Promise<DiagnosticsResponse> {
  startDiagnosticsSession()
  try {
    return withDiagnosticsRequestLog(await executeSampleBoardLinkDiagnostics(sampleInput))
  } finally {
    diagnosticsSession = null
  }
}

async function runDiagnosticsStreaming(port: chrome.runtime.Port): Promise<void> {
  diagnosticsStreamPort = port
  startDiagnosticsSession()
  port.onDisconnect.addListener(() => {
    if (diagnosticsStreamPort === port) diagnosticsStreamPort = null
  })
  try {
    const result = await executeApiDiagnostics()
    port.postMessage({ type: 'complete', ok: result.ok, report: result.report })
  } catch (e) {
    try {
      port.postMessage({ type: 'error', message: String(e) })
    } catch {
      /* ignore */
    }
  } finally {
    diagnosticsStreamPort = null
    diagnosticsSession = null
  }
}

async function runSampleBoardLinkStreaming(port: chrome.runtime.Port, sampleInput: string): Promise<void> {
  diagnosticsStreamPort = port
  startDiagnosticsSession()
  port.onDisconnect.addListener(() => {
    if (diagnosticsStreamPort === port) diagnosticsStreamPort = null
  })
  try {
    const result = await executeSampleBoardLinkDiagnostics(sampleInput)
    port.postMessage({ type: 'complete', ok: result.ok, report: result.report })
  } catch (e) {
    try {
      port.postMessage({ type: 'error', message: String(e) })
    } catch {
      /* ignore */
    }
  } finally {
    diagnosticsStreamPort = null
    diagnosticsSession = null
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'diagnostics') return
  port.onMessage.addListener((msg: unknown) => {
    const m = msg as { type?: string; url?: string }
    if (m.type === 'DEBUG_DIAGNOSTICS_STREAM') {
      void runDiagnosticsStreaming(port)
      return
    }
    if (m.type === 'DEBUG_SAMPLE_BOARD_LINK_STREAM') {
      void runSampleBoardLinkStreaming(port, String(m.url ?? ''))
    }
  })
})

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse): true => {
    void handleMessage(message).then(sendResponse)
    return true
  },
)

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  if (message.type === 'GITHUB_OAUTH_START') {
    return handleGithubOAuthStart()
  }
  if (message.type === 'GITHUB_OAUTH_DISCONNECT') {
    return handleGithubOAuthDisconnect()
  }
  if (message.type === 'GET_AUTH_STATUS') {
    return handleGetAuthStatus()
  }

  if (message.type === 'GRAPHQL') {
    const cfg = await loadConfig()
    const token = resolveGithubBearer(cfg)
    if (!token) {
      return { errors: [{ message: 'Missing GitHub API token. Open extension options.' }] }
    }
    return graphqlRequest(token, message.payload.query, message.payload.variables)
  }

  if (message.type === 'GET_PANEL_STATE') {
    return getPanelState(message.payload)
  }

  if (message.type === 'ADD_TO_PROJECT') {
    const cfg = await loadConfig()
    const token = resolveGithubBearer(cfg)
    if (!token) {
      return { ok: false as const, error: 'Missing GitHub API token.' }
    }
    const result = await graphqlRequest(token, MUTATION_ADD_PROJECT_ITEM, {
      projectId: message.payload.projectId,
      contentId: message.payload.contentNodeId,
    })
    if (result.errors?.length) {
      return { ok: false as const, error: firstError(result.errors) }
    }
    return { ok: true as const, data: result.data }
  }

  if (message.type === 'GET_GLOBAL_BOARDS_STATE') {
    return getGlobalBoardsState(message.payload)
  }

  if (message.type === 'DELETE_PROJECT_ITEM') {
    const cfg = await loadConfig()
    const token = resolveGithubBearer(cfg)
    if (!token) {
      return { ok: false as const, error: 'Missing GitHub API token.' }
    }
    const result = await graphqlRequest(token, MUTATION_DELETE_PROJECT_ITEM, {
      projectId: message.payload.projectId,
      itemId: message.payload.itemId,
    })
    if (result.errors?.length) {
      return { ok: false as const, error: firstError(result.errors) }
    }
    return { ok: true as const, data: result.data }
  }

  if (message.type === 'GET_STATUS_FIELD') {
    const cfg = await loadConfig()
    const token = resolveGithubBearer(cfg)
    if (!token) {
      return { ok: false as const, error: 'Missing GitHub API token.' }
    }
    const result = await graphqlRequest(token, QUERY_PROJECT_STATUS_FIELD, {
      projectId: message.payload.projectId,
      fieldName: message.payload.fieldName,
    })
    if (result.errors?.length) {
      return { ok: false as const, error: firstError(result.errors) }
    }
    const node = (result.data as { node?: unknown })?.node as
      | {
          field?: {
            id?: string
            name?: string
            options?: { id: string; name: string }[]
          }
        }
      | undefined
    const field = node?.field
    if (!field?.id || !field.options) {
      return { ok: false as const, error: 'Status field not found or not single-select.' }
    }
    return {
      ok: true as const,
      field: { id: field.id, name: field.name ?? message.payload.fieldName, options: field.options },
    }
  }

  if (message.type === 'UPDATE_ITEM_FIELD') {
    const cfg = await loadConfig()
    const token = resolveGithubBearer(cfg)
    if (!token) {
      return { ok: false as const, error: 'Missing GitHub API token.' }
    }
    const { projectId, itemId, fieldId, value } = message.payload
    const gql =
      value.kind === 'single_select' ?
        graphqlRequest(token, MUTATION_UPDATE_SINGLE_SELECT, {
          projectId,
          itemId,
          fieldId,
          optionId: value.optionId,
        })
      : value.kind === 'number' ?
        graphqlRequest(token, MUTATION_UPDATE_NUMBER, {
          projectId,
          itemId,
          fieldId,
          number: value.number,
        })
      : value.kind === 'text' ?
        graphqlRequest(token, MUTATION_UPDATE_TEXT, {
          projectId,
          itemId,
          fieldId,
          text: value.text,
        })
      : graphqlRequest(token, MUTATION_UPDATE_ITERATION, {
          projectId,
          itemId,
          fieldId,
          iterationId: value.iterationId,
        })

    const result = await gql
    if (result.errors?.length) {
      return { ok: false as const, error: firstError(result.errors) }
    }
    return { ok: true as const, data: result.data }
  }

  if (message.type === 'UPDATE_STATUS') {
    const cfg = await loadConfig()
    const token = resolveGithubBearer(cfg)
    if (!token) {
      return { ok: false as const, error: 'Missing GitHub API token.' }
    }
    const result = await graphqlRequest(token, MUTATION_UPDATE_SINGLE_SELECT, {
      projectId: message.payload.projectId,
      itemId: message.payload.itemId,
      fieldId: message.payload.fieldId,
      optionId: message.payload.optionId,
    })
    if (result.errors?.length) {
      return { ok: false as const, error: firstError(result.errors) }
    }
    return { ok: true as const, data: result.data }
  }

  if (message.type === 'DEBUG_DIAGNOSTICS') {
    return runDiagnostics()
  }

  if (message.type === 'DEBUG_SAMPLE_BOARD_LINK') {
    return runSampleBoardLinkDiagnostics(message.payload.url)
  }

  return { ok: false as const, error: 'Unknown message type' }
}

async function resolveGlobalBoardRow(
  bearer: string,
  boardUrl: string,
  payload: { owner: string; name: string; number: number; kind: 'issue' | 'pull_request' },
  contentId: string,
): Promise<GlobalBoardRowState | null> {
  const parsed = parseOrgProjectUrl(boardUrl)
  if (!parsed) return null

  const projRes = await graphqlRequest(bearer, QUERY_PROJECT_V2, {
    org: parsed.org,
    number: parsed.number,
  })
  if (projRes.errors?.length) return null

  const project = (projRes.data as { organization?: { projectV2?: { id: string; title: string } } })
    ?.organization?.projectV2
  if (!project?.id) return null

  const crossOrg = payload.owner.trim().toLowerCase() !== parsed.org.trim().toLowerCase()
  let match: ProjectItemNode | null = null

  if (crossOrg) {
    match = await findProjectItemViaRest(
      bearer,
      parsed.org,
      parsed.number,
      project.id,
      payload.owner,
      payload.name,
      payload.number,
      payload.kind,
    )
  } else {
    const itemsRes = await graphqlRequest(bearer, QUERY_NODE_PROJECT_ITEMS, {
      id: contentId,
    })
    if (!itemsRes.errors?.length) {
      const node = (itemsRes.data as { node?: NodeWithItems })?.node
      const items = node?.projectItems?.nodes
      match = matchProjectItem(items, project.id, parsed.org, parsed.number)
    }
    if (!match) {
      match = await findProjectItemViaRest(
        bearer,
        parsed.org,
        parsed.number,
        project.id,
        payload.owner,
        payload.name,
        payload.number,
        payload.kind,
      )
    }
  }

  return {
    url: boardUrl.trim(),
    projectId: project.id,
    itemId: match?.id ?? null,
    label: project.title,
  }
}

async function getGlobalBoardsState(payload: {
  owner: string
  name: string
  number: number
  kind: 'issue' | 'pull_request'
}): Promise<GetGlobalBoardsStateResponse> {
  const cfg = await loadConfig()
  const bearer = resolveGithubBearer(cfg)
  if (!bearer) {
    return {
      ok: false,
      code: 'NO_TOKEN',
      error: 'Configure a GitHub PAT or OAuth token in extension options.',
    }
  }

  const idQuery = payload.kind === 'issue' ? QUERY_ISSUE_NODE_ID : QUERY_PR_NODE_ID
  const idRes = await graphqlRequest(bearer, idQuery, {
    owner: payload.owner,
    name: payload.name,
    number: payload.number,
  })
  if (idRes.errors?.length) {
    return { ok: false, error: firstError(idRes.errors) }
  }
  const repo = (idRes.data as { repository?: { issue?: { id?: string }; pullRequest?: { id?: string } } })
    ?.repository
  const contentId =
    payload.kind === 'issue' ? repo?.issue?.id : repo?.pullRequest?.id
  if (!contentId) {
    return { ok: false, error: 'Issue or pull request not found.' }
  }

  const urls = cfg.crossOrgBoardUrls.map((u) => u.trim()).filter((u) => u.length > 0)
  const rows = (
    await Promise.all(urls.map((url) => resolveGlobalBoardRow(bearer, url, payload, contentId)))
  ).filter((r): r is GlobalBoardRowState => r !== null)

  return { ok: true, contentNodeId: contentId, rows }
}

type PanelPayload = {
  owner: string
  name: string
  number: number
  kind: 'issue' | 'pull_request'
}

async function getPanelStateForBoardUrl(
  payload: PanelPayload,
  boardUrl: string,
  bearer: string,
): Promise<unknown> {
  const primaryUrl = boardUrl.trim()
  if (!primaryUrl) {
    return { ok: false as const, error: 'Empty board URL.' }
  }

  const parsed = parseOrgProjectUrl(primaryUrl)
  if (!parsed) {
    return { ok: false as const, error: `Invalid board URL: ${primaryUrl}` }
  }

  const idQuery = payload.kind === 'issue' ? QUERY_ISSUE_NODE_ID : QUERY_PR_NODE_ID
  const [projRes, idRes] = await Promise.all([
    graphqlRequest(bearer, QUERY_PROJECT_V2, {
      org: parsed.org,
      number: parsed.number,
    }),
    graphqlRequest(bearer, idQuery, {
      owner: payload.owner,
      name: payload.name,
      number: payload.number,
    }),
  ])

  if (projRes.errors?.length) {
    return { ok: false as const, error: firstError(projRes.errors) }
  }

  const project = (projRes.data as { organization?: { projectV2?: { id: string; title: string; url?: string } } })
    ?.organization?.projectV2
  if (!project?.id) {
    return { ok: false as const, error: 'Project not found or no access.' }
  }

  if (idRes.errors?.length) {
    return { ok: false as const, error: firstError(idRes.errors) }
  }

  const repo = (idRes.data as { repository?: { issue?: { id?: string }; pullRequest?: { id?: string } } })
    ?.repository
  const contentId =
    payload.kind === 'issue' ? repo?.issue?.id : repo?.pullRequest?.id
  if (!contentId) {
    return { ok: false as const, error: 'Issue or pull request not found.' }
  }

  /**
   * `QUERY_NODE_PROJECT_ITEMS` only returns project links visible in-repo for the
   * same org; cross-org boards (issue under e.g. filecoin-project, project under
   * FilOzone) always come back empty after a wasted round trip. Skip GraphQL and
   * use REST list-items immediately when repo owner !== configured project org.
   */
  const crossOrg =
    payload.owner.trim().toLowerCase() !== parsed.org.trim().toLowerCase()

  let boardFields: SerializableProjectField[] = []
  let match: ProjectItemNode | null = null

  let fieldDefsError: string | null = null
  if (crossOrg) {
    const [defsRes, restMatch] = await Promise.all([
      graphqlRequest(bearer, QUERY_PROJECT_V2_FIELD_DEFINITIONS, {
        projectId: project.id,
      }),
      findProjectItemViaRest(
        bearer,
        parsed.org,
        parsed.number,
        project.id,
        payload.owner,
        payload.name,
        payload.number,
        payload.kind,
      ),
    ])
    if (defsRes.errors?.length) {
      fieldDefsError = firstError(defsRes.errors)
    } else {
      boardFields = parseProjectV2FieldDefinitions(defsRes.data)
    }
    match = restMatch
  } else {
    const [itemsRes, defsRes] = await Promise.all([
      graphqlRequest(bearer, QUERY_NODE_PROJECT_ITEMS, {
        id: contentId,
      }),
      graphqlRequest(bearer, QUERY_PROJECT_V2_FIELD_DEFINITIONS, {
        projectId: project.id,
      }),
    ])
    if (itemsRes.errors?.length) {
      return { ok: false as const, error: firstError(itemsRes.errors) }
    }
    if (defsRes.errors?.length) {
      fieldDefsError = firstError(defsRes.errors)
    } else {
      boardFields = parseProjectV2FieldDefinitions(defsRes.data)
    }
    const node = (itemsRes.data as { node?: NodeWithItems })?.node
    const items = node?.projectItems?.nodes
    match = matchProjectItem(items, project.id, parsed.org, parsed.number)
    if (!match) {
      match = await findProjectItemViaRest(
        bearer,
        parsed.org,
        parsed.number,
        project.id,
        payload.owner,
        payload.name,
        payload.number,
        payload.kind,
      )
    }
  }

  return {
    ok: true as const,
    projectId: project.id,
    projectTitle: project.title,
    projectUrl: project.url,
    primaryBoardUrl: primaryUrl,
    contentNodeId: contentId,
    boardFields,
    fieldDefsError,
    item: match
      ? {
          itemId: match.id,
          fieldLabels: collectFieldLabels(match.fieldValues),
        }
      : null,
  }
}

async function getPanelState(payload: PanelPayload): Promise<unknown> {
  const cfg = await loadConfig()
  const bearer = resolveGithubBearer(cfg)
  if (!bearer) {
    return {
      ok: false as const,
      code: 'NO_TOKEN' as const,
      error: 'Configure a GitHub PAT or OAuth token in extension options.',
    }
  }

  const primaryUrl = cfg.crossOrgBoardUrls[0]
  if (!primaryUrl) {
    return { ok: false as const, error: 'No board URL configured.' }
  }

  return getPanelStateForBoardUrl(payload, primaryUrl, bearer)
}
