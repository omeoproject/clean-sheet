# CleanSheet

A private, browser-only duplicate cleaner for CSV and Excel files. Built with Vue 3, Vite, TypeScript, Tailwind CSS 4 and SheetJS.

**Privacy:** files are read and processed in the browser tab. There is no backend, no telemetry and no upload. Production builds ship a Content-Security-Policy with `connect-src 'none'`, so the page cannot make network requests even by accident.

## Features

- Upload `.csv`, `.xlsx` or `.xls` by drag-and-drop or file picker, with sheet selection for workbooks
- Searchable, paginated data preview
- Composite duplicate keys across any number of columns
- Case-sensitive or insensitive matching, optional trimming, and three blank-value modes
- Duplicate groups are highlighted, with total, unique and duplicate counts
- Keep the **first** or **last** occurrence
- A full preview of the exact rows to be removed, plus an explicit confirmation step
- Undo and reset (the original data is never mutated)
- Export to CSV or XLSX, with original column order and native types where practical
- Clear errors for empty, malformed, oversized and unsupported files, and for duplicate or blank headers

## Requirements

Node.js 18.18+ or 20+ and npm. (Developed on Node 20.17.)

## Setup

```bash
npm install
```

## Commands

```bash
npm run dev        # dev server with hot reload (http://localhost:5173)
npm test           # run the Vitest suite once
npm run test:watch # watch mode
npm run typecheck  # vue-tsc type check
npm run build      # type check + production build into dist/
npm run preview    # serve dist/ locally (http://localhost:4173)
```

`dist/` is a fully static site (relative asset paths). Host it on any static server, or open it behind any web server you like. No server-side code is needed.

## Architecture

```
src/core/            framework-free, unit-tested logic
  types.ts           Cell / Row / Dataset, CleanSheetError, formatCell
  parse.ts           file → Dataset (CSV/XLSX/XLS), header cleanup, size/row limits
  dedupe.ts          findDuplicates(), removeRows()  (pure functions)
  export.ts          toCsv(), toXlsx(), download helper, format warning
src/composables/     useCleaner.ts: app state, undo history, busy/error handling
src/components/      FileDropzone.vue, DataTable.vue
src/App.vue          layout and workflow
tests/               dedupe.test.ts and io.test.ts (Vitest)
```

**Row identity.** Every row has a stable numeric `id`: its zero-based position among the source sheet's data rows. Duplicate detection, highlighting, removal and undo all work on ids, never on display values. Ids do not change when other rows are removed. The "Row" column in the UI shows the spreadsheet row number (`id + 2`).

**Matching rules.** Cell values are compared by their displayed text, so `1` and `"1"` match and dates compare as ISO strings. Multi-column keys are JSON-encoded, so `("a|b","c")` never collides with `("a","b|c")`.

| Blank mode | Behaviour |
| --- | --- |
| Skip rows with all key cells blank (default) | Those rows are never duplicates and never removed |
| Skip rows with any key cell blank | Rows with any blank key cell are never duplicates |
| Treat blanks as a value | Blank equals blank, so rows with identical blanks are duplicates |

With trimming on, whitespace-only cells count as blank.

## Limits and data-safety notes

- Maximum file size is 50 MB, and the maximum is 500,000 data rows per sheet. Both are in `LIMITS` in `src/core/parse.ts`. Larger inputs get a clear error rather than freezing the tab.
- Nothing is removed until you press **Yes, remove**, and every removal can be undone or reset.
- Only fully blank rows at the *end* of a sheet are ignored, and a warning says how many. All other rows are kept.
- **Export caveat:** exports contain cell values only. Formatting, formulas (saved as last calculated values), merged cells, charts and extra sheets are not preserved. The UI shows this warning next to the download buttons.
- CSV values are read as text, so `007` and `1E5` are not converted to numbers. CSV files that are not valid UTF-8 are decoded as Windows-1252. Exported CSVs are UTF-8 with a BOM so Excel shows accented characters correctly.
- **CSV formula injection:** in CSV exports, text cells (and headers) starting with `=`, `+`, `-`, `@`, tab or CR are prefixed with a `'` so Excel/Sheets/LibreOffice show them as text instead of running them. Real numbers and numeric-looking text (`-5`, `+15551234`) are left alone. The UI reports how many cells were prefixed. If you re-import the CSV, those cells will begin with the `'`. XLSX exports store such text as plain strings, so they are not affected.
- XLSX cannot hold more than 32,767 characters in a cell. If a cell is longer, the XLSX export stops with an error naming the row and column; nothing is truncated. Use CSV instead.
- **Performance (measured on one dev machine, Node):** a 500,000-row / 34 MB CSV takes about 11 s to parse and about 1 GB of memory; deduplication takes about 1.4 s. A 200,000-row XLSX export takes about 15 s. All work runs on the browser's main thread, so the tab may be unresponsive during these steps.

## Optional Pro tier (off by default)

The code includes an optional paid tier, disabled unless `VITE_CHECKOUT_URL` and `VITE_LICENSE_PUBLIC_KEY` are set at build time. With them unset (the default and what the public site ships today), there are no limits and no Pro UI. License keys are signed with ECDSA P-256 and verified **offline in the browser**, so file data is never involved in licensing. See [docs/GO-LIVE.md](docs/GO-LIVE.md) for setup and the honest limits of client-side enforcement, and [docs/PRO-PLAN.md](docs/PRO-PLAN.md) for the plan. The seller tool is `tools/license-tool.mjs`; never commit the `keys/` folder.

## Dependency licenses and security

| Package | License | Role |
| --- | --- | --- |
| vue | MIT | UI |
| xlsx (SheetJS CE 0.20.3) | Apache-2.0 | CSV/Excel parsing and writing |
| vite, @vitejs/plugin-vue, vitest, vue-tsc, typescript | MIT / Apache-2.0 | build and test (dev only) |
| tailwindcss, @tailwindcss/vite | MIT | styling (dev only, compiled to CSS) |

**SheetJS note.** The `xlsx` package on the npm registry is frozen at 0.18.5 and has known advisories (prototype pollution CVE-2023-30533 and ReDoS CVE-2024-22363). SheetJS publishes fixed releases only from its own CDN, so `package.json` installs the official 0.20.3 tarball from `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. Review the SheetJS release page periodically for newer versions.

`npm audit --omit=dev` reports **0 vulnerabilities** for the production dependencies. Plain `npm audit` currently lists findings in transitive **dev-only** tooling (the Vitest/vue-tsc chain, e.g. `tinypool`, `minimatch`). These are not included in the built site. The newest majors of Vite (7+) and Vitest (5) require Node 20.19+/22.12+, so this project pins Vite 6 and Vitest 3 for Node 20.17. On a newer Node you can upgrade (`npm i -D vitest@latest vite@latest @vitejs/plugin-vue@latest`) to clear them.

## License

MIT
