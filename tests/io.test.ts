import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { openWorkbook, makeHeaders, LIMITS } from '../src/core/parse'
import { toCsv, toXlsx, cleanedFileName } from '../src/core/export'
import { CleanSheetError } from '../src/core/types'

const enc = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer
const csv = (name: string, text: string) => ({ name, data: enc(text) })

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof CleanSheetError && e.code === code)
}

describe('parsing', () => {
  it('parses CSV keeping text exactly (leading zeros, quotes, commas)', async () => {
    const wb = await openWorkbook(csv('a.csv', 'id,name\n007,"Smith, J"\n1E5,"say ""hi"""\n'))
    const ds = wb.getDataset(wb.sheetNames[0])
    expect(ds.headers).toEqual(['id', 'name'])
    expect(ds.rows.map((r) => r.cells)).toEqual([
      ['007', 'Smith, J'],
      ['1E5', 'say "hi"'],
    ])
    expect(ds.rows.map((r) => r.id)).toEqual([0, 1])
  })

  it('handles a UTF-8 BOM and CRLF', async () => {
    const wb = await openWorkbook(csv('a.csv', '﻿a,b\r\n1,2\r\n'))
    expect(wb.getDataset(wb.sheetNames[0]).headers).toEqual(['a', 'b'])
  })

  it('renames duplicate and blank headers, with a warning', async () => {
    const wb = await openWorkbook(csv('a.csv', 'name,Name,,name\n1,2,3,4\n'))
    const ds = wb.getDataset(wb.sheetNames[0])
    expect(ds.headers).toEqual(['name', 'Name (2)', 'Column 3', 'name (3)'])
    expect(ds.warnings.join(' ')).toMatch(/Duplicate column names/)
  })

  it('keeps ragged rows without losing cells', async () => {
    const wb = await openWorkbook(csv('a.csv', 'a,b\n1,2,3\n4\n'))
    const ds = wb.getDataset(wb.sheetNames[0])
    expect(ds.headers).toEqual(['a', 'b', 'Column 3'])
    expect(ds.rows[0].cells).toEqual(['1', '2', '3'])
    expect(ds.rows[1].cells).toEqual(['4', null, null])
    expect(ds.warnings.join(' ')).toMatch(/more cells/)
  })

  it('returns a header-only file as zero rows', async () => {
    const wb = await openWorkbook(csv('a.csv', 'a,b\n'))
    expect(wb.getDataset(wb.sheetNames[0]).rows).toHaveLength(0)
  })

  it('reads multi-sheet xlsx with native types', async () => {
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['n', 'ok'], [1.5, true]]), 'One')
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['x'], ['y']]), 'Two')
    const buf = XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const wb = await openWorkbook({ name: 'b.xlsx', data: buf })
    expect(wb.sheetNames).toEqual(['One', 'Two'])
    expect(wb.getDataset('One').rows[0].cells).toEqual([1.5, true])
    expect(wb.getDataset('Two').rows[0].cells).toEqual(['y'])
  })
})

describe('errors', () => {
  it('rejects empty files', async () => {
    await expectCode(openWorkbook({ name: 'a.csv', data: new ArrayBuffer(0) }), 'EMPTY_FILE')
  })
  it('rejects unsupported extensions', async () => {
    await expectCode(openWorkbook(csv('a.txt', 'x')), 'UNSUPPORTED_TYPE')
  })
  it('rejects a fake xlsx', async () => {
    await expectCode(openWorkbook(csv('a.xlsx', 'definitely not a zip')), 'MALFORMED')
  })
  it('rejects files over the size limit', async () => {
    await expectCode(
      openWorkbook({ name: 'a.csv', data: new ArrayBuffer(LIMITS.maxFileBytes + 1) }),
      'TOO_LARGE',
    )
  })
  it('reports a sheet with only blank cells as empty', async () => {
    const wb = await openWorkbook(csv('a.csv', '\n\n'))
    expect(() => wb.getDataset(wb.sheetNames[0])).toThrow(/no data/)
  })
})

describe('headers', () => {
  it('makeHeaders is case-insensitive about collisions and always unique', () => {
    const h = makeHeaders(['A', 'a', 'a (2)', 'a'], 4)
    expect(new Set(h.map((x) => x.toLowerCase())).size).toBe(4)
  })
})

describe('export', () => {
  const headers = ['id', 'note', 'when']
  const rows = [
    { id: 0, cells: [1, 'He said "hi", ok', new Date(Date.UTC(2024, 1, 3))] },
    { id: 5, cells: ['007', null, true] },
  ]

  it('writes RFC 4180 CSV preserving column order, quoting and ISO dates', () => {
    const out = toCsv(headers, rows, false)
    expect(out).toBe('id,note,when\r\n1,"He said ""hi"", ok",2024-02-03\r\n007,,true\r\n')
  })

  it('adds a BOM by default for Excel', () => {
    expect(toCsv(headers, rows).charCodeAt(0)).toBe(0xfeff)
  })

  it('CSV round-trips through the parser', async () => {
    const wb = await openWorkbook(csv('x.csv', toCsv(headers, rows)))
    const ds = wb.getDataset(wb.sheetNames[0])
    expect(ds.headers).toEqual(headers)
    expect(ds.rows[0].cells[1]).toBe('He said "hi", ok')
    expect(ds.rows[1].cells[0]).toBe('007')
  })

  it('XLSX export keeps types and order', async () => {
    const bytes = await toXlsx(headers, rows)
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    const wb = await openWorkbook({ name: 'x.xlsx', data: buf })
    const ds = wb.getDataset(wb.sheetNames[0])
    expect(ds.headers).toEqual(headers)
    expect(ds.rows[0].cells[0]).toBe(1)
    expect(ds.rows[0].cells[2]).toBeInstanceOf(Date)
    expect(ds.rows[1].cells).toEqual(['007', null, true])
  })

  it('names cleaned files', () => {
    expect(cleanedFileName('data.v2.xlsx', 'csv')).toBe('data.v2.cleaned.csv')
  })
})
