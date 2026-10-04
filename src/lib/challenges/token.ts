const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";

/** Short, unambiguous, unguessable token (10 chars ≈ 58 bits). */
export function challengeToken(length = 10): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function isChallengeToken(s: string): boolean {
  return /^[23456789a-km-zA-HJ-NP-Z]{6,16}$/.test(s);
}
