/**
 * Type definitions for GitHub's internal memex paginated items API.
 *
 * These types describe the response shape from GET /memexes/{id}/paginated_items.
 * Used by board-data-injector.ts (fetch interception) and result-merger.ts (merging).
 */

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

export interface MemexItem {
  id: number
  contentId: number
  contentType: 'Issue' | 'PullRequest'
  contentRepositoryId: number
  updatedAt: string
  createdAt: string
  state: string
  memexProjectColumnValues: { memexProjectColumnId: string | number; value: unknown }[]
  content: unknown
  [key: string]: unknown
}

export interface PageInfo {
  startCursor?: string
  endCursor: string
  hasNextPage: boolean
  hasPreviousPage?: boolean
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

export interface GroupedItemsResponse {
  groups: { nodes: GroupNode[]; pageInfo: PageInfo }
  groupedItems: GroupItems[]
  slices: SliceInfo[]
  totalCount: { value: number; isApproximate: boolean }
}
