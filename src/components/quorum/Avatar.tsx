import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Member avatar. Renders the uploaded image (animated GIF/WebP play natively)
 * and falls back to the emoji when there is no image or it fails to load.
 */
export function Avatar({
  url,
  emoji,
  name,
  className,
  size = 32,
}: {
  url?: string | null;
  emoji?: string | null;
  name?: string | null;
  className?: string;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(url) && !broken;

  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-secondary",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.55) }}
    >
      {showImage ? (
        <img
          src={url as string}
          alt={name ? `${name}'s avatar` : "Member avatar"}
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
          loading="lazy"
          decoding="async"
          width={size}
          height={size}
        />
      ) : (
        <span aria-hidden>{emoji ?? "🙂"}</span>
      )}
    </span>
  );
}
