/**
 * Helpers for Projects v2 field metadata aligned with specs/002 data-model.
 * Field value strings come from the service worker (`fieldLabels`).
 */
import type { SerializableProjectField } from './project-board-fields.js'
import { normalizeFieldType } from './project-field-types.js'

export type BoardFieldRow = {
  field: SerializableProjectField
  normalizedType: ReturnType<typeof normalizeFieldType>
  displayValue: string
}

export function boardFieldsWithValues(
  fields: SerializableProjectField[],
  fieldLabels: Record<string, string>,
): BoardFieldRow[] {
  const rows: BoardFieldRow[] = []
  for (const f of fields) {
    const displayValue = fieldLabels[f.name] ?? ''
    rows.push({
      field: f,
      normalizedType: normalizeFieldType(f),
      displayValue,
    })
  }
  return rows
}
