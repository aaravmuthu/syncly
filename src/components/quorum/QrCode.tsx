import { useEffect, useState } from "react";

/** Renders a QR code for a URL, generated entirely client-side. */
export function QrCode({ value, size = 220 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const QR = await import("qrcode");
      const url = await QR.toDataURL(value, {
        width: size,
        margin: 1,
        color: { dark: "#1c1917", light: "#ffffff" },
      });
      if (!cancelled) setSrc(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  return (
    <div
      className="grid place-items-center overflow-hidden rounded-2xl bg-white p-3"
      style={{ width: size + 24, height: size + 24 }}
    >
      {src ? (
        <img src={src} alt={`QR code linking to ${value}`} width={size} height={size} />
      ) : (
        <span className="text-xs text-stone-500">Generating…</span>
      )}
    </div>
  );
}
