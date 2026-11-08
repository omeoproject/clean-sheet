<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ file: [File]; reject: [string] }>()

const input = ref<HTMLInputElement | null>(null)
const dragging = ref(false)

function pick(files: FileList | null | undefined) {
  if (!files || files.length === 0) return
  if (files.length > 1) {
    emit('reject', 'Please choose one file at a time.')
    return
  }
  emit('file', files[0])
}

function onDrop(e: DragEvent) {
  dragging.value = false
  pick(e.dataTransfer?.files)
}

function onChange(e: Event) {
  const el = e.target as HTMLInputElement
  pick(el.files)
  el.value = '' // allow re-selecting the same file
}
</script>

<template>
  <div
    class="rounded-2xl border-2 border-dashed p-8 text-center transition-colors sm:p-12"
    :class="dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-white'"
    @dragenter.prevent="dragging = true"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
  >
    <svg class="mx-auto h-12 w-12 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    </svg>
    <h2 class="mt-4 text-lg font-semibold">Drop a spreadsheet here</h2>
    <p id="drop-help" class="mt-1 text-sm text-slate-600">CSV, XLSX or XLS · up to 50&nbsp;MB · stays on your device</p>
    <input
      ref="input"
      type="file"
      class="sr-only"
      accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      tabindex="-1"
      aria-hidden="true"
      @change="onChange"
    />
    <button
      type="button"
      class="mt-5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
      aria-describedby="drop-help"
      :disabled="disabled"
      @click="input?.click()"
    >
      Choose file
    </button>
  </div>
</template>
