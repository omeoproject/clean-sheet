import { beforeAll, describe, expect, it } from 'vitest'
import { b64uToBytes, verifyLicense } from '../src/core/license'
import { generateKeyPair, signLicense } from '../tools/license-tool.mjs'
import { checkRowLimit, clampOptions, entitlementsFor, FREE_MAX_ROWS } from '../src/core/plans'
import type { DedupeOptions } from '../src/core/dedupe'

let seller: Awaited<ReturnType<typeof generateKeyPair>>
let other: Awaited<ReturnType<typeof generateKeyPair>>
const NOW = Date.UTC(2026, 5, 1)

beforeAll(async () => {
  seller = await generateKeyPair()
  other = await generateKeyPair()
})

const issue = (o: Parameters<typeof signLicense>[0] = { id: 'ORD1' }) => signLicense({ nowMs: NOW, ...o }, seller.privateJwk)

describe('license verification', () => {
  it('accepts a valid license', async () => {
    const r = await verifyLicense(await issue({ id: 'ORD1', email: 'a@b.co', days: 35 }), seller.publicJwk, NOW + 1000)
    expect(r.state).toBe('valid')
    if (r.state === 'valid') {
      expect(r.payload.id).toBe('ORD1')
      expect(r.payload.email).toBe('a@b.co')
    }
  })

  it('reports expiry, including at the exact boundary', async () => {
    const t = await issue({ id: 'X', days: 1 })
    expect((await verifyLicense(t, seller.publicJwk, NOW + 86_400_000 - 1)).state).toBe('valid')
    expect((await verifyLicense(t, seller.publicJwk, NOW + 86_400_000)).state).toBe('expired')
  })

  it('rejects a key signed by a different private key', async () => {
    const t = await signLicense({ id: 'X', nowMs: NOW }, other.privateJwk)
    expect((await verifyLicense(t, seller.publicJwk, NOW)).state).toBe('invalid')
  })

  it('rejects a tampered payload (e.g. extended expiry)', async () => {
    const [p, payload, sig] = (await issue({ id: 'X', days: 1 })).split('.')
    const obj = JSON.parse(new TextDecoder().decode(b64uToBytes(payload)))
    obj.exp += 10 * 365 * 86400
    const forgedPayload = btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const forged = `${p}.${forgedPayload}.${sig}`
    expect((await verifyLicense(forged, seller.publicJwk, NOW)).state).toBe('invalid')
  })

  it('rejects a tampered signature', async () => {
    const t = await issue()
    const bad = t.slice(0, -4) + (t.endsWith('AAAA') ? 'BBBB' : 'AAAA')
    expect((await verifyLicense(bad, seller.publicJwk, NOW)).state).toBe('invalid')
  })

  it.each(['', 'garbage', 'cs1.a.b', 'cs2.a.b.c', 'a.b.c', '....'])('never throws on junk %j', async (junk) => {
    expect((await verifyLicense(junk, seller.publicJwk, NOW)).state).toBe('invalid')
  })

  it('tolerates whitespace and line wraps from copy-paste', async () => {
    const t = await issue()
    const wrapped = `  ${t.slice(0, 30)}\n${t.slice(30, 90)}\r\n${t.slice(90)}  `
    expect((await verifyLicense(wrapped, seller.publicJwk, NOW + 1000)).state).toBe('valid')
  })

  it('does not throw with a malformed public key', async () => {
    expect((await verifyLicense(await issue(), { kty: 'EC' }, NOW)).state).toBe('invalid')
  })
})

describe('plans and limits', () => {
  const base: DedupeOptions = { columns: [2, 0], caseSensitive: false, trim: true, blankMode: 'match', keep: 'last' }

  it('free plan limits rows, features and export', () => {
    const e = entitlementsFor(false, true)
    expect(e).toMatchObject({ plan: 'free', maxRows: FREE_MAX_ROWS, advancedMatching: false, xlsxExport: false })
  })

  it('pro or gating-disabled unlocks everything', () => {
    for (const e of [entitlementsFor(true, true), entitlementsFor(false, false)]) {
      expect(e).toMatchObject({ plan: 'pro', advancedMatching: true, xlsxExport: true })
      expect(e.maxRows).toBeGreaterThan(FREE_MAX_ROWS)
    }
  })

  it('row limit: exactly at the limit is allowed, one over is refused with a clear message', () => {
    const e = entitlementsFor(false, true)
    expect(checkRowLimit(FREE_MAX_ROWS, e)).toBeNull()
    expect(checkRowLimit(FREE_MAX_ROWS + 1, e)).toMatch(/1,001 rows.*Nothing was loaded or changed/)
    expect(checkRowLimit(400_000, entitlementsFor(true, true))).toBeNull()
  })

  it('clamps free users to one key column and the default blank mode, but keeps free options', () => {
    const c = clampOptions(base, entitlementsFor(false, true))
    expect(c.columns).toEqual([2])
    expect(c.blankMode).toBe('skip-all')
    expect(c.caseSensitive).toBe(false)
    expect(c.keep).toBe('last')
  })

  it('does not clamp pro', () => {
    expect(clampOptions(base, entitlementsFor(true, true))).toEqual(base)
  })
})
