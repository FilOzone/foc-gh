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

/**
 * Parse a full GitHub URL or a path-like string into issue / PR context.
 * Accepts e.g. https://github.com/o/r/issues/1, /o/r/pull/2, o/r/issues/1
 */
export function parseGithubIssuePrInput(raw: string): PageContext | null {
  const s = raw.trim()
  if (!s) return null

  let pathname = s
  if (/^https?:\/\//i.test(s)) {
    try {
      pathname = new URL(s).pathname
    } catch {
      return null
    }
  } else if (!s.startsWith('/')) {
    const issueShorthand = s.match(/^([^/\s]+)\/([^/\s]+)\/issues\/(\d+)\s*$/i)
    if (issueShorthand) {
      return {
        owner: issueShorthand[1],
        name: issueShorthand[2],
        number: Number(issueShorthand[3]),
        kind: 'issue',
      }
    }
    const prShorthand = s.match(/^([^/\s]+)\/([^/\s]+)\/pull\/(\d+)\s*$/i)
    if (prShorthand) {
      return {
        owner: prShorthand[1],
        name: prShorthand[2],
        number: Number(prShorthand[3]),
        kind: 'pull_request',
      }
    }
    pathname = s.startsWith('/') ? s : `/${s}`
  }

  return parseGithubIssuePrPath(pathname)
}
