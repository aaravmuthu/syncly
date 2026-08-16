const BRANDS = [
  "Google Maps",
  "OpenStreetMap",
  "Uber",
  "Lyft",
  "Venmo",
  "Cash App",
  "Supabase",
  "Apple Pay",
];

export function WorksWithMarquee() {
  const row = [...BRANDS, ...BRANDS];
  return (
    <section className="border-y border-border/70 py-8">
      <p className="mx-auto max-w-6xl px-5 text-center text-[11px] font-semibold tracking-[0.2em] text-muted-foreground">
        WORKS WITH THE TOOLS &amp; PLACES YOU ALREADY USE
      </p>
      <div className="marquee mt-5 group">
        <div className="marquee-track">
          {row.map((b, i) => (
            <span
              key={`${b}-${i}`}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-4 py-2 text-sm font-medium text-muted-foreground grayscale"
            >
              <span className="size-1.5 rounded-full bg-current opacity-60" />
              {b}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
