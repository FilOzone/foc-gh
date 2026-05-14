/**
 * Normalize GitHub `ProjectV2.fields` GraphQL for UI / diagnostics.
 * Schema union: ProjectV2Field | ProjectV2SingleSelectField | ProjectV2IterationField
 */

/**
 * Built-in ProjectV2 system field names (lowercased). These are excluded from
 * the parsed field list because:
 * 1. The sidebar never needs to render or edit them.
 * 2. Some (Created, Updated, Closed) crash GitHub's GraphQL API with a 500
 *    when `dataType` is requested — so we omit `dataType` from the query
 *    entirely and use this list to distinguish system fields from custom ones.
 *
 * GitHub support ticket: https://support.github.com/ticket/personal/0/4386180
 */
const SYSTEM_FIELD_NAMES = new Set([
  'title',
  'assignees',
  'labels',
  'linked pull requests',
  'milestone',
  'repository',
  'reviewers',
  'parent issue',
  'sub-issues progress',
  'created',
  'updated',
  'closed',
])

export type SerializableProjectField =
  | { kind: 'generic'; id: string; name: string; dataType: string }
  | {
      kind: 'single_select'
      id: string
      name: string
      dataType: string
      options: { id: string; name: string }[]
    }
  | {
      kind: 'iteration'
      id: string
      name: string
      dataType: string
      configurationDuration?: number
      configurationStartDay?: number
      iterations: { id: string; title: string; startDate: string; duration: number }[]
      completedIterations: { id: string; title: string; startDate: string; duration: number }[]
    }

const MAX_ITERATIONS_SHOWN = 25

function sliceIterations(
  arr: unknown,
): { id: string; title: string; startDate: string; duration: number }[] {
  if (!Array.isArray(arr)) return []
  return arr.slice(0, MAX_ITERATIONS_SHOWN).map((it) => {
    const x = it as Record<string, unknown>
    return {
      id: typeof x.id === 'string' ? x.id : '',
      title: typeof x.title === 'string' ? x.title : '',
      startDate: x.startDate != null ? String(x.startDate) : '',
      duration: typeof x.duration === 'number' && Number.isFinite(x.duration) ? x.duration : 0,
    }
  })
}

/** Parse `data.node` from `QUERY_PROJECT_V2_FIELD_DEFINITIONS` (ProjectV2 node). */
export function parseProjectV2FieldDefinitions(data: unknown): SerializableProjectField[] {
  const fields = (data as { node?: { fields?: { nodes?: unknown[] } } })?.node?.fields
  const nodes = fields?.nodes
  if (!Array.isArray(nodes)) return []

  const out: SerializableProjectField[] = []
  for (const raw of nodes) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const tn = r.__typename
    const id = typeof r.id === 'string' ? r.id : ''
    const name = typeof r.name === 'string' ? r.name : ''
    const dataType = typeof r.dataType === 'string' ? r.dataType : ''
    if (!id || !name) continue
    if (tn === 'ProjectV2Field' && SYSTEM_FIELD_NAMES.has(name.toLowerCase())) continue

    if (tn === 'ProjectV2SingleSelectField') {
      const optsRaw = r.options
      const options: { id: string; name: string }[] = []
      if (Array.isArray(optsRaw)) {
        for (const o of optsRaw) {
          if (!o || typeof o !== 'object') continue
          const oo = o as { id?: string; name?: string }
          if (typeof oo.id === 'string' && typeof oo.name === 'string') {
            options.push({ id: oo.id, name: oo.name })
          }
        }
      }
      out.push({ kind: 'single_select', id, name, dataType, options })
    } else if (tn === 'ProjectV2IterationField') {
      const conf = r.configuration as Record<string, unknown> | undefined
      const iterations = conf ? sliceIterations(conf.iterations) : []
      const completedIterations = conf ? sliceIterations(conf.completedIterations) : []
      const configurationDuration =
        conf && typeof conf.duration === 'number' && Number.isFinite(conf.duration) ?
          conf.duration
        : undefined
      const configurationStartDay =
        conf && typeof conf.startDay === 'number' && Number.isFinite(conf.startDay) ?
          conf.startDay
        : undefined
      out.push({
        kind: 'iteration',
        id,
        name,
        dataType,
        configurationDuration,
        configurationStartDay,
        iterations,
        completedIterations,
      })
    } else {
      out.push({ kind: 'generic', id, name, dataType })
    }
  }
  return out
}

export function findSingleSelectFieldByName(
  fields: SerializableProjectField[],
  fieldName: string,
): { kind: 'single_select'; id: string; name: string; dataType: string; options: { id: string; name: string }[] } | null {
  const want = fieldName.trim().toLowerCase()
  for (const f of fields) {
    if (f.kind !== 'single_select') continue
    if (f.name.trim().toLowerCase() === want) return f
  }
  return null
}

export function linesForBoardFieldDiagnostics(fields: SerializableProjectField[]): string[] {
  const lines: string[] = []
  lines.push(`Board columns discovered (${fields.length}):`)
  for (const f of fields) {
    if (f.kind === 'single_select') {
      const optNames = f.options.map((o) => o.name).join(', ')
      lines.push(`  • ${f.name} — ${f.dataType} (${f.options.length} option(s))${optNames ? `: ${optNames}` : ''}`)
    } else if (f.kind === 'iteration') {
      const activeTitles = f.iterations.map((i) => i.title).filter(Boolean)
      const shown =
        activeTitles.length > 0 ?
          activeTitles.slice(0, 12).join(', ') + (activeTitles.length > 12 ? '…' : '')
        : '(none in sample)'
      lines.push(
        `  • ${f.name} — ${f.dataType} (active: ${shown}; +${f.completedIterations.length} completed row(s) in sample)`,
      )
    } else {
      lines.push(`  • ${f.name} — ${f.dataType}`)
    }
  }
  return lines
}
