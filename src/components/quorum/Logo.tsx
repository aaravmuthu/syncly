import { motion } from "motion/react";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  href?: string;
  onClick?: () => void;
};

const sizes = {
  sm: { icon: 28, text: "text-base" },
  md: { icon: 36, text: "text-lg" },
  lg: { icon: 44, text: "text-xl" },
};

/**
 * App mark (dark): dark glass squircle with a glowing emerald rounded "S" and a
 * radar pulse at its core. Matches /icon.svg exactly.
 */
export function LogoMarkDark({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 drop-shadow-[0_6px_18px_rgba(16,185,129,0.35)]", className)}
      role="img"
      aria-label={`${BRAND.name} logo`}
    >
      <defs>
        <linearGradient id="sy-tile" x1="120" y1="24" x2="400" y2="488" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2A3A38" />
          <stop offset="0.45" stopColor="#151E1D" />
          <stop offset="1" stopColor="#080D0C" />
        </linearGradient>
        <linearGradient id="sy-rim" x1="256" y1="8" x2="256" y2="504" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7FFFD8" stopOpacity="0.4" />
          <stop offset="0.4" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.35" />
        </linearGradient>
        <radialGradient id="sy-sheen" cx="0.3" cy="0.1" r="0.95">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity="0.02" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sy-glyph" x1="180" y1="130" x2="340" y2="390" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8CFFDD" />
          <stop offset="0.5" stopColor="#2FE0A8" />
          <stop offset="1" stopColor="#0E9C77" />
        </linearGradient>
        <filter id="sy-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="14" result="b" />
          <feColorMatrix
            in="b"
            type="matrix"
            values="0 0 0 0 0.18  0 0 0 0 0.95 0 0 0 0 0.70  0 0 0 0.85 0"
            result="g"
          />
          <feMerge>
            <feMergeNode in="g" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x="16" y="16" width="480" height="480" rx="116" fill="url(#sy-tile)" />
      <rect x="16" y="16" width="480" height="480" rx="116" fill="url(#sy-sheen)" />
      <rect x="17.5" y="17.5" width="477" height="477" rx="114.5" fill="none" stroke="url(#sy-rim)" strokeWidth="3" />

      <g stroke="#2FE0A8" fill="none" opacity="0.28">
        <circle cx="256" cy="256" r="46" strokeWidth="6" />
        <circle cx="256" cy="256" r="78" strokeWidth="5" opacity="0.6" />
        <circle cx="256" cy="256" r="110" strokeWidth="4" opacity="0.3" />
      </g>

      <g filter="url(#sy-glow)">
        <path
          d="M352 150 H236 C172 150 172 256 236 256 H278 C342 256 342 362 278 362 H162"
          fill="none"
          stroke="url(#sy-glyph)"
          strokeWidth="58"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="256" cy="256" r="21" fill="#EAFFF7" />
      </g>
    </svg>
  );
}

/**
 * App mark (light): pearl-glass squircle with the same emerald "S" + radar core,
 * tuned for light backgrounds. Matches /icon-light.svg.
 */
export function LogoMarkLight({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 drop-shadow-[0_6px_16px_rgba(6,95,70,0.18)]", className)}
      role="img"
      aria-label={`${BRAND.name} logo`}
    >
      <defs>
        <linearGradient id="syl-tile" x1="120" y1="24" x2="400" y2="488" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.5" stopColor="#F0F7F4" />
          <stop offset="1" stopColor="#DCE9E4" />
        </linearGradient>
        <linearGradient id="syl-rim" x1="256" y1="8" x2="256" y2="504" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="0.45" stopColor="#0E9C77" stopOpacity="0.12" />
          <stop offset="1" stopColor="#04564A" stopOpacity="0.22" />
        </linearGradient>
        <radialGradient id="syl-sheen" cx="0.3" cy="0.08" r="0.95">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0.1" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="syl-glyph" x1="180" y1="130" x2="340" y2="390" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2FD3A0" />
          <stop offset="0.5" stopColor="#0FA97F" />
          <stop offset="1" stopColor="#046B57" />
        </linearGradient>
        <filter id="syl-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="6" stdDeviation="9" floodColor="#04564A" floodOpacity="0.22" />
        </filter>
      </defs>

      <rect x="16" y="16" width="480" height="480" rx="116" fill="url(#syl-tile)" />
      <rect x="16" y="16" width="480" height="480" rx="116" fill="url(#syl-sheen)" />
      <rect x="17.5" y="17.5" width="477" height="477" rx="114.5" fill="none" stroke="url(#syl-rim)" strokeWidth="3" />

      <g stroke="#0FA97F" fill="none" opacity="0.22">
        <circle cx="256" cy="256" r="46" strokeWidth="6" />
        <circle cx="256" cy="256" r="78" strokeWidth="5" opacity="0.6" />
        <circle cx="256" cy="256" r="110" strokeWidth="4" opacity="0.3" />
      </g>

      <g filter="url(#syl-shadow)">
        <path
          d="M352 150 H236 C172 150 172 256 236 256 H278 C342 256 342 362 278 362 H162"
          fill="none"
          stroke="url(#syl-glyph)"
          strokeWidth="58"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="256" cy="256" r="21" fill="#FFFFFF" />
        <circle cx="256" cy="256" r="21" fill="none" stroke="#0FA97F" strokeWidth="4" opacity="0.5" />
      </g>
    </svg>
  );
}

/** Theme-aware mark: light squircle on light mode, dark glass on dark mode. */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <>
      <LogoMarkLight size={size} className={cn("dark:hidden", className)} />
      <LogoMarkDark size={size} className={cn("hidden dark:block", className)} />
    </>
  );
}

export function Logo({ className, size = "md", showText = true, href, onClick }: LogoProps) {
  const s = sizes[size];
  const sharedMotion = {
    whileHover: { scale: 1.06, transition: { type: "spring" as const, stiffness: 260, damping: 16 } },
    whileTap: { scale: 0.96 },
  };

  const logoBody = (
    <>
      <LogoMark size={s.icon} className="rounded-[22%]" />
      {showText ? (
        <span
          className={cn("ml-2.5 font-brand tracking-[-0.01em] text-foreground", s.text)}
        >
          {BRAND.name}
        </span>
      ) : null}
    </>
  );

  const classes = cn("group inline-flex select-none items-center justify-center", className);

  if (href) {
    return (
      <motion.a href={href} className={classes} {...sharedMotion}>
        {logoBody}
      </motion.a>
    );
  }

  return (
    <motion.span className={cn(classes, onClick && "cursor-pointer")} onClick={onClick} {...sharedMotion}>
      {logoBody}
    </motion.span>
  );
}
