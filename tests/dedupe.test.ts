import { describe, expect, it } from 'vitest'
import { findDuplicates, removeRows, type DedupeOptions } from '../src/core/dedupe'
import type { Cell, Row } from '../src/core/types'

const mk = (data: Cell[][]): Row[] => data.map((cells, id) => ({ id, cells }))

const base: DedupeOptions = {
  columns: [0],
  caseSensitive: true,
  trim: false,
  blankMode: 'match',
  keep: 'first',
}
const opts = (o: Partial<DedupeOptions> = {}): DedupeOptions => ({ ...base, ...o })

describe('duplicate detection', () => {
  const rows = mk([['a', 1], ['b', 2], ['a', 3], ['c', 4], ['a', 5], ['b', 6]])

  it('finds groups, stats and row ids', () => {
    const r = findDuplicates(rows, opts())
    expect(r.stats).toMatchObject({ totalRows: 6, uniqueRows: 3, duplicateRows: 3, duplicateGroups: 2 })
    expect(r.groups.map((g) => g.rowIds)).toEqual([[0, 2, 4], [1, 5]])
    expect(r.groupOf.get(3)).toBeUndefined() // "c" is unique
  })

  it('reports nothing when there are no duplicates', () => {
    const r = findDuplicates(mk([['a'], ['b']]), opts())
    expect(r.groups).toHaveLength(0)
    expect(r.stats.duplicateRows).toBe(0)
    expect(r.stats.uniqueRows).toBe(2)
  })

  it('returns an empty result with no key columns and for empty input', () => {
    expect(findDuplicates(rows, opts({ columns: [] })).stats.duplicateRows).toBe(0)
    expect(findDuplicates([], opts()).stats.totalRows).toBe(0)
  })

  it('does not mutate its input', () => {
    const copy = JSON.stringify(rows)
    findDuplicates(rows, opts())
    expect(JSON.stringify(rows)).toBe(copy)
  })

  it('uses stable ids, so identical-looking rows stay distinct', () => {
    const r = findDuplicates(mk([['x'], ['x']]), opts())
    expect(r.groups[0].rowIds).toEqual([0, 1])
    expect(r.groups[0].keepId).toBe(0)
    expect([...r.removeIds]).toEqual([1])
  })

  it('keeps ids stable after a previous removal', () => {
    const first = removeRows(rows, new Set([0]))
    const r = findDuplicates(first, opts())
    expect(r.groups.map((g) => g.rowIds)).toEqual([[1, 5], [2, 4]]) // original ids, not re-numbered
  })
})

describe('composite keys', () => {
  const rows = mk([
    ['Ann', 'NY', 1],
    ['Ann', 'LA', 2],
    ['Ann', 'NY', 3],
    ['Bob', 'NY', 4],
  ])

  it('requires all selected columns to match', () => {
    const r = findDuplicates(rows, opts({ columns: [0, 1] }))
    expect(r.groups).toHaveLength(1)
    expect(r.groups[0].rowIds).toEqual([0, 2])
  })

  it('single column matches more broadly than composite', () => {
    expect(findDuplicates(rows, opts({ columns: [0] })).stats.duplicateRows).toBe(2)
  })

  it('does not confuse delimiter-like content across columns', () => {
    const r = findDuplicates(mk([['a|b', 'c'], ['a', 'b|c']]), opts({ columns: [0, 1] }))
    expect(r.groups).toHaveLength(0)
  })

  it('column order in the selection does not matter for matching', () => {
    const r = findDuplicates(rows, opts({ columns: [1, 0] }))
    expect(r.groups[0].rowIds).toEqual([0, 2])
  })
})

describe('case and whitespace handling', () => {
  const rows = mk([['Alice'], ['alice'], ['ALICE '], [' alice']])

  it('is case-sensitive by default', () => {
    expect(findDuplicates(rows, opts()).groups).toHaveLength(0)
  })

  it('case-insensitive merges differing case only', () => {
    const r = findDuplicates(rows, opts({ caseSensitive: false }))
    expect(r.groups[0].rowIds).toEqual([0, 1])
  })

  it('trim merges whitespace variants', () => {
    const r = findDuplicates(rows, opts({ caseSensitive: false, trim: true }))
    expect(r.groups[0].rowIds).toEqual([0, 1, 2, 3])
  })

  it('numbers and dates compare by displayed value', () => {
    const d = new Date(Date.UTC(2024, 0, 5))
    const r = findDuplicates(mk([[1], ['1'], [d], ['2024-01-05']]), opts())
    expect(r.groups.map((g) => g.rowIds)).toEqual([[0, 1], [2, 3]])
  })
})

