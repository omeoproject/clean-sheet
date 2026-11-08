<script setup lang="ts">
import { computed, ref } from 'vue'
import DataTable from './components/DataTable.vue'
import FileDropzone from './components/FileDropzone.vue'
import Landing from './components/Landing.vue'
import { useCleaner } from './composables/useCleaner'
import { FORMAT_WARNING } from './core/export'

const c = useCleaner()
const confirming = ref(false)
const showGroups = ref(false)

const stats = computed(() => c.result.value.stats)
const hasKey = computed(() => c.selectedColumns.value.length > 0)
const cardClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'

function toggleColumn(i: number) {
  const s = c.selectedColumns.value
  c.selectedColumns.value = s.includes(i) ? s.filter((x) => x !== i) : [...s, i]
  confirming.value = false
}

function confirmRemoval() {
  c.applyRemoval()
  confirming.value = false
}

function onSheet(e: Event) {
  confirming.value = false
  void c.selectSheet((e.target as HTMLSelectElement).value)
}

function startOver() {
  confirming.value = false
  c.closeFile()
}
</script>

<template>
  <div class="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-10">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white" aria-hidden="true">
          <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
        </div>
        <div>
          <h1 v-if="c.workbook.value" class="text-xl font-bold leading-tight">CleanSheet</h1>
          <p v-else class="text-xl font-bold leading-tight">CleanSheet</p>
          <p class="text-sm text-slate-600">Find and remove duplicate rows in CSV &amp; Excel files</p>
        </div>
      </div>
      <button v-if="c.workbook.value" type="button" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50" @click="startOver">
        Open another file
      </button>
    </header>

    <!-- Privacy message (the landing hero carries its own) -->
    <p v-if="c.workbook.value" class="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="note">
      <svg viewBox="0 0 24 24" class="mt-0.5 h-5 w-5 flex-none" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3zM9 12l2 2 4-4" /></svg>
      <span><strong>100% private.</strong> Your files are processed entirely in this browser tab. Nothing is uploaded, no analytics or tracking is used, and the page is blocked from making network requests.</span>
    </p>

    <!-- Live regions for status -->
    <div aria-live="polite" class="space-y-3">
      <div v-if="c.busy.value" class="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900" role="status">
        <svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity=".25" /><path d="M21 12a9 9 0 00-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>
        {{ c.busy.value }}
      </div>
      <div v-if="c.error.value" class="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
        <span><strong>Error:</strong> {{ c.error.value }}</span>
        <button type="button" class="font-medium underline" @click="c.clearMessages()">Dismiss</button>
      </div>
      <div v-if="c.notice.value" class="flex items-start justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900" role="status">
        <span>{{ c.notice.value }}</span>
        <button type="button" class="font-medium underline" @click="c.notice.value = null">Dismiss</button>
      </div>
    </div>

    <main class="flex flex-col gap-6">
      <Landing v-if="!c.workbook.value">
        <template #dropzone>
          <FileDropzone
            :disabled="!!c.busy.value"
            @file="c.loadFile"
            @reject="(m) => (c.error.value = m)"
          />
        </template>
      </Landing>

      <template v-else-if="c.dataset.value">
        <!-- 1. File & sheet -->
        <section :class="cardClass" aria-labelledby="h-file">
          <div class="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="h-file" class="text-base font-semibold">1 · Your data</h2>
              <p class="text-sm text-slate-600">
                <span class="font-medium text-slate-900">{{ c.workbook.value.fileName }}</span>
                · {{ c.originalCount.value.toLocaleString() }} data rows · {{ c.headers.value.length }} columns
              </p>
            </div>
            <div v-if="c.workbook.value.sheetNames.length > 1">
              <label for="sheet" class="block text-xs font-medium text-slate-600">Sheet</label>
              <select id="sheet" class="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" :value="c.sheetName.value" :disabled="!!c.busy.value" @change="onSheet">
                <option v-for="s in c.workbook.value.sheetNames" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
          </div>
          <ul v-if="c.dataset.value.warnings.length" class="mt-3 list-disc space-y-1 rounded-lg bg-amber-50 py-2 pl-8 pr-3 text-sm text-amber-900">
            <li v-for="w in c.dataset.value.warnings" :key="w">{{ w }}</li>
          </ul>
          <div class="mt-4">
            <DataTable
              caption="Data preview"
              :headers="c.headers.value"
              :rows="c.rows.value"
              :group-of="hasKey ? c.result.value.groupOf : undefined"
              :remove-ids="hasKey ? c.result.value.removeIds : undefined"
              :key-columns="c.selectedColumns.value"
              empty-text="No rows to show."
            />
          </div>
        </section>

        <div class="grid gap-6 lg:grid-cols-2">
          <!-- 2. Key columns -->
          <section :class="cardClass" aria-labelledby="h-cols">
            <h2 id="h-cols" class="text-base font-semibold">2 · Duplicate key</h2>
            <p class="text-sm text-slate-600">Rows are duplicates when <em>all</em> selected columns match.</p>
            <fieldset class="mt-3">
              <legend class="sr-only">Columns that form the duplicate key</legend>
              <div class="grid max-h-60 gap-1 overflow-auto sm:grid-cols-2">
                <label v-for="(h, i) in c.headers.value" :key="i" class="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50" :class="c.selectedColumns.value.includes(i) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'">
                  <input type="checkbox" class="h-4 w-4 accent-indigo-600" :checked="c.selectedColumns.value.includes(i)" @change="toggleColumn(i)" />
                  <span class="truncate" :title="h">{{ h }}</span>
                </label>
              </div>
            </fieldset>
            <div class="mt-3 flex gap-3 text-sm">
              <button type="button" class="font-medium text-indigo-700 underline" @click="c.selectedColumns.value = c.headers.value.map((_, i) => i)">Select all</button>
              <button type="button" class="font-medium text-indigo-700 underline" @click="c.selectedColumns.value = []">Clear</button>
            </div>
          </section>

          <!-- 3. Matching options -->
          <section :class="cardClass" aria-labelledby="h-opts">
            <h2 id="h-opts" class="text-base font-semibold">3 · Matching rules</h2>
            <div class="mt-3 space-y-4 text-sm">
              <label class="flex items-center gap-2"><input v-model="c.options.caseSensitive" type="checkbox" class="h-4 w-4 accent-indigo-600" /> Case-sensitive <span class="text-slate-500">("Ann" ≠ "ann")</span></label>
              <label class="flex items-center gap-2"><input v-model="c.options.trim" type="checkbox" class="h-4 w-4 accent-indigo-600" /> Trim leading/trailing spaces before comparing</label>
              <div>
                <label for="blank" class="block font-medium">Blank values</label>
                <select id="blank" v-model="c.options.blankMode" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                  <option value="skip-all">Never treat rows with all key cells blank as duplicates</option>
                  <option value="skip-any">Never treat rows with any blank key cell as duplicates</option>
                  <option value="match">Treat blanks as a normal value (blank = blank)</option>
                </select>
              </div>
              <fieldset>
                <legend class="font-medium">Which occurrence to keep</legend>
                <div class="mt-1 flex gap-4">
                  <label class="flex items-center gap-2"><input v-model="c.options.keep" type="radio" value="first" class="accent-indigo-600" /> First</label>
                  <label class="flex items-center gap-2"><input v-model="c.options.keep" type="radio" value="last" class="accent-indigo-600" /> Last</label>
                </div>
              </fieldset>
            </div>
          </section>
        </div>

        <!-- 4. Results & removal preview -->
        <section :class="cardClass" aria-labelledby="h-res">
          <h2 id="h-res" class="text-base font-semibold">4 · Review &amp; remove</h2>
          <dl class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div class="rounded-xl bg-slate-100 p-3"><dt class="text-xs text-slate-600">Total rows</dt><dd class="text-2xl font-bold tabular-nums">{{ stats.totalRows.toLocaleString() }}</dd></div>
            <div class="rounded-xl bg-green-50 p-3"><dt class="text-xs text-green-800">Unique rows</dt><dd class="text-2xl font-bold tabular-nums text-green-900">{{ stats.uniqueRows.toLocaleString() }}</dd></div>
            <div class="rounded-xl bg-red-50 p-3"><dt class="text-xs text-red-800">Duplicates to remove</dt><dd class="text-2xl font-bold tabular-nums text-red-900">{{ stats.duplicateRows.toLocaleString() }}</dd></div>
            <div class="rounded-xl bg-amber-50 p-3"><dt class="text-xs text-amber-800">Duplicate groups</dt><dd class="text-2xl font-bold tabular-nums text-amber-900">{{ stats.duplicateGroups.toLocaleString() }}</dd></div>
          </dl>
          <p v-if="stats.skippedBlankRows" class="mt-2 text-sm text-slate-600">{{ stats.skippedBlankRows.toLocaleString() }} row(s) with blank key values were excluded from matching and will not be removed.</p>
          <p v-if="c.removedSoFar.value" class="mt-2 text-sm text-slate-600">{{ c.removedSoFar.value.toLocaleString() }} row(s) already removed this session ({{ c.originalCount.value.toLocaleString() }} originally).</p>

          <p v-if="!hasKey" class="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Select at least one key column above to detect duplicates.</p>
          <template v-else>
            <div class="mt-4">
              <h3 class="text-sm font-semibold">Rows that will be removed ({{ stats.duplicateRows.toLocaleString() }})</h3>
              <p class="mb-2 text-sm text-slate-600">Nothing is deleted until you confirm below. Each removed row shows the group it belongs to.</p>
              <DataTable
                caption="Rows to be removed"
                :headers="c.headers.value"
                :rows="c.removalRows.value"
                :group-of="c.result.value.groupOf"
                :remove-ids="c.result.value.removeIds"
                :key-columns="c.selectedColumns.value"
                empty-text="No duplicates found with these settings. Nothing will be removed."
              />
            </div>

            <div class="mt-3">
              <button type="button" class="text-sm font-medium text-indigo-700 underline" :aria-expanded="showGroups" @click="showGroups = !showGroups">
                {{ showGroups ? 'Hide' : 'Show' }} duplicate groups summary
              </button>
              <ul v-if="showGroups" class="mt-2 max-h-56 space-y-1 overflow-auto text-sm">
                <li v-for="g in c.result.value.groups.slice(0, 200)" :key="g.number" class="rounded border border-slate-200 px-3 py-1.5">
                  <strong>#{{ g.number }}</strong> · key “{{ g.keyDisplay.join(' · ') }}” · rows {{ g.rowIds.slice(0, 12).map((i) => i + 2).join(', ') }}<template v-if="g.rowIds.length > 12"> … (+{{ (g.rowIds.length - 12).toLocaleString() }} more)</template> · keeping row {{ g.keepId + 2 }}
                </li>
                <li v-if="c.result.value.groups.length > 200" class="px-3 text-slate-500">…and {{ (c.result.value.groups.length - 200).toLocaleString() }} more groups.</li>
              </ul>
            </div>

            <div class="mt-5 flex flex-wrap items-center gap-3">
              <button v-if="!confirming" type="button" class="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40" :disabled="stats.duplicateRows === 0 || !!c.busy.value" @click="confirming = true">
                Remove {{ stats.duplicateRows.toLocaleString() }} duplicate row(s)…
              </button>
              <div v-else class="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm" role="alertdialog" aria-label="Confirm removal">
                <span>Remove <strong>{{ stats.duplicateRows.toLocaleString() }}</strong> row(s), keeping the <strong>{{ c.options.keep }}</strong> of each group? You can undo this.</span>
                <button type="button" class="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700" @click="confirmRemoval">Yes, remove</button>
                <button type="button" class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50" @click="confirming = false">Cancel</button>
              </div>
              <button type="button" class="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-40" :disabled="!c.canUndo.value" @click="c.undo()">Undo</button>
              <button type="button" class="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-40" :disabled="c.removedSoFar.value === 0" @click="c.reset()">Reset to original</button>
            </div>
          </template>
        </section>

        <!-- 5. Export -->
        <section :class="cardClass" aria-labelledby="h-exp">
          <h2 id="h-exp" class="text-base font-semibold">5 · Download</h2>
          <p class="mt-1 text-sm text-slate-600">
            Exports the {{ c.rows.value.length.toLocaleString() }} current row(s), original column order. Your original file is never modified.
          </p>
          <p class="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="note"><strong>Heads up:</strong> {{ FORMAT_WARNING }}</p>
          <div class="mt-4 flex flex-wrap gap-3">
            <button type="button" class="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40" :disabled="!!c.busy.value" @click="c.exportAs('csv')">Download CSV</button>
            <button type="button" class="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40" :disabled="!!c.busy.value" @click="c.exportAs('xlsx')">Download XLSX</button>
          </div>
        </section>
      </template>
    </main>

    <footer class="mt-auto pt-6 text-center text-xs text-slate-500">
      CleanSheet runs locally in your browser · Open source (MIT) ·
      <a href="https://github.com/omeoproject/clean-sheet" class="underline" rel="noopener">Source on GitHub</a> ·
      Built with Vue, Tailwind CSS and SheetJS
    </footer>
  </div>
</template>
