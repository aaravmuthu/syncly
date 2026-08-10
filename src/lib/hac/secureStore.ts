// Device-local data encryption using the Web Crypto API (AES-256-GCM).
// The data key is generated on-device and stored only in this browser. When the
// student sets a Master PIN / passphrase, the data key is wrapped with a
// PBKDF2-derived key and the plaintext copy is destroyed, so the local grade
// ledger cannot be read without the PIN. Nothing is ever sent to a server.

const KEY_NAME = "aurahac.devicekey.v1";
const WRAP_KEY = "aurahac.devicekey.wrapped.v1";
const PBKDF2_ROUNDS = 250_000;

let cached: CryptoKey | null = null;

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/** PBKDF2(passphrase) → AES-GCM 256 key. Used for PIN wrapping and backups. */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ROUNDS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function hasPin(): boolean {
  try {
    return !!localStorage.getItem(WRAP_KEY);
  } catch {
    return false;
  }
}

/** True when the vault can be read right now (no PIN, or already unlocked). */
export function isUnlocked(): boolean {
  return cached !== null || !hasPin();
}

async function getKey(): Promise<CryptoKey> {
  if (cached) return cached;
  if (hasPin()) throw new Error("LOCKED");
  const existing = localStorage.getItem(KEY_NAME);
  if (existing) {
    const jwk = JSON.parse(existing) as JsonWebKey;
    cached = await crypto.subtle.importKey("jwk", jwk, { name: "AES-GCM" }, true, [
      "encrypt",
      "decrypt",
    ]);
    return cached;
  }
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  localStorage.setItem(KEY_NAME, JSON.stringify(await crypto.subtle.exportKey("jwk", key)));
  cached = key;
  return key;
}

async function encryptWithKey(key: CryptoKey, obj: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.stringify({ v: 1, iv: b64(iv), ct: b64(new Uint8Array(ct)) });
}

async function decryptWithKey<T>(key: CryptoKey, s: string): Promise<T> {
  const parsed = JSON.parse(s) as { iv: string | number[]; ct: string | number[] };
  const iv = typeof parsed.iv === "string" ? unb64(parsed.iv) : new Uint8Array(parsed.iv);
  const ct = typeof parsed.ct === "string" ? unb64(parsed.ct) : new Uint8Array(parsed.ct);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ct as BufferSource);
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}

export async function encryptJSON(obj: unknown): Promise<string> {
  return encryptWithKey(await getKey(), obj);
}

export async function decryptJSON<T>(s: string): Promise<T> {
  return decryptWithKey<T>(await getKey(), s);
}

/* ---------------- Master PIN / passphrase ---------------- */

export async function setPin(pin: string): Promise<void> {
  const key = await getKey(); // requires currently-unlocked state
  const jwk = await crypto.subtle.exportKey("jwk", key);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const kek = await deriveKeyFromPassphrase(pin, salt);
  const wrapped = await encryptWithKey(kek, jwk);
  localStorage.setItem(WRAP_KEY, JSON.stringify({ salt: b64(salt), wrapped }));
  localStorage.removeItem(KEY_NAME);
  cached = key;
}

export async function unlockWithPin(pin: string): Promise<void> {
  const raw = localStorage.getItem(WRAP_KEY);
  if (!raw) return;
  const { salt, wrapped } = JSON.parse(raw) as { salt: string; wrapped: string };
  const kek = await deriveKeyFromPassphrase(pin, unb64(salt));
  const jwk = await decryptWithKey<JsonWebKey>(kek, wrapped);
  cached = await crypto.subtle.importKey("jwk", jwk, { name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function removePin(pin: string): Promise<void> {
  await unlockWithPin(pin);
  if (!cached) throw new Error("Incorrect PIN");
  const jwk = await crypto.subtle.exportKey("jwk", cached);
  localStorage.setItem(KEY_NAME, JSON.stringify(jwk));
  localStorage.removeItem(WRAP_KEY);
}

export function lockVault(): void {
  cached = null;
}

/* ---------------- Portable encrypted backups ---------------- */

export async function encryptForExport(obj: unknown, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKeyFromPassphrase(passphrase, salt);
  const payload = await encryptWithKey(key, obj);
  return JSON.stringify(
    { format: "aurahac-backup", version: 1, salt: b64(salt), payload },
    null,
    2,
  );
}

export async function decryptFromImport<T>(file: string, passphrase: string): Promise<T> {
  const parsed = JSON.parse(file) as { format?: string; salt: string; payload: string };
  if (parsed.format !== "aurahac-backup") throw new Error("Not an AuraHAC backup file");
  const key = await deriveKeyFromPassphrase(passphrase, unb64(parsed.salt));
  return decryptWithKey<T>(key, parsed.payload);
}
