import type { DedupeOptions } from './dedupe'
import { LIMITS } from './parse'

/**
 * Plan definitions. This is the ONE place that decides what Free and Pro get.
 * (Product assumptions to confirm: "advanced matching" = composite multi-column keys and
 * blank-value modes. Ignore-capitals, trim and keep-first/last stay free.)
 */
export const FREE_MAX_ROWS = 1000

export interface Entitlements {
  plan: 'free' | 'pro'
  maxRows: number
  /** More than one key column, and the non-default blank-value modes. */
  advancedMatching: boolean
  xlsxExport: boolean
}

/**
 * When gating is disabled (no checkout configured) EVERYTHING is available, so no one loses a
 * feature before it can be bought.
 */
export function entitlementsFor(isPro: boolean, gatingEnabled: boolean): Entitlements {
  if (isPro || !gatingEnabled) {
    return { plan: 'pro', maxRows: LIMITS.maxRows, advancedMatching: true, xlsxExport: true }
  }
  return { plan: 'free', maxRows: FREE_MAX_ROWS, advancedMatching: false, xlsxExport: false }
}

/** Returns an error message when the file is over the plan's row limit, else null. */
export function checkRowLimit(rowCount: number, ent: Entitlements): string | null {
  if (rowCount <= ent.maxRows) return null
  return `This sheet has ${rowCount.toLocaleString()} rows. The free plan handles up to ${ent.maxRows.toLocaleString()} rows per file. Nothing was loaded or changed. Upgrade to Pro for larger files, or split the file.`
}

/** Force plan limits onto matching options so a free user can never run Pro matching. */
export function clampOptions(opts: DedupeOptions, ent: Entitlements): DedupeOptions {
  if (ent.advancedMatching) return opts
  return {
    ...opts,
    columns: opts.columns.slice(0, 1),
    blankMode: 'skip-all',
  }
}
