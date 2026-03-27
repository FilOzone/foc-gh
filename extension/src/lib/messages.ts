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

export type ExtensionMessage =
  | GraphqlMessage
  | GetPanelStateMessage
  | AddToProjectMessage
  | UpdateStatusMessage
  | StatusFieldMessage
  | DebugDiagnosticsMessage