describe('empty values', () => {
  const rows = mk([['', 'x'], [null, 'y'], ['  ', 'x'], ['a', null], ['a', null]])

  it("'match' treats blanks as equal (null and empty string)", () => {
    const r = findDuplicates(rows, opts({ blankMode: 'match' }))
    expect(r.groups.map((g) => g.rowIds)).toEqual([[0, 1], [3, 4]])
  })

  it("'match' + trim treats whitespace-only as blank", () => {
    const r = findDuplicates(rows, opts({ blankMode: 'match', trim: true }))
    expect(r.groups[0].rowIds).toEqual([0, 1, 2])
  })

  it("'skip-all' never groups rows with all-blank keys", () => {
    const r = findDuplicates(rows, opts({ blankMode: 'skip-all' }))
    expect(r.groups.map((g) => g.rowIds)).toEqual([[3, 4]])
    expect(r.stats.skippedBlankRows).toBe(2)
  })

  it("'skip-all' on a composite key only exempts rows where every key column is blank", () => {
    const r = findDuplicates(rows, opts({ columns: [0, 1], blankMode: 'skip-all' }))
    expect(r.groups.map((g) => g.rowIds)).toEqual([[3, 4]]) // ['a', null] twice
    expect(r.stats.skippedBlankRows).toBe(0)
  })

  it("'skip-any' exempts rows with any blank key column", () => {
    const r = findDuplicates(rows, opts({ columns: [0, 1], blankMode: 'skip-any' }))
    expect(r.groups).toHaveLength(0)
    expect(r.stats.skippedBlankRows).toBe(4) // '  ' is not blank unless trim is on
    expect(r.stats.duplicateRows).toBe(0)
    const trimmed = findDuplicates(rows, opts({ columns: [0, 1], blankMode: 'skip-any', trim: true }))
    expect(trimmed.stats.skippedBlankRows).toBe(5)
  })

  it('skipped rows are never removed', () => {
    const r = findDuplicates(mk([[''], [''], ['']]), opts({ blankMode: 'skip-all' }))
    expect(removeRows(mk([[''], [''], ['']]), r.removeIds)).toHaveLength(3)
  })
})

describe('keep first / keep last', () => {
  const rows = mk([['a', 'old'], ['b', 'only'], ['a', 'mid'], ['a', 'new']])

  it('keep first retains the earliest occurrence', () => {
    const r = findDuplicates(rows, opts({ keep: 'first' }))
    expect(r.groups[0].keepId).toBe(0)
    expect([...r.removeIds].sort()).toEqual([2, 3])
    expect(removeRows(rows, r.removeIds).map((x) => x.cells[1])).toEqual(['old', 'only'])
  })

  it('keep last retains the latest occurrence and preserves row order', () => {
    const r = findDuplicates(rows, opts({ keep: 'last' }))
    expect(r.groups[0].keepId).toBe(3)
    expect([...r.removeIds].sort()).toEqual([0, 2])
    expect(removeRows(rows, r.removeIds).map((x) => x.cells[1])).toEqual(['only', 'new'])
  })

  it('exactly one row per group survives, and removed + kept = total', () => {
    for (const keep of ['first', 'last'] as const) {
      const r = findDuplicates(rows, opts({ keep }))
      expect(removeRows(rows, r.removeIds)).toHaveLength(r.stats.uniqueRows)
      expect(r.stats.uniqueRows + r.stats.duplicateRows).toBe(rows.length)
    }
  })

  it('removeRows does not mutate the original array (undo support)', () => {
    const before = rows.length
    removeRows(rows, new Set([0]))
    expect(rows).toHaveLength(before)
  })
})
