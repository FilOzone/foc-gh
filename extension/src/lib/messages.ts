import type { PageKind } from './github-url.js'

export type GraphqlMessage = {
  type: 'GRAPHQL'
  payload: {
    query: string
    variables?: Record<string, unknown>
  }
}

export type GetPanelStateMessage = {
  type: 'GET_PANEL_STATE'
  payload: {
    owner: string
    name: string
    number: number
    kind: PageKind
    /**
     * Authoritative membership state from a just-performed mutation (spec 008).
     * When set for the resolved board, the worker skips the REST membership
     * search (whose index lags mutations by minutes): itemId present = member
     * (field values fetched by node id), null = not a member.
     */
    membershipHint?: { projectId: string; itemId: string | null }
  }
}

export type AddToProjectMessage = {
  type: 'ADD_TO_PROJECT'
  payload: {
    projectId: string
    contentNodeId: string
  }
}

/** Projects gear → Global boards membership + add/remove (spec 006). */
export type GetGlobalBoardsStateMessage = {
  type: 'GET_GLOBAL_BOARDS_STATE'
  payload: {
    owner: string
    name: string
    number: number
    kind: PageKind
  }
}

export type DeleteProjectItemMessage = {
  type: 'DELETE_PROJECT_ITEM'
  payload: {
    projectId: string
    itemId: string
  }
}

/** Native picker data injection (spec 008): configured board metadata. */
export type GetNativePickerBoardsMessage = {
  type: 'GET_NATIVE_PICKER_BOARDS'
}

export type NativePickerBoard = {
  projectId: string
  /** Numeric memex id (legacy PR picker); null when resolution failed. */
  databaseId: number | null
  title: string
  number: number
  org: string
  url: string
  viewerCanUpdate: boolean
}

export type GetNativePickerBoardsResponse =
  | { ok: true; boards: NativePickerBoard[] }
  | { ok: false; error: string; code?: 'NO_TOKEN' }

export type GlobalBoardRowState = {
  url: string
  projectId: string
  itemId: string | null
  label: string
}

export type GetGlobalBoardsStateResponse =
  | { ok: true; contentNodeId: string; rows: GlobalBoardRowState[] }
  | { ok: false; error: string; code?: 'NO_TOKEN' }

export type UpdateStatusMessage = {
  type: 'UPDATE_STATUS'
  payload: {
    projectId: string
    itemId: string
    fieldId: string
    optionId: string
    fieldName: string
  }
}

export type ItemFieldValue =
  | { kind: 'clear' }
  | { kind: 'single_select'; optionId: string }
  | { kind: 'number'; number: number }
  | { kind: 'text'; text: string }
  | { kind: 'iteration'; iterationId: string }

export type UpdateItemFieldMessage = {
  type: 'UPDATE_ITEM_FIELD'
  payload: {
    projectId: string
    itemId: string
    fieldId: string
    fieldName: string
    value: ItemFieldValue
  }
}

export type StatusFieldMessage = {
  type: 'GET_STATUS_FIELD'
  payload: {
    projectId: string
    fieldName: string
  }
}

export type DebugDiagnosticsMessage = {
  type: 'DEBUG_DIAGNOSTICS'
}

export type DebugSampleBoardLinkMessage = {
  type: 'DEBUG_SAMPLE_BOARD_LINK'
  payload: {
    /** Full URL or path, e.g. https://github.com/o/r/issues/1 */
    url: string
  }
}

/** Start GitHub OAuth (PKCE) from the options page. */
export type GithubOauthStartMessage = {
  type: 'GITHUB_OAUTH_START'
}

/** Clear OAuth token and set auth to signed-out (see contracts/options-github-auth.md). */
export type GithubOauthDisconnectMessage = {
  type: 'GITHUB_OAUTH_DISCONNECT'
}

/** Read auth_method + whether a bearer is available (no raw token in response). */
export type GetAuthStatusMessage = {
  type: 'GET_AUTH_STATUS'
}

export type GetAuthStatusResponse = {
  ok: true
  authMethod: 'pat' | 'oauth' | 'none'
  hasToken: boolean
}

export type GithubOauthSimpleResponse = { ok: true } | { ok: false; error: string }

export type ExtensionMessage =
  | GraphqlMessage
  | GetPanelStateMessage
  | AddToProjectMessage
  | GetGlobalBoardsStateMessage
  | DeleteProjectItemMessage
  | GetNativePickerBoardsMessage
  | UpdateStatusMessage
  | UpdateItemFieldMessage
  | StatusFieldMessage
  | DebugDiagnosticsMessage
  | DebugSampleBoardLinkMessage
  | GithubOauthStartMessage
  | GithubOauthDisconnectMessage
  | GetAuthStatusMessage
