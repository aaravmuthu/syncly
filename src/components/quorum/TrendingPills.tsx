import { useState } from "react";

const TRENDING = ["DINNER", "CONCERTS", "RECREATION", "MOVIES", "ROAD TRIPS", "GAME NIGHT"];

export function TrendingPills() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-5 py-6">
      <span className="mr-1 w-full text-[13px] font-semibold tracking-[0.16em] text-muted-foreground sm:w-auto sm:text-xs sm:tracking-[0.18em]">
        TRENDING:
      </span>
      {TRENDING.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setActive((p) => (p === t ? null : t))}
          className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm sm:min-h-8 sm:px-3.5 sm:text-xs font-semibold tracking-wide transition-colors ${
            active === t
              ? "border-primary/40 bg-primary/15 text-primary"
              : "border-foreground/10 bg-foreground/5 text-muted-foreground hover:border-foreground/25 hover:bg-foreground/10 hover:text-foreground"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
