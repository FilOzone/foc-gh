export type PageKind = 'issue' | 'pull_request'

export type PageContext = {
  owner: string
  name: string
  number: number
  kind: PageKind
}

/**
 * Parse github.com issue / pull request URL from pathname.
 * Examples: /filecoin-project/curio/issues/42, /owner/repo/pull/99
 */
export function parseGithubIssuePrPath(pathname: string): PageContext | null {
  const p = pathname.replace(/\/+$/, '')
  const issueMatch = p.match(/^\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/i)
  if (issueMatch) {
    return {
      owner: issueMatch[1],
      name: issueMatch[2],
      number: Number(issueMatch[3]),
      kind: 'issue',
    }
  }
  const prMatch = p.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/i)
  if (prMatch) {
    return {
      owner: prMatch[1],
      name: prMatch[2],
      number: Number(prMatch[3]),
      kind: 'pull_request',
    }
  }
  return null
}

export function pageContextFromLocation(loc: Location): PageContext | null {
  return parseGithubIssuePrPath(loc.pathname)
}
