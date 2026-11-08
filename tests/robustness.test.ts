import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { findDuplicates } from '../src/core/dedupe'
import { toCsv, toXlsx } from '../src/core/export'
import { openWorkbook } from '../src/core/parse'
import type { Cell, Row } from '../src/core/types'

const bytes = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer
const csvDs = async (text: string) => {
  const wb = await openWorkbook({ name: 't.csv', data: bytes(text) })
  return wb.getDataset(wb.sheetNames[0])
}
const toBuf = (u: Uint8Array) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer

describe('CSV dialects', () => {
  it('semicolon-delimited', async () => {
    const ds = await csvDs('a;b;c\n1;2;3\n')
    expect(ds.headers).toEqual(['a', 'b', 'c'])
  })
  it('tab-delimited', async () => {
    const ds = await csvDs('a\tb\n1\t2\n')
    expect(ds.headers).toEqual(['a', 'b'])
  })
  it('quoted embedded newlines', async () => {
    const ds = await csvDs('a,b\n"line1\nline2",x\n')
    expect(ds.rows).toHaveLength(1)
    expect(ds.rows[0].cells[0]).toBe('line1\nline2')
  })
  it('windows-1252 bytes decode correctly', async () => {
    const wb = await openWorkbook({ name: 't.csv', data: new Uint8Array([0x6e, 0x0a, 0x63, 0x61, 0x66, 0xe9]).buffer })
    expect(wb.getDataset(wb.sheetNames[0]).rows[0].cells[0]).toBe('café')
  })
  it('does not coerce numeric-looking text', async () => {
    const ds = await csvDs('v\n0012\n1e3\n-0\n2024-01-05\n')
    expect(ds.rows.map((r) => r.cells[0])).toEqual(['0012', '1e3', '-0', '2024-01-05'])
  })
  it('mid-file blank rows are preserved as rows', async () => {
    const ds = await csvDs('a,b\n1,2\n,\n3,4\n')
    expect(ds.rows).toHaveLength(3)
  })
})

describe('legacy and binary formats', () => {
  it('reads .xls (BIFF8)', async () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['k', 'v'], ['a', 1], ['a', 2]]), 'S')
    const data = XLSX.write(wb, { type: 'array', bookType: 'biff8' }) as ArrayBuffer
    const o = await openWorkbook({ name: 'old.xls', data })
    const ds = o.getDataset('S')
    expect(ds.rows.map((r) => r.cells)).toEqual([['a', 1], ['a', 2]])
  })
  it('rejects garbage xls with a clear error instead of crashing', async () => {
    const r = await openWorkbook({ name: 'bad.xls', data: bytes('this is not a spreadsheet at all') }).then(
      (o) => o.getDataset(o.sheetNames[0]),
      (e) => e,
    )
    // Either a CleanSheetError at open or a parsed (text) result is acceptable; an unhandled TypeError is not.
    if (r instanceof Error) expect(r.name).toBe('CleanSheetError')
  })
  it('truncated xlsx fails with CleanSheetError', async () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['a'], [1]]), 'S')
    const full = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
    const cut = full.slice(0, Math.floor(full.length / 2)).buffer
    await expect(openWorkbook({ name: 'cut.xlsx', data: cut })).rejects.toMatchObject({ name: 'CleanSheetError' })
  })
})

describe('dates and timezones', () => {
  it('xlsx date round-trips without shifting the calendar day', async () => {
    const d = new Date(Date.UTC(2024, 2, 15))
    const out = await toXlsx(['d'], [{ id: 0, cells: [d] }])
    const o = await openWorkbook({ name: 'x.xlsx', data: toBuf(out) })
    const back = o.getDataset(o.sheetNames[0]).rows[0].cells[0] as Date
    expect(back.toISOString().slice(0, 10)).toBe('2024-03-15')
  })
  it('date written by Excel-style serial reads as the same day', async () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([['d'], [new Date(Date.UTC(2023, 11, 31))]], { cellDates: true })
    XLSX.utils.book_append_sheet(wb, ws, 'S')
    const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellDates: true }) as ArrayBuffer
    const o = await openWorkbook({ name: 'x.xlsx', data })
    const v = o.getDataset('S').rows[0].cells[0] as Date
    expect(v.toISOString().slice(0, 10)).toBe('2023-12-31')
  })
})

