/** A single spreadsheet cell value. Dates are kept as Date objects. */
export type Cell = string | number | boolean | Date | null

/**
 * A data row. `id` is the stable, zero-based position of the row in the
 * *source sheet's data rows* (header excluded). It never changes when other
 * rows are removed, so it is used for identity everywhere (never display text).
 * Spreadsheet row number = id + 2 (1-based, plus header row).
 */
export interface Row {
  id: number
  cells: Cell[]
}

export interface Dataset {
  headers: string[]
  rows: Row[]
  /** Non-fatal notes shown to the user (renamed columns, ragged rows, ...). */
  warnings: string[]
}

export type ErrorCode =
  | 'UNSUPPORTED_TYPE'
  | 'EMPTY_FILE'
  | 'EMPTY_SHEET'
  | 'MALFORMED'
  | 'TOO_LARGE'
  | 'TOO_MANY_ROWS'
  | 'EXPORT_LIMIT'

export class CleanSheetError extends Error {
  readonly code: ErrorCode
  constructor(code: ErrorCode, message: string) {
    super(message)
    this.name = 'CleanSheetError'
    this.code = code
  }
}

export function formatCell(value: Cell | undefined): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    const iso = value.toISOString()
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso.replace('.000Z', 'Z')
  }
  return String(value)
}
