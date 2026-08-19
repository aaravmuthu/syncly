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
 * Apple-style app icon: squircle tile, top-light gloss, radar rings and a
 * rounded "S" glyph. Same geometry as /icon.svg so the web mark and the
 * home-screen icon are identical.
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
        <linearGradient id="sy-tile" x1="0" y1="0" x2="0" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#34E5B0" />
          <stop offset="0.52" stopColor="#12B9A6" />
          <stop offset="1" stopColor="#0A83C8" />
        </linearGradient>
        <linearGradient id="sy-gloss" x1="256" y1="0" x2="256" y2="300" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.42" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path
        d="M256 0C97.6 0 32 20.9 32 106.7v298.6C32 491.1 97.6 512 256 512s224-20.9 224-106.7V106.7C480 20.9 414.4 0 256 0Z"
        fill="url(#sy-tile)"
      />
      <path
        d="M256 0C97.6 0 32 20.9 32 106.7v298.6C32 491.1 97.6 512 256 512s224-20.9 224-106.7V106.7C480 20.9 414.4 0 256 0Z"
        fill="url(#sy-gloss)"
      />

      <g fill="none" stroke="#ffffff" strokeLinecap="round">
        <circle cx="256" cy="256" r="176" strokeOpacity="0.16" strokeWidth="10" />
        <circle cx="256" cy="256" r="132" strokeOpacity="0.2" strokeWidth="8" />
      </g>

      <path
        d="M330 186c0-24.3-19.7-44-44-44h-56c-24.3 0-44 19.7-44 44s19.7 44 44 44h52c24.3 0 44 19.7 44 44s-19.7 44-44 44h-56c-24.3 0-44-19.7-44-44"
        stroke="#ffffff"
        strokeWidth="42"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="342" cy="166" r="26" fill="#ffffff" />
      <circle cx="342" cy="166" r="46" fill="none" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="10" />
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
