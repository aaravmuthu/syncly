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
      <rect x="8" y="8" width="496" height="496" rx="115" fill="#10B981" />
      <path
        d="M332 168c-14-22-40-34-72-34-42 0-72 22-72 56 0 32 26 46 66 56 44 11 74 26 74 62 0 38-34 62-80 62-36 0-64-13-80-38"
        stroke="#ffffff"
        strokeWidth="46"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
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
