/**
 * OR Query Parser
 *
 * Parses a project board filter string for OR syntax and returns
 * a structured representation of the query branches.
 *
 * Valid syntax: "shared-prefix (branch-1) OR (branch-2) [OR (branch-N)]"
 */

export interface ORQuery {
  prefix: string
  branches: string[]
  raw: string
}

export interface ORParseError {
  type: 'nested_parens' | 'trailing_terms' | 'or_inside_parens' | 'single_branch'
  message: string
  raw: string
}

export type ORParseResult =
  | { kind: 'or_query'; query: ORQuery }
  | { kind: 'plain_query'; raw: string }
  | { kind: 'invalid_or'; error: ORParseError }

const MAX_BRANCHES = 5

export function parseORQuery(filterText: string): ORParseResult {
  const raw = filterText.trim()
  if (!raw) return { kind: 'plain_query', raw }

  // Quick check: does this contain parentheses at all?
  if (!raw.includes('(')) return { kind: 'plain_query', raw }

  // Check for nested parentheses: (( or )) patterns
  if (/\(\s*\(/.test(raw) || /\)\s*\)/.test(raw)) {
    return {
      kind: 'invalid_or',
      error: { type: 'nested_parens', message: 'Nested parentheses are not supported', raw },
    }
  }

  // Check for OR inside parentheses: (... OR ...)
  // Match content inside parens and look for standalone OR keyword
  const parenContentRe = /\(([^)]*)\)/g
  let match: RegExpExecArray | null
  while ((match = parenContentRe.exec(raw)) !== null) {
    // Check for standalone OR (word boundary) inside parens
    if (/(?:^|\s)OR(?:\s|$)/.test(match[1])) {
      return {
        kind: 'invalid_or',
        error: { type: 'or_inside_parens', message: 'OR keyword cannot appear inside parentheses', raw },
      }
    }
  }

  // Extract parenthesized groups and the text between them
  // Build a structural view: prefix (group1) separator (group2) ... trailing
  const groupRe = /\(([^)]*)\)/g
  const groups: string[] = []
  const groupPositions: { start: number; end: number }[] = []

  let m: RegExpExecArray | null
  while ((m = groupRe.exec(raw)) !== null) {
    groups.push(m[1].trim())
    groupPositions.push({ start: m.index, end: m.index + m[0].length })
  }

  if (groups.length === 0) return { kind: 'plain_query', raw }

  // Check for text after the final closing paren
  const afterLast = raw.slice(groupPositions[groupPositions.length - 1].end).trim()
  if (afterLast) {
    // If there are groups and OR keywords, this is invalid trailing terms
    if (groups.length >= 2 || raw.includes(' OR ')) {
      return {
        kind: 'invalid_or',
        error: { type: 'trailing_terms', message: 'Filter terms after the final group are not supported', raw },
      }
    }
    // Otherwise it's just a plain query with parens (not OR syntax)
    return { kind: 'plain_query', raw }
  }

  // Single group without OR — plain query
  if (groups.length === 1) {
    // Check if there's an OR keyword somewhere (malformed)
    if (/(?:^|\s)OR(?:\s|$)/.test(raw)) {
      return {
        kind: 'invalid_or',
        error: { type: 'single_branch', message: 'OR requires at least two parenthesized groups', raw },
      }
    }
    return { kind: 'plain_query', raw }
  }

  // Multiple groups — verify OR separators between each pair
  for (let i = 0; i < groupPositions.length - 1; i++) {
    const between = raw.slice(groupPositions[i].end, groupPositions[i + 1].start).trim()
    if (between !== 'OR') {
      // Groups exist but aren't separated by OR — plain query
      return { kind: 'plain_query', raw }
    }
  }

  // Valid OR syntax — extract prefix and branches
  const prefix = raw.slice(0, groupPositions[0].start).trim()
  const branches = groups.filter((g) => g.length > 0)

  if (branches.length < 2) {
    return {
      kind: 'invalid_or',
      error: { type: 'single_branch', message: 'OR requires at least two non-empty branches', raw },
    }
  }

  if (branches.length > MAX_BRANCHES) {
    return {
      kind: 'invalid_or',
      error: {
        type: 'single_branch',
        message: `Maximum ${MAX_BRANCHES} OR branches supported, got ${branches.length}`,
        raw,
      },
    }
  }

  return {
    kind: 'or_query',
    query: { prefix, branches, raw },
  }
}
