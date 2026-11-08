/**
 * Offline license verification.
 *
 * A license is `cs1.<payload>.<signature>` where payload is base64url(JSON) and the signature is
 * ECDSA P-256 / SHA-256 (WebCrypto raw r||s) over the string `cs1.<payload>`. Only the PUBLIC key
 * ships with the app; the private key never leaves the seller. Verification needs no network,
 * so file data and license checks never leave the browser.
 *
 * Limits of this design: it is client-side, so a determined person can bypass it (the code is
 * open source). It stops casual sharing via expiry, not a motivated attacker. See docs/PRO-PLAN.md.
 */

export interface LicensePayload {
  v: 1
  plan: 'pro'
  /** Order / subscription reference, for the seller's records. */
  id: string
  email?: string
  /** Issued-at and expiry, in seconds since the Unix epoch. */
  iat: number
  exp: number
}

export type LicenseStatus =
  | { state: 'valid'; payload: LicensePayload }
  | { state: 'expired'; payload: LicensePayload }
  | { state: 'invalid'; reason: string }

const PREFIX = 'cs1'

export function b64uToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function isPayload(x: unknown): x is LicensePayload {
  const p = x as Partial<LicensePayload> | null
  return (
    !!p &&
    p.v === 1 &&
    p.plan === 'pro' &&
    typeof p.id === 'string' &&
    typeof p.iat === 'number' &&
    typeof p.exp === 'number' &&
    Number.isFinite(p.iat) &&
    Number.isFinite(p.exp) &&
    (p.email === undefined || typeof p.email === 'string')
  )
}

/** Verify a license token against the seller's public key. Never throws. */
export async function verifyLicense(
  token: string,
  publicKeyJwk: JsonWebKey,
  nowMs: number = Date.now(),
): Promise<LicenseStatus> {
  const invalid = (reason: string): LicenseStatus => ({ state: 'invalid', reason })
  try {
    const parts = token.replace(/\s+/g, '').split('.')
    if (parts.length !== 3 || parts[0] !== PREFIX) return invalid('This is not a CleanSheet license key.')
    const [, payloadB64, sigB64] = parts

    const key = await crypto.subtle.importKey(
      'jwk',
      publicKeyJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      b64uToBytes(sigB64) as BufferSource,
      new TextEncoder().encode(`${PREFIX}.${payloadB64}`),
    )
    if (!ok) return invalid('The license key is not valid (signature check failed).')

    const payload: unknown = JSON.parse(new TextDecoder().decode(b64uToBytes(payloadB64)))
    if (!isPayload(payload)) return invalid('The license key is malformed.')
    if (nowMs / 1000 >= payload.exp) return { state: 'expired', payload }
    return { state: 'valid', payload }
  } catch {
    return invalid('The license key could not be read. Check that you pasted all of it.')
  }
}
