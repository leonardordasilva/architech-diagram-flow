// Shared crypto helpers for Edge Functions
// Used by: diagram-crypto, save-diagram, backfill-encryption

export function uint8ToBase64(buf: Uint8Array): string {
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < buf.length; i += CHUNK) {
    const slice = buf.subarray(i, i + CHUNK);
    for (let j = 0; j < slice.length; j++) {
      binary += String.fromCharCode(slice[j]);
    }
  }
  return btoa(binary);
}

export function getKeyBytes(): Uint8Array {
  const raw = Deno.env.get("DIAGRAM_ENCRYPTION_KEY");
  if (!raw) throw new Error("DIAGRAM_ENCRYPTION_KEY not configured");
  const decoded = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  if (decoded.length !== 32) throw new Error("DIAGRAM_ENCRYPTION_KEY must be 32 bytes (Base64-encoded)");
  return decoded;
}

/** Import key for encrypt-only operations */
export async function importKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", keyBytes.buffer as ArrayBuffer, "AES-GCM", false, ["encrypt"]);
}

/** Import key for encrypt+decrypt operations */
export async function importKeyForDecrypt(keyBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", keyBytes.buffer as ArrayBuffer, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encrypt(
  plainJson: unknown,
  key: CryptoKey,
): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(plainJson));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return { iv: uint8ToBase64(iv), ciphertext: uint8ToBase64(new Uint8Array(encrypted)) };
}

export async function decrypt(
  payload: { iv: string; ciphertext: string },
  key: CryptoKey,
): Promise<unknown> {
  const iv = Uint8Array.from(atob(payload.iv), (c) => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(payload.ciphertext), (c) => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

export function isEncrypted(value: unknown): value is { iv: string; ciphertext: string } {
  return typeof value === "object" && value !== null && "iv" in value && "ciphertext" in value;
}

export async function computeContentHash(nodes: unknown[], edges: unknown[]): Promise<string> {
  const payload = JSON.stringify({ nodes, edges });
  const encoded = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
