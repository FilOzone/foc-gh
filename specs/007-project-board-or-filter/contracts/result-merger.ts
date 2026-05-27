/**
 * Contract: Result Merger
 *
 * Merges multiple paginated items API responses into a single
 * deduplicated response that the React app can render natively.
 */

import type { GroupedItemsResponse } from './memex-api'

/**
 * Merge multiple API responses (one per OR branch) into a single response.
 *
 * - Deduplicates items by `item.id` (first occurrence wins)
 * - Unions group metadata from all branches (by groupId)
 * - Assigns items to correct groups based on their source branch grouping
 * - Recalculates totalCount as the count of unique items
 * - Merges slice data from all branches (dedup by sliceId; note: per-slice
 *   totalCounts are kept from the first branch seen — they may be inconsistent
 *   after deduplication, but GitHub's UI handles this gracefully)
 *
 * @param responses - Array of responses, one per OR branch
 * @returns Single merged response compatible with the React app's expected format
 */
export declare function mergeResponses(
  responses: GroupedItemsResponse[]
): GroupedItemsResponse