describe('export edge cases', () => {
  it('CSV: leading/trailing spaces and empty strings are preserved/quoted', () => {
    expect(toCsv(['a'], [{ id: 0, cells: [' x '] }], false)).toBe('a\r\n" x "\r\n')
  })
  it('XLSX: over-long cell gives a clear error naming the row (never truncates)', async () => {
    const long = 'x'.repeat(40000)
    await expect(toXlsx(['a'], [{ id: 6, cells: [long] }])).rejects.toMatchObject({
      code: 'EXPORT_LIMIT',
      message: expect.stringContaining('Row 8'),
    })
  })
  it('XLSX: a cell of exactly 32767 chars is accepted', async () => {
    const out = await toXlsx(['a'], [{ id: 0, cells: ['x'.repeat(32767)] }])
    expect(out.byteLength).toBeGreaterThan(0)
  })
  it('XLSX: formula-looking text is stored as a string, not a formula', async () => {
    const out = await toXlsx(['a'], [{ id: 0, cells: ['=1+1'] }])
    const wb = XLSX.read(out, { type: 'array' })
    const cell = wb.Sheets[wb.SheetNames[0]]['A2']
    expect(cell.t).toBe('s')
    expect(cell.f).toBeUndefined()
  })
  it('XLSX: odd sheet names are sanitized', async () => {
    const out = await toXlsx(['a'], [], 'a/b:c*?[x]'.repeat(5))
    const wb = XLSX.read(out, { type: 'array' })
    expect(wb.SheetNames[0].length).toBeLessThanOrEqual(31)
  })
})

describe('CSV formula injection', () => {
  const cells = (...c: Cell[]): Row[] => [{ id: 0, cells: c }]
  it.each(['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx', '\rx'])('neutralises %j', (v) => {
    const line = toCsv(['a'], cells(v), false).split('\r\n')[1]
    expect(line.replace(/^"/, '')).toMatch(/^'/)
  })
  it('does not alter real numbers, numeric text or ordinary text', () => {
    expect(toCsv(['a', 'b', 'c', 'd'], cells(-5, '-5', 'hello', '1-2'), false)).toBe('a,b,c,d\r\n-5,-5,hello,1-2\r\n')
  })
  it('reports how many cells were neutralised', async () => {
    const { toCsvWithReport } = await import('../src/core/export')
    const r = toCsvWithReport(['a'], [...cells('=1'), { id: 1, cells: ['ok'] }, { id: 2, cells: ['@x'] }], false)
    expect(r.neutralised).toBe(2)
  })
  it('header cells are neutralised too', () => {
    expect(toCsv(['=evil'], [], false).startsWith("'=evil")).toBe(true)
  })
})

describe('performance at scale', () => {
  it('dedupes 200k rows x 3-column key in well under a few seconds', () => {
    const rows: Row[] = Array.from({ length: 200_000 }, (_, id) => ({
      id,
      cells: [`user${id % 50_000}`, `City${id % 7}`, id],
    }))
    const t = performance.now()
    const r = findDuplicates(rows, { columns: [0, 1], caseSensitive: false, trim: true, blankMode: 'skip-all', keep: 'last' })
    const ms = performance.now() - t
    expect(r.stats.uniqueRows + r.stats.duplicateRows).toBe(200_000)
    expect(r.removeIds.size).toBe(r.stats.duplicateRows)
    expect(ms).toBeLessThan(5000)
  })
  it('parses and exports a 100k-row CSV round trip', async () => {
    const lines = ['id,name,note']
    for (let i = 0; i < 100_000; i++) lines.push(`${i},name${i % 1000},"n, ${i}"`)
    const o = await openWorkbook({ name: 'big.csv', data: bytes(lines.join('\n')) })
    const ds = o.getDataset(o.sheetNames[0])
    expect(ds.rows).toHaveLength(100_000)
    expect(ds.rows[99_999].id).toBe(99_999)
    const back = toCsv(ds.headers, ds.rows, false)
    expect(back.split('\r\n')).toHaveLength(100_002)
  })
})
