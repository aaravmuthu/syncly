import { motion } from "motion/react";
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

export function Logo({ className, size = "md", showText = true, href, onClick }: LogoProps) {
  const s = sizes[size];
  const sharedMotion = {
    whileHover: { scale: 1.06, transition: { type: "spring", stiffness: 260, damping: 16 } },
    whileTap: { scale: 0.96 },
  };

  const logoBody = (
    <>
      <span className="relative inline-flex items-center justify-center">
        {/* Frosted glass disc behind the icon */}
        <span
          className="absolute inset-0 rounded-[22%]"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.55 0.18 165 / 0.22), oklch(0.62 0.2 195 / 0.18))",
            filter: "blur(8px)",
            opacity: 0.85,
          }}
        />
        <svg
          width={s.icon}
          height={s.icon}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10"
          aria-label="Syncly logo"
        >
          <defs>
            <linearGradient id="syncly-surface" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="oklch(0.72 0.13 160)" />
              <stop offset="1" stopColor="oklch(0.62 0.16 195)" />
            </linearGradient>
            <linearGradient id="syncly-glow" x1="24" y1="0" x2="24" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="oklch(0.72 0.13 160)" stopOpacity="0.9" />
              <stop offset="0.55" stopColor="oklch(0.66 0.15 178)" stopOpacity="0.5" />
              <stop offset="1" stopColor="oklch(0.62 0.16 195)" stopOpacity="0" />
            </linearGradient>
            <filter id="syncly-bloom" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Radar pulse ring — outer halo */}
          <circle cx="24" cy="24" r="22" fill="url(#syncly-glow)" opacity="0.28" />
          <circle
            cx="24"
            cy="24"
            r="22"
            fill="none"
            stroke="oklch(0.72 0.13 160 / 0.6)"
            strokeWidth="1.2"
            strokeDasharray="4 3"
            opacity="0.55"
          />
          <circle
            cx="24"
            cy="24"
            r="18.5"
            fill="none"
            stroke="oklch(0.66 0.14 178 / 0.55)"
            strokeWidth="1"
            opacity="0.45"
          />

          {/* Frosted glass backing for the S mark */}
          <rect
            x="7"
            y="7"
            width="34"
            height="34"
            rx="10"
            fill="oklch(0.16 0.004 270 / 0.45)"
            style={{ backdropFilter: "blur(6px)" }}
          />
          <rect
            x="7"
            y="7"
            width="34"
            height="34"
            rx="10"
            fill="url(#syncly-surface)"
            opacity="0.12"
          />
          <rect
            x="7.5"
            y="7.5"
            width="33"
            height="33"
            rx="9.5"
            fill="none"
            stroke="oklch(0.72 0.13 160 / 0.35)"
            strokeWidth="0.8"
          />

          {/* Abstract rounded S merged with a radar sweep */}
          <path
            d="M31 17.5C31 15.57 29.43 14 27.5 14H20.5C18.57 14 17 15.57 17 17.5V20.5C17 22.43 18.57 24 20.5 24H27.5C29.43 24 31 25.57 31 27.5V30.5C31 32.43 29.43 34 27.5 34H20.5C18.57 34 17 32.43 17 30.5"
            fill="none"
            stroke="url(#syncly-surface)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#syncly-bloom)"
          />
          <path
            d="M31 17.5C31 15.57 29.43 14 27.5 14H20.5C18.57 14 17 15.57 17 17.5V20.5C17 22.43 18.57 24 20.5 24H27.5C29.43 24 31 25.57 31 27.5V30.5C31 32.43 29.43 34 27.5 34H20.5C18.57 34 17 32.43 17 30.5"
            fill="none"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.95"
          />

          {/* Radar sweep dot at the top-right of the S */}
          <circle cx="31" cy="16" r="2.2" fill="white" filter="url(#syncly-bloom)" />
        </svg>
      </span>

      {showText ? (
        <span
          className={cn(
            "ml-2.5 font-semibold tracking-tight text-foreground",
            s.text,
          )}
          style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro', system-ui, sans-serif" }}
        >
          Syncly
        </span>
      ) : null}
    </>
  );

  const classes = cn(
    "group inline-flex select-none items-center justify-center",
    className,
  );

  if (href) {
    return (
      <motion.a
        href={href}
        className={classes}
        {...sharedMotion}
      >
        {logoBody}
      </motion.a>
    );
  }

  return (
    <motion.span
      className={cn(classes, onClick && "cursor-pointer")}
      onClick={onClick}
      {...sharedMotion}
    >
      {logoBody}
    </motion.span>
  );
}
