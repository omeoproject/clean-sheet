import { computed, reactive, ref, shallowRef } from 'vue'
import { findDuplicates, removeRows, type BlankMode, type KeepMode } from '../core/dedupe'
import {
  cleanedFileName,
  downloadBlob,
  toCsvWithReport,
  toXlsx,
  type ExportFormat,
} from '../core/export'
import { openWorkbook, type OpenedWorkbook } from '../core/parse'
import { CleanSheetError, type Dataset, type Row } from '../core/types'

/** Let the browser paint the loading indicator before a long synchronous task. */
const nextFrame = () => new Promise<void>((r) => setTimeout(r, 30))

export function useCleaner() {
  const workbook = shallowRef<OpenedWorkbook | null>(null)
  const sheetName = ref('')
  const dataset = shallowRef<Dataset | null>(null)
  /** Current rows (after any applied removals). Large, so never deeply reactive. */
  const rows = shallowRef<Row[]>([])
  const history = shallowRef<Row[][]>([])
  const selectedColumns = ref<number[]>([])
  const options = reactive({
    caseSensitive: true,
    trim: true,
    blankMode: 'skip-all' as BlankMode,
    keep: 'first' as KeepMode,
  })
  const busy = ref<string | null>(null)
  const error = ref<string | null>(null)
  const notice = ref<string | null>(null)

  const headers = computed(() => dataset.value?.headers ?? [])
  const originalCount = computed(() => dataset.value?.rows.length ?? 0)
  const removedSoFar = computed(() => originalCount.value - rows.value.length)

  const result = computed(() =>
    findDuplicates(rows.value, {
      columns: [...selectedColumns.value].sort((a, b) => a - b),
      caseSensitive: options.caseSensitive,
      trim: options.trim,
      blankMode: options.blankMode,
      keep: options.keep,
    }),
  )

  const removalRows = computed(() => rows.value.filter((r) => result.value.removeIds.has(r.id)))

  function clearMessages() {
    error.value = null
    notice.value = null
  }

  function fail(e: unknown) {
    error.value =
      e instanceof CleanSheetError
        ? e.message
        : `Something went wrong: ${(e as Error)?.message ?? 'unknown error'}. Your file was not changed.`
  }

  async function loadFile(file: File) {
    clearMessages()
    busy.value = `Reading ${file.name}…`
    try {
      await nextFrame()
      const data = await file.arrayBuffer()
      const wb = await openWorkbook({ name: file.name, data })
      const first = wb.sheetNames[0]
      const ds = wb.getDataset(first) // may throw EMPTY_SHEET etc. before we replace state
      workbook.value = wb
      applyDataset(first, ds)
    } catch (e) {
      fail(e)
    } finally {
      busy.value = null
    }
  }

  function applyDataset(name: string, ds: Dataset) {
    sheetName.value = name
    dataset.value = ds
    rows.value = ds.rows
    history.value = []
    selectedColumns.value = []
    if (ds.rows.length === 0) notice.value = 'This sheet has a header row but no data rows.'
  }

  async function selectSheet(name: string) {
    if (!workbook.value || name === sheetName.value) return
    clearMessages()
    busy.value = `Loading sheet "${name}"…`
    try {
      await nextFrame()
      applyDataset(name, workbook.value.getDataset(name))
    } catch (e) {
      fail(e) // keep the previously loaded sheet intact
    } finally {
      busy.value = null
    }
  }

  function applyRemoval() {
    const ids = result.value.removeIds
    if (ids.size === 0) return
    history.value = [...history.value, rows.value]
    rows.value = removeRows(rows.value, ids)
    notice.value = `Removed ${ids.size.toLocaleString()} duplicate row(s). You can undo this.`
  }

  function undo() {
    if (!history.value.length) return
    rows.value = history.value[history.value.length - 1]
    history.value = history.value.slice(0, -1)
    notice.value = 'Last removal undone.'
  }

  function reset() {
    if (!dataset.value) return
    rows.value = dataset.value.rows
    history.value = []
    notice.value = 'Reset to the original data.'
  }

  /** Close the file entirely and return to the start screen. */
  function closeFile() {
    workbook.value = null
    dataset.value = null
    rows.value = []
    history.value = []
    selectedColumns.value = []
    sheetName.value = ''
    clearMessages()
  }

  async function exportAs(format: ExportFormat) {
    if (!workbook.value || !dataset.value) return
    clearMessages()
    busy.value = 'Preparing download…'
    try {
      await nextFrame()
      const name = cleanedFileName(workbook.value.fileName, format)
      let extra = ''
      if (format === 'csv') {
        const rep = toCsvWithReport(headers.value, rows.value)
        downloadBlob(rep.csv, name, 'text/csv;charset=utf-8')
        if (rep.neutralised > 0) {
          extra = ` ${rep.neutralised.toLocaleString()} text cell(s) starting with = + - @ were prefixed with ' so spreadsheet apps won't run them as formulas.`
        }
      } else {
        const bytes = await toXlsx(headers.value, rows.value, sheetName.value)
        downloadBlob(
          bytes,
          name,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
      }
      notice.value = `Downloaded ${name} with ${rows.value.length.toLocaleString()} row(s).${extra}`
    } catch (e) {
      fail(e)
    } finally {
      busy.value = null
    }
  }

  return {
    workbook, sheetName, dataset, rows, headers, selectedColumns, options, busy, error, notice,
    result, removalRows, originalCount, removedSoFar,
    canUndo: computed(() => history.value.length > 0),
    loadFile, selectSheet, applyRemoval, undo, reset, closeFile, exportAs, clearMessages,
  }
}
