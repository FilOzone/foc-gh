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

export type ExtensionMessage =
  | GraphqlMessage
  | GetPanelStateMessage
  | AddToProjectMessage
  | UpdateStatusMessage
  | UpdateItemFieldMessage
  | StatusFieldMessage
  | GetPrimaryBoardFieldDefinitionsMessage
  | DebugDiagnosticsMessage
  | DebugSampleBoardLinkMessage
