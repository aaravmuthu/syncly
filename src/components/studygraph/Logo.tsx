export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="StudyGraph">
      <defs>
        <linearGradient id="sgLogo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--primary-glow)" />
        </linearGradient>
      </defs>
      <rect
        x="1"
        y="1"
        width="38"
        height="38"
        rx="11"
        fill="color-mix(in oklab, var(--primary) 14%, transparent)"
        stroke="color-mix(in oklab, var(--primary) 42%, transparent)"
      />
      <g stroke="url(#sgLogo)" strokeWidth="1.6" strokeLinecap="round">
        <line x1="12" y1="27" x2="20" y2="14" />
        <line x1="20" y1="14" x2="28" y2="24" />
        <line x1="12" y1="27" x2="28" y2="24" />
      </g>
      <g fill="url(#sgLogo)">
        <circle cx="20" cy="13" r="3.4" />
        <circle cx="12" cy="27" r="2.8" />
        <circle cx="28" cy="24" r="2.4" />
      </g>
    </svg>
  );
}
