/**
 * Shared shapes for native picker data injection (spec 008).
 *
 * Endpoint payload shapes were captured live from github.com on 2026-08-19;
 * see specs/008-native-picker-data-injection/contracts/github-feeds.md.
 */

/** A configured global board, resolved to the metadata the injector needs. */
export type InjectedBoard = {
  /** GraphQL node id (PVT_...). */
  projectId: string
  /** Numeric memex id used by the legacy PR picker; null if unresolved. */
  databaseId: number | null
  title: string
  number: number
  /** Org login owning the board. */
  org: string
  url: string
  viewerCanUpdate: boolean
}

export type MembershipStatus = 'member' | 'not-member'

export type MembershipEntry = {
  projectId: string
  status: MembershipStatus
  /** Project item id (PVTI_...), required for removal; null when not a member. */
  itemId: string | null
}

/** detail payload of `filoz-np-config` (JSON string across worlds). */
export type NpConfigDetail = {
  page: { owner: string; name: string; number: number; kind: 'issue' | 'pull_request' } | null
  boards: InjectedBoard[]
}

/** detail payload of `filoz-np-membership`. */
export type NpMembershipDetail = {
  contentNodeId: string
  entries: MembershipEntry[]
}

/** detail payload of `filoz-np-native-mutation` (injector → content, informational). */
export type NpNativeMutationDetail = {
  projectId: string
  action: 'added' | 'removed'
  itemId: string | null
}

/** detail payload of `filoz-np-pr-toggle` (injector → content, delegated mutation). */
export type NpPrToggleDetail = {
  projectId: string
  desired: MembershipStatus
}

/** detail payload of `filoz-np-pr-toggle-result` (content → injector). */
export type NpPrToggleResultDetail = {
  projectId: string
  status: MembershipStatus
  itemId: string | null
  error?: string
}

/** Node shape in the `_ghui/item-pickers/projects` feed (all fields required). */
export type PickerFeedNode = {
  id: string
  title: string
  closed: boolean
  number: number
  url: string
  viewerCanUpdate: boolean
  hasReachedItemsLimit: boolean
  __typename: 'ProjectV2'
}

type PickerFeedEdges = { edges?: Array<{ node?: PickerFeedNode | null } | null> | null }

/** Relevant slice of the item-pickers feed response. */
export type ItemPickersProjectsResponse = {
  data?: {
    repository?: {
      projectsV2?: { nodes?: Array<PickerFeedNode | null> | null }
      recentProjects?: PickerFeedEdges
      owner?: {
        projectsV2?: PickerFeedEdges
        recentProjects?: PickerFeedEdges
      }
    }
  }
}

/** Row shape in the legacy PR `projects_suggestions` feed. */
export type SuggestionRow = {
  id: number
  name: string
  owner: string
  type: 'memex_project'
  template: false
  selected: boolean
  search_slug: string
}

export type ProjectsSuggestionsResponse = {
  projects?: SuggestionRow[]
}

export const NP_EVENTS = {
  config: 'filoz-np-config',
  membership: 'filoz-np-membership',
  requestMembership: 'filoz-np-request-membership',
  nativeMutation: 'filoz-np-native-mutation',
  prToggle: 'filoz-np-pr-toggle',
  prToggleResult: 'filoz-np-pr-toggle-result',
} as const

/** Cross-world event details are JSON strings; parse defensively. */
export function parseDetail<T>(detail: unknown): T | null {
  if (typeof detail !== 'string') return null
  try {
    return JSON.parse(detail) as T
  } catch {
    return null
  }
}

export function buildPickerFeedNode(board: InjectedBoard): PickerFeedNode {
  return {
    id: board.projectId,
    title: board.title,
    closed: false,
    number: board.number,
    url: board.url,
    viewerCanUpdate: board.viewerCanUpdate,
    hasReachedItemsLimit: false,
    __typename: 'ProjectV2',
  }
}
