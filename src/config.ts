/**
 * Build-time Pro configuration. Both values are PUBLIC (they end up in the page), so they are
 * safe as ordinary environment variables. Leave either unset and Pro is OFF: no limits apply,
 * no Pro UI or pricing is shown, and nothing can be bought.
 *
 *   VITE_CHECKOUT_URL        https URL of the hosted checkout page (from your payment provider)
 *   VITE_LICENSE_PUBLIC_KEY  the public JWK printed by `node tools/license-tool.mjs keygen`
 *   VITE_SUPPORT_EMAIL       optional address shown for license/refund questions
 */
function parseKey(raw: unknown): JsonWebKey | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  try {
    const k = JSON.parse(raw) as JsonWebKey
    return k && k.kty === 'EC' && k.crv === 'P-256' && k.x && k.y ? k : null
  } catch {
    return null
  }
}

const rawUrl = import.meta.env.VITE_CHECKOUT_URL
export const CHECKOUT_URL: string | null =
  typeof rawUrl === 'string' && /^https:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : null
export const LICENSE_PUBLIC_KEY: JsonWebKey | null = parseKey(import.meta.env.VITE_LICENSE_PUBLIC_KEY)
export const SUPPORT_EMAIL: string | null =
  typeof import.meta.env.VITE_SUPPORT_EMAIL === 'string' && import.meta.env.VITE_SUPPORT_EMAIL.includes('@')
    ? import.meta.env.VITE_SUPPORT_EMAIL.trim()
    : null

/** Price text shown on the page, e.g. "$4.99/month". Must match what the checkout charges. */
export const PRICE_LABEL: string =
  typeof import.meta.env.VITE_PRO_PRICE === 'string' ? import.meta.env.VITE_PRO_PRICE.trim().slice(0, 40) : ''

/** Pro is only switched on when it can actually be bought AND verified. */
export const PRO_ENABLED = CHECKOUT_URL !== null && LICENSE_PUBLIC_KEY !== null
