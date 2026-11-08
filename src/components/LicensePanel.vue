<script setup lang="ts">
import { computed, ref } from 'vue'
import { CHECKOUT_URL, SUPPORT_EMAIL } from '../config'
import { FREE_MAX_ROWS } from '../core/plans'
import { useLicense } from '../composables/useLicense'

const emit = defineEmits<{ close: [] }>()
const { status, checking, isPro, activate, remove } = useLicense()

const key = ref('')
const message = ref<{ kind: 'ok' | 'err'; text: string } | null>(null)

const expiry = computed(() => {
  const s = status.value
  return s && s.state !== 'invalid' ? new Date(s.payload.exp * 1000).toLocaleDateString() : ''
})

function onRemove() {
  message.value = null
  remove()
}

async function onActivate() {
  message.value = null
  const s = await activate(key.value)
  if (s.state === 'valid') {
    key.value = ''
    message.value = { kind: 'ok', text: 'Pro is active on this browser.' }
  } else if (s.state === 'expired') {
    message.value = { kind: 'err', text: 'This license has expired. Renew your subscription and paste the new key.' }
  } else {
    message.value = { kind: 'err', text: s.reason }
  }
}
</script>

<template>
  <section class="rounded-2xl border border-indigo-200 bg-indigo-50 p-5" aria-labelledby="pro-h">
    <div class="flex items-start justify-between gap-3">
      <h2 id="pro-h" class="text-base font-semibold text-indigo-950">CleanSheet Pro</h2>
      <button type="button" class="text-sm font-medium text-indigo-800 underline" @click="emit('close')">Close</button>
    </div>

    <div v-if="isPro && status?.state === 'valid'" class="mt-2 text-sm text-indigo-950">
      <p><strong>Pro is active</strong> on this browser until {{ expiry }}.</p>
      <button type="button" class="mt-3 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-indigo-100" @click="onRemove">Remove license from this browser</button>
    </div>

    <template v-else>
      <ul class="mt-2 grid gap-1 text-sm text-indigo-950 sm:grid-cols-2">
        <li><strong>Free:</strong> up to {{ FREE_MAX_ROWS.toLocaleString() }} rows, one key column, CSV export.</li>
        <li><strong>Pro:</strong> larger files, several key columns, blank-value modes, Excel (XLSX) export.</li>
      </ul>
      <p v-if="status?.state === 'expired'" class="mt-2 text-sm font-medium text-red-800">Your license expired on {{ expiry }}.</p>

      <div class="mt-4 flex flex-wrap items-center gap-3">
        <a v-if="CHECKOUT_URL" :href="CHECKOUT_URL" target="_blank" rel="noopener noreferrer" class="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Get Pro (opens secure checkout)</a>
        <span class="text-xs text-indigo-900">Payment is handled on the provider’s page. Your files are never involved.</span>
      </div>

      <form class="mt-4" @submit.prevent="onActivate">
        <label for="license-key" class="block text-sm font-medium text-indigo-950">Already have a key? Paste it here</label>
        <textarea id="license-key" v-model="key" rows="3" spellcheck="false" autocomplete="off" class="mt-1 w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 font-mono text-xs" placeholder="cs1.…" />
        <div class="mt-2 flex items-center gap-3">
          <button type="submit" class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50" :disabled="checking || !key.trim()">Activate</button>
          <span v-if="checking" class="text-sm text-indigo-900">Checking…</span>
        </div>
        <p class="mt-2 text-xs text-indigo-900">Activation is checked on this device only and is stored in this browser. It is not sent anywhere.</p>
      </form>
    </template>

    <p v-if="message" class="mt-3 text-sm font-medium" :class="message.kind === 'ok' ? 'text-green-800' : 'text-red-800'" role="status">{{ message.text }}</p>
    <p v-if="SUPPORT_EMAIL" class="mt-3 text-xs text-indigo-900">Lost your key or want a refund? Email <a class="underline" :href="`mailto:${SUPPORT_EMAIL}`">{{ SUPPORT_EMAIL }}</a>.</p>
  </section>
</template>
