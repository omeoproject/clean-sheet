import { CleanSheetError, formatCell, type Cell, type Row } from './types'

export type ExportFormat = 'csv' | 'xlsx'

export const FORMAT_WARNING =
  'Exports contain cell values only. Formatting (colors, fonts, widths), formulas, merged cells, charts and other sheets are not preserved. Formulas are saved as their last calculated values.'

/** Text that Excel/Sheets/LibreOffice could interpret as a formula when a CSV is opened. */
function isFormulaRisk(s: string): boolean {
  if (!s) return false
  const c = s[0]
  if (c === '\t' || c === '\r' || c === '=' || c === '@') return true
  if (c === '+' || c === '-') return !/^[+-]\d[\d.,]*$/.test(s) // plain signed numbers / phone-style +1555… are safe
  return false
}

/**
 * CSV formula-injection defence (OWASP): text cells that start with = + - @ TAB or CR get a
 * leading apostrophe. Real numbers/dates and numeric-looking text are never touched.
 */
function csvField(v: Cell | string, counter: { n: number }): string {
  let s = formatCell(v)
  if (typeof v === 'string' && isFormulaRisk(s)) {
    s = `'${s}`
    counter.n++
  }
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export interface CsvReport {
  csv: string
  /** Number of cells (incl. headers) prefixed with ' to stop formula execution. */
  neutralised: number
}

/** RFC 4180 CSV. Optional UTF-8 BOM so Excel opens non-ASCII text correctly. */
export function toCsvWithReport(headers: readonly string[], rows: readonly Row[], bom = true): CsvReport {
  const counter = { n: 0 }
  const lines = [headers.map((h) => csvField(h, counter)).join(',')]
  for (const r of rows) lines.push(r.cells.map((c) => csvField(c, counter)).join(','))
  return { csv: (bom ? '﻿' : '') + lines.join('\r\n') + '\r\n', neutralised: counter.n }
}

export const toCsv = (headers: readonly string[], rows: readonly Row[], bom = true): string =>
  toCsvWithReport(headers, rows, bom).csv

/** Excel cannot store more than this many characters in one cell. */
export const XLSX_MAX_CELL_CHARS = 32767

function assertXlsxLimits(headers: readonly string[], rows: readonly Row[]) {
  const tooLong = (s: string) => s.length > XLSX_MAX_CELL_CHARS
  headers.forEach((h, c) => {
    if (tooLong(h)) throw new CleanSheetError('EXPORT_LIMIT', `Column header ${c + 1} is longer than Excel's ${XLSX_MAX_CELL_CHARS.toLocaleString()}-character cell limit. Export as CSV instead.`)
  })
  for (const r of rows) {
    for (let c = 0; c < r.cells.length; c++) {
      const v = r.cells[c]
      if (typeof v === 'string' && tooLong(v)) {
        throw new CleanSheetError(
          'EXPORT_LIMIT',
          `Row ${r.id + 2}, column "${headers[c] ?? c + 1}" has ${v.length.toLocaleString()} characters, over Excel's ${XLSX_MAX_CELL_CHARS.toLocaleString()}-character cell limit. Nothing was truncated; export as CSV instead.`,
        )
      }
    }
  }
}

/** Build an .xlsx file. Numbers, booleans and dates keep their native types. */
export async function toXlsx(
  headers: readonly string[],
  rows: readonly Row[],
  sheetName = 'Cleaned',
): Promise<Uint8Array> {
  assertXlsxLimits(headers, rows)
  const XLSX = await import('xlsx')
  const aoa: (Cell | undefined)[][] = [[...headers], ...rows.map((r) => r.cells.map((c) => c ?? undefined))]
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true })
  const wb = XLSX.utils.book_new()
  // Excel sheet names: max 31 chars, none of : \ / ? * [ ]
  const safe = sheetName.replace(/[:\\/?*[\]]/g, '_').slice(0, 31) || 'Cleaned'
  XLSX.utils.book_append_sheet(wb, ws, safe)
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellDates: true }) as ArrayBuffer)
}

export function cleanedFileName(original: string, format: ExportFormat): string {
  const base = original.replace(/\.[^.]+$/, '') || 'data'
  return `${base}.cleaned.${format}`
}

/** Trigger a browser download from in-memory data (no network involved). */
export function downloadBlob(data: BlobPart, fileName: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([data], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
