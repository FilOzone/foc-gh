/**
 * Normalized field kinds for Projects v2 UI (see specs/002 data-model).
 */
import type { SerializableProjectField } from './project-board-fields.js'

export type NormalizedFieldType =
  | 'SINGLE_SELECT'
  | 'ITERATION'
  | 'TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'UNSUPPORTED'

export function normalizeFieldType(field: SerializableProjectField): NormalizedFieldType {
  if (field.kind === 'single_select') return 'SINGLE_SELECT'
  if (field.kind === 'iteration') return 'ITERATION'
  const dt = field.dataType.trim().toUpperCase()
  if (dt === 'NUMBER') return 'NUMBER'
  if (dt === 'TEXT') return 'TEXT'
  if (dt === 'DATE') return 'DATE'
  return 'UNSUPPORTED'
}
