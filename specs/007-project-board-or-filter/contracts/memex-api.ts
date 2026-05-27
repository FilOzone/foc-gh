/**
 * Contract: Memex Paginated Items API Types
 *
 * Type definitions for GitHub's internal paginated items API response.
 * These types were verified empirically against live API responses.
 *
 * NOTE: The original spec assumed groupedItems and slices were Record<number, T>
 * (numeric-keyed objects). Empirical testing confirmed they are actual Arrays.
 * The groups object also includes a pageInfo field.
 */

/** A single page response from the paginated items API (grouped) */
export interface GroupedItemsResponse {
  groups: { nodes: GroupNode[]; pageInfo: PageInfo }
  groupedItems: GroupItems[]
  slices: SliceInfo[]
  totalCount: { value: number; isApproximate: boolean }
}

export interface PageInfo {
  startCursor?: string
  endCursor: string
  hasNextPage: boolean
  hasPreviousPage?: boolean
}

export interface GroupNode {
  groupValue: string
  groupId: string
  groupMetadata: {
    id: string
    name: string
    nameHtml: string
    color: string
    description: string
    descriptionHtml: string
  }
  totalCount: { value: number; isApproximate: boolean }
  fieldMetrics: unknown[]
}

export interface GroupItems {
  groupId: string
  nodes: MemexItem[]
  pageInfo: PageInfo
}

export interface SliceInfo {
  sliceId: string
  sliceValue: string
  totalCount: { value: number; isApproximate: boolean }
}

export interface MemexItem {
  id: number
  contentId: number
  contentType: 'Issue' | 'PullRequest'
  contentRepositoryId: number
  updatedAt: string
  createdAt: string
  state: string
  memexProjectColumnValues: ColumnValue[]
  content: unknown
  [key: string]: unknown
}

export interface ColumnValue {
  memexProjectColumnId: string | number
  value: unknown
}

/**
 * Extract memexId and view configuration from the current page's embedded data.
 *
 * Implementation note: In the shipped code, memexId extraction and view param
 * parsing are handled inline in board-data-injector.ts rather than as a
 * standalone function. The interceptor clones the original URL from the React
 * app's fetch call and only replaces the `q` parameter, preserving all other
 * params (sortedBy, groupedBy, sliceBy, fieldIds, layout, sumFields, hierarchy).
 */
