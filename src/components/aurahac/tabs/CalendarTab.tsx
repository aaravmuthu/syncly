import { useMemo, useState } from "react";
import { useHac } from "@/lib/hac/store";
import { ChevronLeft, ChevronRight } from "lucide-react";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CalendarTab() {
  const { data } = useHac();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, { course: string; name: string; category: string; missing: boolean; absent: boolean; score: number | null; total: number | null }[]>();
    if (!data) return map;
    for (const c of data.courses) {
      for (const a of c.assignments) {
        if (!a.dueDate) continue;
        const arr = map.get(a.dueDate) ?? [];
        arr.push({
          course: c.name,
          name: a.name,
          category: a.category,
          missing: a.missing,
          absent: a.absent,
          score: a.score,
          total: a.totalPoints,
        });
        map.set(a.dueDate, arr);
      }
    }
    return map;
  }, [data]);

  const monthName = cursor.toLocaleString("default", { month: "long", year: "numeric" });
  const startDow = cursor.getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));

  const selectedItems = selected ? byDate.get(selected) ?? [] : [];

  return (
    <div className="space-y-4 pb-32">
      <header className="flex items-center justify-between pt-2">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Synced Calendar</div>
          <h1 className="text-xl font-bold tracking-tight">{monthName}</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="glass h-9 w-9 grid place-items-center active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="glass h-9 w-9 grid place-items-center active:scale-95"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="glass p-3">
        <div className="grid grid-cols-7 text-center text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="aspect-square" />;
            const key = ymd(d);
            const items = byDate.get(key) ?? [];
            const isSelected = key === selected;
            const isToday = key === ymd(new Date());
            const hasSum = items.some((x) => x.category === "Summative");
            const hasForm = items.some((x) => x.category === "Formative");
            const hasMiss = items.some((x) => x.missing || x.absent);
            return (
              <button
                key={i}
                onClick={() => setSelected(key)}
                className={`aspect-square rounded-xl text-sm font-medium flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
                  isSelected
                    ? "bg-primary/30 border border-primary/40"
                    : isToday
                      ? "border border-primary/60"
                      : "hover:bg-white/[0.04]"
                }`}
              >
                <span className="tabular-nums">{d.getDate()}</span>
                <div className="flex gap-0.5 h-1">
                  {hasSum ? <span className="h-1 w-1 rounded-full bg-primary shadow-[0_0_6px_var(--primary)]" /> : null}
                  {hasForm ? <span className="h-1 w-1 rounded-full bg-sky-400 shadow-[0_0_6px_#38bdf8]" /> : null}
                  {hasMiss ? <span className="h-1 w-1 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" /> : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="glass-strong p-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
          {selected ? `Due on ${selected}` : "Select a day"}
        </div>
        {selectedItems.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            {selected ? "Nothing due on this day." : "Tap any day to view assignments."}
          </div>
        ) : (
          <div className="space-y-2">
            {selectedItems.map((it, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span
                  className={`h-2 w-2 mt-2 rounded-full ${
                    it.missing || it.absent
                      ? "bg-red-500 shadow-[0_0_8px_#ef4444]"
                      : it.category === "Summative"
                        ? "bg-primary shadow-[0_0_8px_var(--primary)]"
                        : "bg-sky-400 shadow-[0_0_8px_#38bdf8]"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{it.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{it.course}</div>
                </div>
                <div className="text-xs tabular-nums text-muted-foreground">
                  {it.score !== null && it.total ? `${it.score}/${it.total}` : it.category}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}