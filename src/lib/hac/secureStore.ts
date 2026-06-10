// Device-local credential encryption using the Web Crypto API (AES-GCM).
// The encryption key is generated on-device and stored only in this browser's
// localStorage. Credentials are NEVER sent to or stored on any external
// database — they live encrypted on the device and are only decrypted in memory
// to sync directly with the school district's HAC portal.

const KEY_NAME = "aurahac.devicekey.v1";

async function getKey(): Promise<CryptoKey> {
  const existing = localStorage.getItem(KEY_NAME);
  if (existing) {
    const jwk = JSON.parse(existing) as JsonWebKey;
    return crypto.subtle.importKey("jwk", jwk, { name: "AES-GCM" }, true, [
      "encrypt",
      "decrypt",
    ]);
  }
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const jwk = await crypto.subtle.exportKey("jwk", key);
  localStorage.setItem(KEY_NAME, JSON.stringify(jwk));
  return key;
}

export async function encryptJSON(obj: unknown): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.stringify({ iv: Array.from(iv), ct: Array.from(new Uint8Array(ct)) });
}

export async function decryptJSON<T>(s: string): Promise<T> {
  const key = await getKey();
  const parsed = JSON.parse(s) as { iv: number[]; ct: number[] };
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(parsed.iv) },
    key,
    new Uint8Array(parsed.ct),
  );
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}
