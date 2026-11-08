import type { WorkBook } from 'xlsx'
import { CleanSheetError, type Cell, type Dataset, type Row } from './types'

export const LIMITS = {
  maxFileBytes: 50 * 1024 * 1024,
  maxRows: 500_000,
  warnRows: 100_000,
} as const

export type FileKind = 'csv' | 'xlsx' | 'xls'

export interface RawFile {
  name: string
  data: ArrayBuffer
}

export interface OpenedWorkbook {
  fileName: string
  kind: FileKind
  sheetNames: string[]
  /** Convert one sheet into a Dataset (first row = headers). */
  getDataset(sheetName: string): Dataset
}

export function detectKind(fileName: string): FileKind {
  const ext = fileName.toLowerCase().split('.').pop()
  if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') return ext
  throw new CleanSheetError(
    'UNSUPPORTED_TYPE',
    `"${fileName}" is not supported. Please choose a .csv, .xlsx or .xls file.`,
  )
}

function decodeCsv(data: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data)
  } catch {
    // Not valid UTF-8: fall back to the common legacy Excel encoding.
    return new TextDecoder('windows-1252').decode(data)
  }
}

/** Parse a file in memory. Never touches the network. */
export async function openWorkbook(file: RawFile): Promise<OpenedWorkbook> {
  const kind = detectKind(file.name)
  if (file.data.byteLength === 0) {
    throw new CleanSheetError('EMPTY_FILE', `"${file.name}" is empty (0 bytes).`)
  }
  if (file.data.byteLength > LIMITS.maxFileBytes) {
    const mb = (file.data.byteLength / 1024 / 1024).toFixed(1)
    throw new CleanSheetError(
      'TOO_LARGE',
      `"${file.name}" is ${mb} MB. The limit is ${LIMITS.maxFileBytes / 1024 / 1024} MB to keep your browser responsive. Split the file and try again.`,
    )
  }
  const bytes = new Uint8Array(file.data)
  if (kind === 'xlsx' && !(bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    throw new CleanSheetError(
      'MALFORMED',
      `"${file.name}" does not look like a valid .xlsx file (it is not a ZIP package). It may be corrupted or have the wrong extension.`,
    )
  }

  const XLSX = await import('xlsx')
  let wb: WorkBook
  try {
    wb =
      kind === 'csv'
        ? // raw: keep every CSV value as text so "007" or "1E5" are never altered.
          XLSX.read(decodeCsv(file.data), { type: 'string', raw: true, dense: true })
        : XLSX.read(bytes, { type: 'array', cellDates: true, dense: true })
  } catch (e) {
    throw new CleanSheetError(
      'MALFORMED',
      `"${file.name}" could not be read: ${(e as Error).message || 'unknown error'}. The file may be corrupted or password-protected.`,
    )
  }
  if (!wb.SheetNames.length) {
    throw new CleanSheetError('EMPTY_FILE', `"${file.name}" contains no sheets.`)
  }

  return {
    fileName: file.name,
    kind,
    sheetNames: wb.SheetNames,
    getDataset: (sheetName) => sheetToDataset(XLSX, wb, sheetName),
  }
}

function toCell(v: unknown): Cell {
  if (v === null || v === undefined) return null
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
  if (v instanceof Date) return v
  return String(v)
}

const isBlank = (c: Cell) => c === null || (typeof c === 'string' && c.trim() === '')

function sheetToDataset(XLSX: typeof import('xlsx'), wb: WorkBook, sheetName: string): Dataset {
  const ws = wb.Sheets[sheetName]
  if (!ws) throw new CleanSheetError('MALFORMED', `Sheet "${sheetName}" was not found.`)
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: true,
  })
  const warnings: string[] = []

  // Drop only *trailing* fully blank rows (artifacts of the used range) and say so.
  let end = aoa.length
  while (end > 0 && aoa[end - 1].every((c) => isBlank(toCell(c)))) end--
  if (end === 0) {
    throw new CleanSheetError('EMPTY_SHEET', `Sheet "${sheetName}" has no data.`)
  }
  const trimmedTrailing = aoa.length - end
  if (trimmedTrailing > 0) {
    warnings.push(`${trimmedTrailing} empty row(s) at the end of the sheet were ignored.`)
  }

  const headerRow = aoa[0].map(toCell)
  const body = aoa.slice(1, end)
  if (body.length > LIMITS.maxRows) {
    throw new CleanSheetError(
      'TOO_MANY_ROWS',
      `Sheet "${sheetName}" has ${body.length.toLocaleString()} rows. The limit is ${LIMITS.maxRows.toLocaleString()} rows in the browser.`,
    )
  }
  if (body.length > LIMITS.warnRows) {
    warnings.push(`Large dataset (${body.length.toLocaleString()} rows): loading and XLSX export can take 10+ seconds and use around 1 GB of memory at the largest sizes. CSV export is faster.`)
  }
  let width = headerRow.length
  for (const r of body) if (r.length > width) width = r.length

  const headers = makeHeaders(headerRow, width, warnings)
  // SheetJS pads rows to the widest row, so look for real data beyond the last named header.
  let headerUsed = headerRow.length
  while (headerUsed > 0 && isBlank(headerRow[headerUsed - 1])) headerUsed--
  if (body.some((r) => r.slice(headerUsed).some((c) => !isBlank(toCell(c))))) {
    warnings.push('Some rows had more cells than the header row. Extra columns were kept and named "Column N".')
  }

  const rows: Row[] = body.map((r, id) => {
    const cells: Cell[] = new Array(width)
    for (let i = 0; i < width; i++) cells[i] = toCell(r[i])
    return { id, cells }
  })
  return { headers, rows, warnings }
}

/** Build unique, non-empty headers. Duplicate names get " (2)", " (3)", ... */
export function makeHeaders(raw: Cell[], width: number, warnings: string[] = []): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const renamed: string[] = []
  let blanks = 0
  for (let i = 0; i < width; i++) {
    const base = i < raw.length && raw[i] !== null ? String(raw[i]).trim() : ''
    let name = base
    if (!name) {
      name = `Column ${i + 1}`
      blanks++
    }
    if (seen.has(name.toLowerCase())) {
      let n = 2
      while (seen.has(`${name} (${n})`.toLowerCase())) n++
      renamed.push(`"${name}" → "${name} (${n})"`)
      name = `${name} (${n})`
    }
    seen.add(name.toLowerCase())
    out.push(name)
  }
  if (renamed.length) {
    warnings.push(`Duplicate column names were made unique: ${renamed.join(', ')}. Exports use the new names.`)
  }
  if (blanks) warnings.push(`${blanks} column(s) had no header and were named "Column N".`)
  return out
}
