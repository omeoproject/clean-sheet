import { formatCell, type Cell, type Row } from './types'

/**
 * How blank key values are treated:
 *  - 'match'      blanks are an ordinary value; two blank keys ARE duplicates.
 *  - 'skip-all'   rows whose key columns are ALL blank are never duplicates.
 *  - 'skip-any'   rows with ANY blank key column are never duplicates.
 */
export type BlankMode = 'match' | 'skip-all' | 'skip-any'
export type KeepMode = 'first' | 'last'

export interface DedupeOptions {
  /** Column indexes forming the composite key. */
  columns: number[]
  caseSensitive: boolean
  trim: boolean
  blankMode: BlankMode
  keep: KeepMode
}

export interface DuplicateGroup {
  /** 1-based group number, in order of first appearance. */
  number: number
  /** Key values of the kept row, as displayed (before normalisation). */
  keyDisplay: string[]
  /** Stable row ids in the group, in sheet order. */
  rowIds: number[]
  keepId: number
  removeIds: number[]
}

export interface DedupeStats {
  totalRows: number
  uniqueRows: number
  duplicateRows: number
  duplicateGroups: number
  /** Rows exempted from matching by the blank-value setting. */
  skippedBlankRows: number
}

export interface DedupeResult {
  groups: DuplicateGroup[]
  /** rowId -> group number, for every row that belongs to a duplicate group. */
  groupOf: Map<number, number>
  /** Ids that would be deleted. */
  removeIds: Set<number>
  stats: DedupeStats
}

export function normalizeValue(v: Cell | undefined, o: Pick<DedupeOptions, 'caseSensitive' | 'trim'>): string {
  let s = formatCell(v)
  if (o.trim) s = s.trim()
  if (!o.caseSensitive) s = s.toLowerCase()
  return s
}

/** Pure function: never mutates `rows`. Row identity is `row.id`, not cell text. */
export function findDuplicates(rows: readonly Row[], options: DedupeOptions): DedupeResult {
  const { columns, blankMode, keep } = options
  const stats: DedupeStats = {
    totalRows: rows.length,
    uniqueRows: rows.length,
    duplicateRows: 0,
    duplicateGroups: 0,
    skippedBlankRows: 0,
  }
  if (columns.length === 0) return { groups: [], groupOf: new Map(), removeIds: new Set(), stats }

  const buckets = new Map<string, Row[]>()
  for (const row of rows) {
    const parts = columns.map((c) => normalizeValue(row.cells[c], options))
    const blanks = parts.filter((p) => p === '').length
    const exempt =
      (blankMode === 'skip-all' && blanks === parts.length) || (blankMode === 'skip-any' && blanks > 0)
    if (exempt) {
      stats.skippedBlankRows++
      continue
    }
    // JSON encoding keeps multi-column keys unambiguous ("a|b","c" vs "a","b|c").
    const key = parts.length === 1 ? parts[0] : JSON.stringify(parts)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(row)
    else buckets.set(key, [row])
  }

  const groups: DuplicateGroup[] = []
  const groupOf = new Map<number, number>()
  const removeIds = new Set<number>()
  // Map preserves insertion order = order of first appearance.
  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue
    const number = groups.length + 1
    const keeper = keep === 'first' ? bucket[0] : bucket[bucket.length - 1]
    const rowIds = bucket.map((r) => r.id)
    const removed = rowIds.filter((id) => id !== keeper.id)
    for (const id of rowIds) groupOf.set(id, number)
    for (const id of removed) removeIds.add(id)
    groups.push({
      number,
      keyDisplay: columns.map((c) => formatCell(keeper.cells[c])),
      rowIds,
      keepId: keeper.id,
      removeIds: removed,
    })
  }

  stats.duplicateRows = removeIds.size
  stats.uniqueRows = rows.length - removeIds.size
  stats.duplicateGroups = groups.length
  return { groups, groupOf, removeIds, stats }
}

/** Returns a NEW array without the given ids; the input is untouched (enables undo). */
export function removeRows(rows: readonly Row[], removeIds: ReadonlySet<number>): Row[] {
  return rows.filter((r) => !removeIds.has(r.id))
}
