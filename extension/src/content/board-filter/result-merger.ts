/**
 * Result Merger
 *
 * Merges multiple paginated items API responses (one per OR branch) into a single
 * deduplicated response that the React app can render natively.
 */

import type { GroupedItemsResponse, GroupNode, MemexItem, GroupItems, SliceInfo } from './memex-api.js'

/**
 * Merge multiple API responses (one per OR branch) into a single response.
 *
 * - Deduplicates items by `item.id` (first occurrence wins)
 * - Unions group metadata from all branches
 * - Assigns items to correct groups based on their field values
 * - Recalculates totalCount as the count of unique items
 * - Merges slice data from all branches
 */
export function mergeResponses(responses: GroupedItemsResponse[]): GroupedItemsResponse {
  if (responses.length === 0) {
    return {
      groups: { nodes: [], pageInfo: { endCursor: '', hasNextPage: false } },
      groupedItems: [],
      slices: [],
      totalCount: { value: 0, isApproximate: false },
    }
  }
  if (responses.length === 1) return responses[0]

  // 1. Collect all unique groups across branches (by groupId)
  const groupMap = new Map<string, GroupNode>()
  const groupOrder: string[] = []
  for (const resp of responses) {
    for (const group of resp.groups.nodes) {
      if (!groupMap.has(group.groupId)) {
        groupMap.set(group.groupId, { ...group, totalCount: { value: 0, isApproximate: false } })
        groupOrder.push(group.groupId)
      }
    }
  }

  // 2. Collect all unique items per group (deduplicate by id, first occurrence wins)
  const seenIds = new Set<number>()
  const itemsByGroup = new Map<string, MemexItem[]>()
  for (const gid of groupOrder) itemsByGroup.set(gid, [])

  for (const resp of responses) {
    for (const groupItems of resp.groupedItems) {
      const groupId = groupItems.groupId
      if (!itemsByGroup.has(groupId)) {
        itemsByGroup.set(groupId, [])
      }
      for (const item of groupItems.nodes) {
        if (seenIds.has(item.id)) continue
        seenIds.add(item.id)
        itemsByGroup.get(groupId)!.push(item)
      }
    }
  }

  // 3. Build merged groupedItems array and update group totalCounts
  const mergedGroupedItems: GroupItems[] = []
  let totalItems = 0

  for (const groupId of groupOrder) {
    const items = itemsByGroup.get(groupId) ?? []
    totalItems += items.length

    const groupNode = groupMap.get(groupId)!
    groupNode.totalCount = { value: items.length, isApproximate: false }

    mergedGroupedItems.push({
      groupId,
      nodes: items,
      pageInfo: { endCursor: '', hasNextPage: false },
    })
  }

  // 4. Merge slices (union by sliceId, deduplicate)
  const sliceMap = new Map<string, SliceInfo>()
  for (const resp of responses) {
    for (const slice of resp.slices ?? []) {
      if (!sliceMap.has(slice.sliceId)) {
        sliceMap.set(slice.sliceId, { ...slice })
      }
    }
  }

  return {
    groups: {
      nodes: groupOrder.map((gid) => groupMap.get(gid)!),
      pageInfo: { endCursor: '', hasNextPage: false },
    },
    groupedItems: mergedGroupedItems,
    slices: Array.from(sliceMap.values()),
    totalCount: { value: totalItems, isApproximate: false },
  }
}
