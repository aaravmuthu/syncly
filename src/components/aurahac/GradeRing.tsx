interface Props {
  value: number | null;
  size?: number;
  label?: string;
}

export function GradeRing({ value, size = 200, label }: Props) {
  const v = value ?? 0;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, v)) / 100;
  const offset = c * (1 - pct);
  const color =
    v >= 90 ? "var(--success)" : v >= 80 ? "var(--primary)" : v >= 70 ? "var(--warning)" : "var(--destructive)";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="oklch(1 0 0 / 0.06)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms ease, stroke 300ms ease", filter: `drop-shadow(0 0 14px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-5xl font-bold tabular-nums" style={{ color }}>
          {value !== null ? value.toFixed(1) : "—"}
        </div>
        {label ? <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{label}</div> : null}
      </div>
    </div>
  );
}