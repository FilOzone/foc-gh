/**
 * Contract: Memex Paginated Items API Client
 *
 * Fetches project board items from GitHub's internal paginated items API.
 * Handles cursor-based pagination to retrieve complete result sets.
 */

/** Parameters for a paginated items API call */
export interface PaginatedItemsParams {
  /** The memex project ID (extracted from page) */
  memexId: string
  /** Filter query string */
  query: string
  /** Sort direction */
  sortDirection: 'asc' | 'desc'
  /** Column ID to sort by */
  sortColumnId: string
  /** Column ID to group by (optional) */
  groupColumnId?: string
  /** Column ID to slice by (optional) */
  sliceColumnId?: string
  /** Field IDs to include in response */
  fieldIds: string[]
}

/** A single page response from the paginated items API (grouped) */
export interface GroupedItemsResponse {
  groups: { nodes: GroupNode[] }
  groupedItems: Record<number, GroupItems>
  slices: Record<number, SliceInfo>
  totalCount: { value: number; isApproximate: boolean }
}

/** A single page response from the paginated items API (flat) */
export interface FlatItemsResponse {
  nodes: MemexItem[]
  pageInfo: { hasNextPage: boolean; endCursor: string }
  slices: Record<number, SliceInfo>
  totalCount: { value: number; isApproximate: boolean }
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
  pageInfo: { hasNextPage: boolean; endCursor: string }
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
 * Fetch all items for a single filter query, following pagination cursors.
 *
 * @param params - API call parameters
 * @returns Complete response with all items (pagination resolved)
 */
export declare function fetchAllItems(
  params: PaginatedItemsParams
): Promise<GroupedItemsResponse>

/**
 * Extract memexId and view configuration from the current page's embedded data.
 *
 * @param viewNumber - The current view number (from URL)
 * @returns Parameters needed for API calls
 */
export declare function extractViewParams(
  viewNumber: number
): PaginatedItemsParams | null
