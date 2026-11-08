#!/usr/bin/env node
/**
 * Seller-side license tool. Run on YOUR machine; never ship the private key.
 *
 *   node tools/license-tool.mjs keygen [--out keys]
 *   node tools/license-tool.mjs issue --private keys/license-private.jwk.json --id ORDER123 [--email a@b.c] [--days 35]
 *
 * `keygen` writes the private key to keys/ (git-ignored) and prints the PUBLIC key JSON
 * to put in VITE_LICENSE_PUBLIC_KEY. `issue` prints a license key to send to a customer.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const subtle = globalThis.crypto.subtle
const enc = new TextEncoder()

const toB64u = (bytes) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export async function generateKeyPair() {
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const privateJwk = await subtle.exportKey('jwk', pair.privateKey)
  const publicJwk = await subtle.exportKey('jwk', pair.publicKey)
  return { privateJwk, publicJwk }
}

/** payload: { id, email?, days?, nowMs? } -> license token string */
export async function signLicense({ id, email, days = 35, nowMs = Date.now(), expSeconds }, privateJwk) {
  const iat = Math.floor(nowMs / 1000)
  const payload = { v: 1, plan: 'pro', id, ...(email ? { email } : {}), iat, exp: expSeconds ?? iat + Math.round(days * 86400) }
  const payloadB64 = toB64u(enc.encode(JSON.stringify(payload)))
  const input = `cs1.${payloadB64}`
  const key = await subtle.importKey('jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(input))
  return `${input}.${toB64u(new Uint8Array(sig))}`
}

function arg(name, argv) {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}

async function main(argv) {
  const [cmd] = argv
  if (cmd === 'keygen') {
    const out = arg('out', argv) ?? 'keys'
    mkdirSync(out, { recursive: true })
    const { privateJwk, publicJwk } = await generateKeyPair()
    const privPath = join(out, 'license-private.jwk.json')
    writeFileSync(privPath, JSON.stringify(privateJwk), { mode: 0o600, flag: 'wx' })
    writeFileSync(join(out, 'license-public.jwk.json'), JSON.stringify(publicJwk))
    console.log(`Private key written to ${privPath}. KEEP IT SECRET and back it up; losing it means you cannot issue keys.`)
    console.log('\nPublic key (set as VITE_LICENSE_PUBLIC_KEY):\n' + JSON.stringify({ kty: publicJwk.kty, crv: publicJwk.crv, x: publicJwk.x, y: publicJwk.y }))
  } else if (cmd === 'issue') {
    const privPath = arg('private', argv)
    const id = arg('id', argv)
    if (!privPath || !id) throw new Error('usage: issue --private <file> --id <order id> [--email e] [--days 35]')
    const days = Number(arg('days', argv) ?? 35)
    if (!Number.isFinite(days) || days <= 0) throw new Error('--days must be a positive number')
    const token = await signLicense({ id, email: arg('email', argv), days }, JSON.parse(readFileSync(privPath, 'utf8')))
    console.log(token)
  } else {
    console.log('Commands: keygen | issue  (see header of this file)')
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message)
    process.exitCode = 1
  })
}
