export function generateKeyPair(): Promise<{ privateJwk: JsonWebKey; publicJwk: JsonWebKey }>
export function signLicense(
  opts: { id: string; email?: string; days?: number; nowMs?: number; expSeconds?: number },
  privateJwk: JsonWebKey,
): Promise<string>
