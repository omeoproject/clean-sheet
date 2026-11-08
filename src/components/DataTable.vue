<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { formatCell, type Row } from '../core/types'

const props = defineProps<{
  caption: string
  headers: string[]
  rows: Row[]
  /** rowId -> duplicate group number (enables highlighting + "duplicates only"). */
  groupOf?: Map<number, number>
  /** ids that would be removed (marks "Remove" vs "Keep" in groups). */
  removeIds?: Set<number>
  /** highlighted key columns */
  keyColumns?: number[]
  emptyText?: string
}>()

const uid = useId()
const query = ref('') // bound to the input
const appliedQuery = ref('') // debounced copy used for filtering (keeps typing smooth on big sheets)
let queryTimer: ReturnType<typeof setTimeout> | undefined
watch(query, (v) => {
  clearTimeout(queryTimer)
  queryTimer = setTimeout(() => (appliedQuery.value = v), 250)
})
onBeforeUnmount(() => clearTimeout(queryTimer))
const page = ref(1)
const pageSize = ref(25)
const onlyDuplicates = ref(false)

const swatches = [
  'bg-amber-50', 'bg-sky-50', 'bg-emerald-50', 'bg-rose-50', 'bg-violet-50', 'bg-orange-50',
]
const rowClass = (id: number) => {
  const g = props.groupOf?.get(id)
  return g === undefined ? '' : swatches[(g - 1) % swatches.length]
}

const filtered = computed(() => {
  const q = appliedQuery.value.trim().toLowerCase()
  let list = props.rows
  if (onlyDuplicates.value && props.groupOf) list = list.filter((r) => props.groupOf!.has(r.id))
  if (q) {
    list = list.filter(
      (r) => String(r.id + 2).includes(q) || r.cells.some((c) => formatCell(c).toLowerCase().includes(q)),
    )
  }
  return list
})

const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize.value)))
const visible = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})
const rangeText = computed(() => {
  const n = filtered.value.length
  if (!n) return '0 rows'
  const start = (page.value - 1) * pageSize.value + 1
  return `${start.toLocaleString()}–${Math.min(n, start + pageSize.value - 1).toLocaleString()} of ${n.toLocaleString()}`
})

watch([appliedQuery, pageSize, onlyDuplicates, () => props.rows], () => (page.value = 1))
watch(pageCount, (c) => {
  if (page.value > c) page.value = c
})
</script>

<template>
  <div>
    <div class="flex flex-wrap items-end gap-3 pb-3">
      <div class="min-w-[12rem] flex-1">
        <label class="block text-xs font-medium text-slate-600" :for="`${uid}-q`">Search rows</label>
        <input
          :id="`${uid}-q`"
          v-model="query"
          type="search"
          placeholder="Search any column or row number…"
          class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </div>
      <label v-if="groupOf" class="flex items-center gap-2 pb-2 text-sm">
        <input v-model="onlyDuplicates" type="checkbox" class="h-4 w-4 rounded border-slate-300 accent-indigo-600" />
        Duplicates only
      </label>
      <div>
        <label class="block text-xs font-medium text-slate-600" :for="`${uid}-ps`">Rows per page</label>
        <select :id="`${uid}-ps`" v-model.number="pageSize" class="mt-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm">
          <option v-for="n in [10, 25, 50, 100]" :key="n" :value="n">{{ n }}</option>
        </select>
      </div>
    </div>

    <div class="max-h-[28rem] overflow-auto rounded-lg border border-slate-200 bg-white" tabindex="0" :aria-label="`${caption} (scrollable)`">
      <table class="min-w-full border-collapse text-left text-sm">
        <caption class="sr-only">{{ caption }}</caption>
        <thead class="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
          <tr>
            <th scope="col" class="px-3 py-2 font-semibold">Row</th>
            <th v-if="groupOf" scope="col" class="px-3 py-2 font-semibold">Group</th>
            <th
              v-for="(h, i) in headers"
              :key="i"
              scope="col"
              class="whitespace-nowrap px-3 py-2 font-semibold"
              :class="keyColumns?.includes(i) ? 'bg-indigo-100 text-indigo-900' : ''"
            >
              {{ h }}<span v-if="keyColumns?.includes(i)" class="sr-only"> (key column)</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in visible" :key="r.id" class="border-t border-slate-100" :class="rowClass(r.id)">
            <th scope="row" class="whitespace-nowrap px-3 py-1.5 text-xs font-normal tabular-nums text-slate-500">{{ r.id + 2 }}</th>
            <td v-if="groupOf" class="whitespace-nowrap px-3 py-1.5">
              <template v-if="groupOf.get(r.id)">
                <span class="text-xs font-semibold text-slate-700">#{{ groupOf.get(r.id) }}</span>
                <span
                  v-if="removeIds"
                  class="ml-1 rounded px-1.5 py-0.5 text-xs font-medium"
                  :class="removeIds.has(r.id) ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'"
                >{{ removeIds.has(r.id) ? 'Remove' : 'Keep' }}</span>
              </template>
            </td>
            <td v-for="(_, i) in headers" :key="i" class="max-w-[22rem] truncate px-3 py-1.5" :title="formatCell(r.cells[i])">
              {{ formatCell(r.cells[i]) }}
            </td>
          </tr>
          <tr v-if="!visible.length">
            <td :colspan="headers.length + (groupOf ? 2 : 1)" class="px-3 py-8 text-center text-slate-500">
              {{ emptyText ?? 'No matching rows.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2 pt-3 text-sm">
      <p aria-live="polite" class="text-slate-600">{{ rangeText }}</p>
      <div class="flex items-center gap-2">
        <button type="button" class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40" :disabled="page <= 1" @click="page--">Previous</button>
        <span class="tabular-nums">Page {{ page }} / {{ pageCount }}</span>
        <button type="button" class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40" :disabled="page >= pageCount" @click="page++">Next</button>
      </div>
    </div>
  </div>
</template>
