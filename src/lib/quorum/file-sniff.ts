// Magic-byte sniffing shared by the browser (reject early, friendly message)
// and the server (the check that actually counts). A data URL's declared MIME
// type and a file's extension are both just claims from the sender; the first
// few bytes are what the file really is.

export type SniffedImage = {
  mime: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  ext: "png" | "jpg" | "gif" | "webp";
};
export type SniffedAudio = { mime: "audio/webm" | "audio/mp4"; ext: "webm" | "m4a" };

/** How many leading bytes the sniffers need. */
export const SNIFF_BYTES = 16;

const startsWith = (b: Uint8Array, sig: number[], at = 0) =>
  b.length >= at + sig.length && sig.every((x, i) => b[at + i] === x);

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

export function sniffImage(b: Uint8Array): SniffedImage | null {
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", ext: "png" };
  }
  if (startsWith(b, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (startsWith(b, ascii("GIF87a")) || startsWith(b, ascii("GIF89a"))) {
    return { mime: "image/gif", ext: "gif" };
  }
  if (startsWith(b, ascii("RIFF")) && startsWith(b, ascii("WEBP"), 8)) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

/** Voice notes: MediaRecorder gives WebM (Chrome/Firefox) or MP4 (Safari). */
export function sniffAudio(b: Uint8Array): SniffedAudio | null {
  if (startsWith(b, [0x1a, 0x45, 0xdf, 0xa3])) return { mime: "audio/webm", ext: "webm" };
  if (startsWith(b, ascii("ftyp"), 4)) return { mime: "audio/mp4", ext: "m4a" };
  return null;
}
