import { computed, ref } from 'vue'
import { LICENSE_PUBLIC_KEY, PRO_ENABLED } from '../config'
import { verifyLicense, type LicenseStatus } from '../core/license'
import { entitlementsFor } from '../core/plans'

const STORAGE_KEY = 'cleansheet.license'

function readStored(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return '' // storage blocked (private mode etc.): licenses just won't persist
  }
}

// Module-level so the whole app shares one license state.
const status = ref<LicenseStatus | null>(null)
const checking = ref(false)

async function check(token: string): Promise<LicenseStatus | null> {
  if (!PRO_ENABLED || !LICENSE_PUBLIC_KEY || !token.trim()) return null
  return verifyLicense(token, LICENSE_PUBLIC_KEY)
}

export function useLicense() {
  const isPro = computed(() => status.value?.state === 'valid')
  const entitlements = computed(() => entitlementsFor(isPro.value, PRO_ENABLED))

  /** Re-check a stored license (call once on startup; also expires it if its date has passed). */
  async function restore() {
    const stored = readStored()
    if (!stored) return
    checking.value = true
    try {
      status.value = await check(stored)
    } finally {
      checking.value = false
    }
  }

  /** Verify a pasted key. Only valid keys are saved. Returns the status for the UI. */
  async function activate(token: string): Promise<LicenseStatus> {
    checking.value = true
    try {
      const s = (await check(token)) ?? { state: 'invalid' as const, reason: 'Paste your license key first.' }
      if (s.state === 'valid') {
        status.value = s
        try {
          localStorage.setItem(STORAGE_KEY, token.replace(/\s+/g, ''))
        } catch {
          /* ignore: key still works for this session */
        }
      } else if (s.state === 'expired') {
        status.value = s // show "expired" so the user knows to renew
      }
      return s
    } finally {
      checking.value = false
    }
  }

  function remove() {
    status.value = null
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }

  return { status, checking, isPro, entitlements, restore, activate, remove, proEnabled: PRO_ENABLED }
}
