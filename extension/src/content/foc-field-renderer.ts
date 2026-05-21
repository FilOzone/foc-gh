/**
 * Native-like Projects v2 field editors with autosave (no per-field Save button).
 * Renders only editable custom fields; UNSUPPORTED (system) fields are skipped entirely.
 * Status is rendered separately in the card header — pass statusFieldName to exclude it here.
 */
import { debounced } from '../lib/autosave.js'
import type { SerializableProjectField } from '../lib/project-board-fields.js'
import { boardFieldsWithValues } from '../lib/project-v2-fields.js'
import { updateProjectItemField } from '../lib/project-item-mutations.js'

export type FieldRenderOpts = {
  projectId: string
  itemId: string
  boardFields: SerializableProjectField[]
  fieldLabels: Record<string, string>
  /** Name of the Status field — excluded from body (rendered in card header). */
  statusFieldName: string
  stale: () => boolean
  onReload: () => void | Promise<void>
}

function setRowError(row: HTMLElement, msg: string | null): void {
  let err = row.querySelector('.filoz-field-err') as HTMLParagraphElement | null
  if (!msg) {
    err?.remove()
    return
  }
  if (!err) {
    err = document.createElement('p')
    err.className = 'filoz-field-err filoz-error'
    row.append(err)
  }
  err.textContent = msg
}

export function renderEditableProjectFields(mount: HTMLElement, opts: FieldRenderOpts): void {
  mount.innerHTML = ''
  const { projectId, itemId, boardFields, fieldLabels, statusFieldName, stale, onReload } = opts

  const statusKey = statusFieldName.trim().toLowerCase()
  const rows = boardFieldsWithValues(boardFields, fieldLabels).filter(
    ({ field, normalizedType }) =>
      normalizedType !== 'UNSUPPORTED' &&
      field.name.trim().toLowerCase() !== statusKey,
  )

  for (const { field, normalizedType, displayValue } of rows) {
    const wrap = document.createElement('div')
    wrap.className = 'filoz-field-row'

    const label = document.createElement('div')
    label.className = 'filoz-field-label'
    label.textContent = field.name

    const controlWrap = document.createElement('div')
    controlWrap.className = 'filoz-field-control'

    if (normalizedType === 'SINGLE_SELECT' && field.kind === 'single_select') {
      const sel = document.createElement('select')
      sel.className = 'filoz-select'
      sel.setAttribute('aria-label', field.name)
      const empty = document.createElement('option')
      empty.value = ''
      empty.textContent = 'Choose an option'
      sel.append(empty)
      for (const o of field.options) {
        const opt = document.createElement('option')
        opt.value = o.id
        opt.textContent = o.name
        if (o.name === displayValue || o.id === displayValue) opt.selected = true
        sel.append(opt)
      }
      sel.addEventListener('change', async () => {
        if (stale()) return
        setRowError(wrap, null)
        const optionId = sel.value
        const res = await updateProjectItemField({
          projectId,
          itemId,
          fieldId: field.id,
          fieldName: field.name,
          value: optionId ? { kind: 'single_select', optionId } : { kind: 'clear' },
        })
        if (!res.ok) {
          setRowError(wrap, res.error ?? 'Update failed')
          return
        }
        await onReload()
      })
      controlWrap.append(sel)
    } else if (normalizedType === 'NUMBER' && field.kind === 'generic') {
      const input = document.createElement('input')
      input.type = 'number'
      input.className = 'filoz-input'
      input.placeholder = 'Enter number…'
      input.setAttribute('aria-label', field.name)
      input.value =
        displayValue && !Number.isNaN(Number(displayValue)) ? String(Number(displayValue)) : ''
      const runSave = async (): Promise<void> => {
        if (stale()) return
        setRowError(wrap, null)
        const raw = input.value.trim()
        if (raw === '') {
          const res = await updateProjectItemField({
            projectId,
            itemId,
            fieldId: field.id,
            fieldName: field.name,
            value: { kind: 'clear' },
          })
          if (!res.ok) setRowError(wrap, res.error ?? 'Clear failed')
          return
        }
        const num = Number(raw)
        if (!Number.isFinite(num)) {
          setRowError(wrap, 'Enter a valid number')
          return
        }
        const res = await updateProjectItemField({
          projectId,
          itemId,
          fieldId: field.id,
          fieldName: field.name,
          value: { kind: 'number', number: num },
        })
        if (!res.ok) {
          setRowError(wrap, res.error ?? 'Update failed')
          return
        }
        await onReload()
      }
      const d = debounced(runSave, 320)
      input.addEventListener('input', () => d.schedule())
      input.addEventListener('blur', () => d.flush())
      controlWrap.append(input)
    } else if (normalizedType === 'TEXT' && field.kind === 'generic') {
      const input = document.createElement('input')
      input.type = 'text'
      input.className = 'filoz-input'
      input.placeholder = 'Enter text…'
      input.setAttribute('aria-label', field.name)
      input.value = displayValue
      const runSaveText = async (): Promise<void> => {
        if (stale()) return
        setRowError(wrap, null)
        const res = await updateProjectItemField({
          projectId,
          itemId,
          fieldId: field.id,
          fieldName: field.name,
          value: { kind: 'text', text: input.value },
        })
        if (!res.ok) {
          setRowError(wrap, res.error ?? 'Update failed')
          return
        }
        await onReload()
      }
      const dText = debounced(runSaveText, 320)
      input.addEventListener('input', () => dText.schedule())
      input.addEventListener('blur', () => dText.flush())
      controlWrap.append(input)
    } else if (normalizedType === 'ITERATION' && field.kind === 'iteration') {
      const sel = document.createElement('select')
      sel.className = 'filoz-select'
      sel.setAttribute('aria-label', field.name)
      const empty = document.createElement('option')
      empty.value = ''
      empty.textContent = 'Choose an iteration'
      sel.append(empty)
      for (const it of field.iterations) {
        const opt = document.createElement('option')
        opt.value = it.id
        opt.textContent = it.title || it.id
        if (displayValue && (it.title === displayValue || displayValue.includes(it.title))) {
          opt.selected = true
        }
        sel.append(opt)
      }
      for (const it of field.completedIterations) {
        const opt = document.createElement('option')
        opt.value = it.id
        opt.textContent = `Completed · ${it.title || it.id}`
        sel.append(opt)
      }
      sel.addEventListener('change', async () => {
        if (stale()) return
        setRowError(wrap, null)
        const iterationId = sel.value
        const res = await updateProjectItemField({
          projectId,
          itemId,
          fieldId: field.id,
          fieldName: field.name,
          value: iterationId ? { kind: 'iteration', iterationId } : { kind: 'clear' },
        })
        if (!res.ok) {
          setRowError(wrap, res.error ?? 'Update failed')
          return
        }
        await onReload()
      })
      controlWrap.append(sel)
    }

    wrap.append(label, controlWrap)
    mount.append(wrap)
  }
}
