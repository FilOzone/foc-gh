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
    itemId: string
  }
}

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

/** Resolve primary board URL from storage and return parsed column definitions. */
export type GetPrimaryBoardFieldDefinitionsMessage = {
  type: 'GET_PRIMARY_BOARD_FIELD_DEFINITIONS'
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
  | UpdateStatusMessage
  | UpdateItemFieldMessage
  | StatusFieldMessage
  | GetPrimaryBoardFieldDefinitionsMessage
  | DebugDiagnosticsMessage
  | DebugSampleBoardLinkMessage
  | GithubOauthStartMessage
  | GithubOauthDisconnectMessage
  | GetAuthStatusMessage
