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
 * Simple app mark: solid primary squircle tile with a bold white "S" glyph
 * (same silhouette language as the previous lightning mark). Matches
 * /icon.svg so the web mark and the home-screen icon are identical.
 */
export function LogoMark({
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
        <linearGradient id="sy-tile" x1="96" y1="16" x2="416" y2="496" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3BE8B0" />
          <stop offset="0.45" stopColor="#12B48A" />
          <stop offset="1" stopColor="#046B57" />
        </linearGradient>
        <linearGradient id="sy-rim" x1="256" y1="8" x2="256" y2="504" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.35" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.28" />
        </linearGradient>
        <radialGradient id="sy-sheen" cx="0.28" cy="0.12" r="0.95">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sy-glyph" x1="180" y1="120" x2="330" y2="392" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#E3FFF6" />
        </linearGradient>
      </defs>

      <rect x="16" y="16" width="480" height="480" rx="112" fill="url(#sy-tile)" />
      <rect x="16" y="16" width="480" height="480" rx="112" fill="url(#sy-sheen)" />
      <rect x="17.5" y="17.5" width="477" height="477" rx="110.5" fill="none" stroke="url(#sy-rim)" strokeWidth="3" />

      <path
        d="M325 176c-13.5-22-38-34.5-69-34.5-40 0-67.5 20.5-67.5 51.5 0 29 22.5 42.5 63 52.5 45 11 76 26.5 76 62.5 0 38-34 63.5-81 63.5-35.5 0-63-13.5-79-38.5"
        fill="none"
        stroke="url(#sy-glyph)"
        strokeWidth="34"
        strokeLinecap="round"
      />
    </svg>
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
          className={cn("ml-2.5 font-display font-semibold tracking-tight text-foreground", s.text)}
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
