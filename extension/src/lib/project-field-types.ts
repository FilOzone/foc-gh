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
  if (dt === 'TITLE') return 'UNSUPPORTED'
  if (dt.includes('NUMBER')) return 'NUMBER'
  if (dt.includes('TEXT')) return 'TEXT'
  if (dt.includes('DATE')) return 'DATE'
  // When dataType is empty (omitted from query due to GitHub API bug),
  // system fields have already been filtered out by SYSTEM_FIELD_NAMES,
  // so remaining generic fields are custom — default to TEXT.
  if (!dt && field.kind === 'generic') return 'TEXT'
  return 'UNSUPPORTED'
}
