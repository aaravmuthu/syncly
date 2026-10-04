// Server-only upload guards. Every upload handler runs its data URL through
// one of these so the stored object's type and extension come from the file's
// bytes, never from what the client said it was.
import { sniffAudio, sniffImage, type SniffedAudio, type SniffedImage } from "./file-sniff";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

/** Accepts `data:<mime>[;param=x]*;base64,<payload>`; recorders add `;codecs=…`. */
function decodeDataUrl(dataUrl: string): { declared: string; bytes: Uint8Array } | null {
  const m = /^data:([^;,]+)(?:;[^;,]+)*;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  return { declared: m[1]!.toLowerCase(), bytes: Buffer.from(m[2]!, "base64") };
}

/** Image upload: PNG, JPEG, GIF or WebP by magic bytes, within the size cap. */
export function parseImageUpload(dataUrl: string): {
  bytes: Uint8Array;
  contentType: SniffedImage["mime"];
  ext: SniffedImage["ext"];
} {
  const parsed = decodeDataUrl(dataUrl);
  if (!parsed) throw new Error("Unsupported image");
  if (parsed.bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("Image must be under 5 MB");
  const kind = sniffImage(parsed.bytes);
  if (!kind) throw new Error("Use a PNG, JPG, GIF, or WebP image");
  return { bytes: parsed.bytes, contentType: kind.mime, ext: kind.ext };
}

/** Voice-note upload: WebM or MP4 audio by magic bytes, within the size cap. */
export function parseVoiceUpload(dataUrl: string): {
  bytes: Uint8Array;
  contentType: SniffedAudio["mime"];
  ext: SniffedAudio["ext"];
} {
  const parsed = decodeDataUrl(dataUrl);
  if (!parsed) throw new Error("Unsupported recording");
  if (parsed.bytes.byteLength > MAX_AUDIO_BYTES) throw new Error("Voice note must be under 8 MB");
  const kind = sniffAudio(parsed.bytes);
  if (!kind) throw new Error("Voice notes must be WebM or MP4 audio");
  return { bytes: parsed.bytes, contentType: kind.mime, ext: kind.ext };
}

/**
 * A message may only attach a file the sender uploaded through our own upload
 * handlers: a signed URL on this project's storage, inside the sender's own
 * folder. Without this, any https URL could be stored and then loaded by every
 * recipient's browser (IP leak, off-platform content, tracking pixels).
 */
export function ownedMediaUrl(
  raw: string | null | undefined,
  userId: string,
  folder: "chat" | "voice",
): string | null {
  if (!raw) return null;
  const base = process.env["SB_URL"] || process.env["SUPABASE_URL"];
  if (!base) throw new Error("Attachments aren't available right now");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That attachment isn't allowed");
  }
  const prefix = `/storage/v1/object/sign/avatars/${userId}/${folder}/`;
  if (url.origin !== new URL(base).origin || !url.pathname.startsWith(prefix)) {
    throw new Error("That attachment isn't allowed");
  }
  return raw;
}
