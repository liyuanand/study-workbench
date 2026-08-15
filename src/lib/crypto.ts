function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

export function makeSalt(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(16)))
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return bytesToBase64(new Uint8Array(digest))
}

export async function verifyPin(pin: string, salt: string, expectedHash: string): Promise<boolean> {
  return (await hashPin(pin, salt)) === expectedHash
}
