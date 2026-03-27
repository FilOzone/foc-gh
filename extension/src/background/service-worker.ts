import type { ExtensionMessage } from '../lib/messages.js'
import { loadConfig, parseOrgProjectUrl } from '../lib/project-config.js'
import {
  MUTATION_ADD_PROJECT_ITEM,
  MUTATION_UPDATE_SINGLE_SELECT,
  QUERY_ISSUE_NODE_ID,
  QUERY_NODE_PROJECT_ITEMS,
  QUERY_PR_NODE_ID,
  QUERY_PROJECT_STATUS_FIELD,
  QUERY_PROJECT_V2,
  QUERY_PROJECT_V2_ITEMS_PAGE,
  QUERY_VIEWER,
} from '../lib/queries.js'

type GqlError = { message: string }

async function graphqlRequest(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<{ data?: unknown; errors?: GqlError[] }> {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) {
    const text = await res.text()
    return { errors: [{ message: `HTTP ${res.status}: ${text.slice(0, 240)}` }] }
  }
  return (await res.json()) as { data?: unknown; errors?: GqlError[] }
}

function firstError(errors: GqlError[] | undefined): string {
  return errors?.[0]?.message ?? 'Unknown GitHub GraphQL error'
}

function collectFieldLabels(fieldValues: { nodes?: FieldValueNode[] } | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const n of fieldValues?.nodes ?? []) {
    const fname = n.field?.name
    if (!fname) continue
    if ('name' in n && typeof n.name === 'string' && n.name) {
      out[fname] = n.name
    } else if ('number' in n && typeof n.number === 'number') {
      out[fname] = String(n.number)
    } else if ('text' in n && typeof n.text === 'string') {
      out[fname] = n.text
    }
  }
  return out
}
type FieldValueNode = {
  name?: string
  number?: number
  text?: string
  field?: { name?: string }
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

const PROJECT_ITEM_SCAN_MAX_PAGES = 40

async function findItemByProjectScan(
  token: string,
  projectId: string,
  contentId: string,
): Promise<ProjectItemNode | null> {
  let after: string | null | undefined

  for (let page = 0; page < PROJECT_ITEM_SCAN_MAX_PAGES; page++) {
    const res = await graphqlRequest(token, QUERY_PROJECT_V2_ITEMS_PAGE, {
      projectId,
      after: after ?? null,
    })
    if (res.errors?.length) return null

    const items = (res.data as { node?: { items?: ConnectionPage } })?.node?.items
    if (!items?.nodes?.length) return null

    for (const n of items.nodes) {
      const cid = n.content?.id
      if (cid === contentId) {
        return {
          id: n.id,
          project: n.project,
          fieldValues: n.fieldValues,
        }
      }
    }

    if (!items.pageInfo?.hasNextPage || !items.pageInfo.endCursor) return null
    after = items.pageInfo.endCursor
  }

  return null
}

type ConnectionPage = {
  pageInfo: { hasNextPage: boolean; endCursor?: string | null }
  nodes: Array<{
    id: string
    project?: ProjectItemNode['project']
    fieldValues?: ProjectItemNode['fieldValues']
    content?: { id?: string } | null
  }>
}

type DiagnosticsResponse = { ok: boolean; report: string }

async function runDiagnostics(): Promise<DiagnosticsResponse> {
  const lines: string[] = []
  const cfg = await loadConfig()

  lines.push('Using saved options — if you just pasted a new PAT, click Save first.')
  lines.push('')

  if (!cfg.githubApiToken.trim()) {
    lines.push('FAIL: No token in storage. Enter a PAT and click Save.')
    return { ok: false, report: lines.join('\n') }
  }
  lines.push('PASS: Token is non-empty in storage.')

  const viewerRes = await graphqlRequest(cfg.githubApiToken, QUERY_VIEWER)
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

  const projRes = await graphqlRequest(cfg.githubApiToken, QUERY_PROJECT_V2, {
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

  const pageRes = await graphqlRequest(cfg.githubApiToken, QUERY_PROJECT_V2_ITEMS_PAGE, {
    projectId: project.id,
    after: null,
  })
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

  const statusName = cfg.statusFieldName.trim() || 'Status'
  const sfRes = await graphqlRequest(cfg.githubApiToken, QUERY_PROJECT_STATUS_FIELD, {
    projectId: project.id,
    fieldName: statusName,
  })
  if (sfRes.errors?.length) {
    lines.push(`WARN: Status column "${statusName}" — ${firstError(sfRes.errors)}`)
  } else {
    const field = (sfRes.data as { node?: { field?: { id?: string; options?: unknown[] } } })?.node?.field
    if (field?.id && Array.isArray(field.options)) {
      lines.push(
        `PASS: Status column "${statusName}" is single-select (${field.options.length} option(s)).`,
      )
    } else {
      lines.push(
        `WARN: "${statusName}" not found or not a single-select field (check spelling vs board).`,
      )
    }
  }

  lines.push('')
  lines.push(
    'All PASS above means the PAT can reach the board API. If an issue still shows "not linked", open that issue and check the service worker console (chrome://extensions → service worker → Inspect).',
  )

  return { ok: true, report: lines.join('\n') }
}

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse): true => {
    void handleMessage(message).then(sendResponse)
    return true
  },
)

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  if (message.type === 'GRAPHQL') {
    const cfg = await loadConfig()
    if (!cfg.githubApiToken) {
      return { errors: [{ message: 'Missing GitHub API token. Open extension options.' }] }
    }
    return graphqlRequest(cfg.githubApiToken, message.payload.query, message.payload.variables)
  }

  if (message.type === 'GET_PANEL_STATE') {
    return getPanelState(message.payload)
  }

  if (message.type === 'ADD_TO_PROJECT') {
    const cfg = await loadConfig()
    if (!cfg.githubApiToken) {
      return { ok: false as const, error: 'Missing GitHub API token.' }
    }
    const result = await graphqlRequest(cfg.githubApiToken, MUTATION_ADD_PROJECT_ITEM, {
      projectId: message.payload.projectId,
      contentId: message.payload.contentNodeId,
    })
    if (result.errors?.length) {
      return { ok: false as const, error: firstError(result.errors) }
    }
    return { ok: true as const, data: result.data }
  }

  if (message.type === 'GET_STATUS_FIELD') {
    const cfg = await loadConfig()
    if (!cfg.githubApiToken) {
      return { ok: false as const, error: 'Missing GitHub API token.' }
    }
    const result = await graphqlRequest(cfg.githubApiToken, QUERY_PROJECT_STATUS_FIELD, {
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

  if (message.type === 'UPDATE_STATUS') {
    const cfg = await loadConfig()
    if (!cfg.githubApiToken) {
      return { ok: false as const, error: 'Missing GitHub API token.' }
    }
    const result = await graphqlRequest(cfg.githubApiToken, MUTATION_UPDATE_SINGLE_SELECT, {
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

  return { ok: false as const, error: 'Unknown message type' }
}

async function getPanelState(payload: {
  owner: string
  name: string
  number: number
  kind: 'issue' | 'pull_request'
}): Promise<unknown> {
  const cfg = await loadConfig()
  if (!cfg.githubApiToken) {
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

  const parsed = parseOrgProjectUrl(primaryUrl)
  if (!parsed) {
    return { ok: false as const, error: `Invalid board URL: ${primaryUrl}` }
  }

  const projRes = await graphqlRequest(cfg.githubApiToken, QUERY_PROJECT_V2, {
    org: parsed.org,
    number: parsed.number,
  })
  if (projRes.errors?.length) {
    return { ok: false as const, error: firstError(projRes.errors) }
  }

  const project = (projRes.data as { organization?: { projectV2?: { id: string; title: string; url?: string } } })
    ?.organization?.projectV2
  if (!project?.id) {
    return { ok: false as const, error: 'Project not found or no access.' }
  }

  const idQuery = payload.kind === 'issue' ? QUERY_ISSUE_NODE_ID : QUERY_PR_NODE_ID
  const idRes = await graphqlRequest(cfg.githubApiToken, idQuery, {
    owner: payload.owner,
    name: payload.name,
    number: payload.number,
  })
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

  const itemsRes = await graphqlRequest(cfg.githubApiToken, QUERY_NODE_PROJECT_ITEMS, {
    id: contentId,
  })
  if (itemsRes.errors?.length) {
    return { ok: false as const, error: firstError(itemsRes.errors) }
  }

  const node = (itemsRes.data as { node?: NodeWithItems })?.node
  const items = node?.projectItems?.nodes
  let match = matchProjectItem(items, project.id, parsed.org, parsed.number)
  if (!match) {
    match = await findItemByProjectScan(cfg.githubApiToken, project.id, contentId)
  }

  return {
    ok: true as const,
    projectId: project.id,
    projectTitle: project.title,
    projectUrl: project.url,
    primaryBoardUrl: primaryUrl,
    contentNodeId: contentId,
    item: match
      ? {
          itemId: match.id,
          fieldLabels: collectFieldLabels(match.fieldValues),
        }
      : null,
  }
}
