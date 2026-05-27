/**
 * Contract: OR Query Parser
 *
 * Parses a project board filter string for OR syntax and returns
 * a structured representation of the query branches.
 */

/** Result of parsing a filter string for OR syntax */
export interface ORQuery {
  /** Shared filter terms before the first parenthesized group */
  prefix: string
  /** Filter conditions for each OR branch (contents of parenthesized groups) */
  branches: string[]
  /** Original unparsed query string */
  raw: string
}

/** Parse error when OR syntax is detected but malformed */
export interface ORParseError {
  type: 'nested_parens' | 'trailing_terms' | 'or_inside_parens' | 'single_branch'
  message: string
  raw: string
}

/** Result of attempting to parse OR syntax */
export type ORParseResult =
  | { kind: 'or_query'; query: ORQuery }
  | { kind: 'plain_query'; raw: string }     // No OR syntax — pass through
  | { kind: 'invalid_or'; error: ORParseError } // Malformed OR syntax

/**
 * Parse a filter string for OR syntax.
 *
 * Valid OR syntax: "shared-prefix (branch-1) OR (branch-2) [OR (branch-N)]"
 *
 * Rules:
 * - At least 2 parenthesized groups separated by uppercase "OR"
 * - Shared prefix (before first group) is applied to all branches
 * - No nested parentheses
 * - No filter terms after the final closing parenthesis
 * - No "OR" keyword inside parentheses
 * - Maximum 5 branches
 *
 * @param filterText - The raw filter string from the filter bar
 * @returns Parsed result: OR query, plain query, or invalid OR error
 */
export declare function parseORQuery(filterText: string): ORParseResult
