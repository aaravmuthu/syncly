// Browser-side upload preparation. The server re-checks everything; this
// exists to fail fast with a readable message and to strip what shouldn't
// leave the phone (EXIF location, camera serials) before a photo is sent.
import { SNIFF_BYTES, sniffAudio, sniffImage } from "./file-sniff";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Chat photos never need to be bigger than a retina phone screen. */
const MAX_EDGE = 2048;

const headBytes = async (blob: Blob) =>
  new Uint8Array(await blob.slice(0, SNIFF_BYTES).arrayBuffer());

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("Could not read that file"));
    fr.readAsDataURL(blob);
  });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Validates a picked image by its bytes and re-encodes JPEG/PNG through a
 * canvas, which drops EXIF/GPS metadata and anything appended to the file.
 * GIF and WebP are sent as-is (a canvas would flatten the animation).
 */
export async function prepareImageUpload(file: File): Promise<{ dataUrl: string; ext: string }> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image must be under 5 MB");
  const kind = sniffImage(await headBytes(file));
  if (!kind) throw new Error("Use a PNG, JPG, GIF, or WebP image");

  if (kind.mime === "image/gif" || kind.mime === "image/webp") {
    return { dataUrl: await toDataUrl(file), ext: kind.ext };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("That file isn't a valid image");
  }
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process that image");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const out = await canvasToBlob(
      canvas,
      kind.mime,
      kind.mime === "image/jpeg" ? 0.88 : undefined,
    );
    if (!out || out.size > MAX_IMAGE_BYTES) throw new Error("Image must be under 5 MB");
    // Trust what actually came out of the canvas, not what we asked for.
    const encoded = sniffImage(await headBytes(out));
    if (!encoded) throw new Error("Could not process that image");
    return { dataUrl: await toDataUrl(out), ext: encoded.ext };
  } finally {
    bitmap.close();
  }
}

/** Validates a finished recording and returns it as a data URL. */
export async function prepareVoiceUpload(blob: Blob): Promise<string> {
  const kind = sniffAudio(await headBytes(blob));
  if (!kind) throw new Error("That recording isn't a supported audio format");
  // Re-label with the bare type: `audio/webm;codecs=opus` would put a codecs
  // parameter into the data URL.
  return toDataUrl(new Blob([blob], { type: kind.mime }));
}
