import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useHac } from "@/lib/hac/store";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import type { Assignment } from "@/lib/hac/types";

/* ---------------- date helpers ---------------- */

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Local YYYY-MM-DD key. */
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Parse the loose HAC date strings (MM/DD/YYYY or YYYY-MM-DD) into a local Date. */
function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return new Date(+mdy[3], +mdy[1] - 1, +mdy[2]);
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/* ---------------- domain typing ---------------- */

type Kind = "assessment" | "progress" | "missing";

interface CalItem {
  key: string; // completion key
  course: string;
  courseId: string;
  name: string;
  category: string;
  weight: number | null;
  score: number | null;
  total: number | null;
  kind: Kind;
}

function classify(a: Assignment): Kind {
  if (a.missing || a.absent) return "missing";
  if (a.category === "Assessment" || a.category === "Summative") return "assessment";
  return "progress";
}

function kindColor(kind: Kind) {
  if (kind === "missing") return "var(--destructive)";
  if (kind === "assessment") return "var(--primary)"; // electric purple
  return "var(--chart-2)"; // neon blue
}

const DONE_COLOR = "oklch(0.72 0.15 155)"; // muted green

const EXAM_RE = /exam|test|final|assessment|midterm|eoy|end of year|unit/i;

/* ---------------- component ---------------- */

export function CalendarTab() {
  const { data, completed, toggleCompleted } = useHac();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<string | null>(() => ymd(new Date()));
  const [view, setView] = useState<"month" | "week">("month");

  // Map every dated assignment onto its YYYY-MM-DD bucket.
  const byDate = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    if (!data) return map;
    for (const c of data.courses) {
      for (const a of c.assignments) {
        const d = parseDate(a.dueDate);
        if (!d) continue;
        const key = ymd(d);
        const arr = map.get(key) ?? [];
        arr.push({
          key: `${c.id}::${a.name}::${a.dueDate}`,
          course: c.name,
          courseId: c.id,
          name: a.name,
          category: a.category,
          weight: a.totalPoints,
          score: a.score,
          total: a.totalPoints,
          kind: classify(a),
        });
        map.set(key, arr);
      }
    }
    return map;
  }, [data]);

  // Recommended prep windows: 2 days before any major exam-like assessment.
  const prepDays = useMemo(() => {
    const set = new Set<string>();
    for (const [dateKey, items] of byDate) {
      const isExamDay = items.some(
        (it) => it.kind === "assessment" && EXAM_RE.test(it.name),
      );
      if (!isExamDay) continue;
      const base = parseDate(dateKey);
      if (!base) continue;
      set.add(ymd(addDays(base, -1)));
      set.add(ymd(addDays(base, -2)));
    }
    return set;
  }, [byDate]);

  const monthName = cursor.toLocaleString("default", { month: "long", year: "numeric" });
  const todayKey = ymd(new Date());

  // Month grid cells.
  const startDow = cursor.getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));

  // Week list: dated days within the visible month that have items, sorted.
  const weekList = useMemo(() => {
    const out: { key: string; date: Date; items: CalItem[] }[] = [];
    for (const [key, items] of byDate) {
      const d = parseDate(key);
      if (!d) continue;
      if (d.getMonth() !== cursor.getMonth() || d.getFullYear() !== cursor.getFullYear()) continue;
      out.push({ key, date: d, items });
    }
    out.sort((a, b) => a.date.getTime() - b.date.getTime());
    return out;
  }, [byDate, cursor]);

  const selectedItems = selected ? byDate.get(selected) ?? [] : [];
  const selectedLabel = selected
    ? (parseDate(selected) ?? new Date()).toLocaleDateString("default", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="space-y-4 pb-40">
      <header className="flex items-center justify-between pt-2">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Academic Calendar</div>
          <h1 className="text-2xl font-bold tracking-tight">{monthName}</h1>
        </div>
        <div className="flex items-center gap-2">
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

      {/* View toggle */}
      <div className="glass p-1 flex items-center gap-1 rounded-2xl w-fit">
        {(["month", "week"] as const).map((v) => {
          const active = view === v;
          return (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`relative px-4 py-1.5 text-sm font-medium rounded-xl transition-colors ${
                active ? "text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="cal-view-pill"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: "var(--primary)" }}
                  transition={{ type: "spring", stiffness: 480, damping: 34 }}
                />
              ) : null}
              <span className="relative z-10">{v === "month" ? "Month View" : "Week List"}</span>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground px-1">
        <Legend color="var(--primary)" label="Assessment" />
        <Legend color="var(--chart-2)" label="Progress Check" />
        <Legend color="var(--destructive)" label="Missing" pulse />
        <Legend color={DONE_COLOR} label="Done" />
      </div>

      <AnimatePresence mode="wait">
        {view === "month" ? (
          <motion.div
            key="month"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className="glass p-3"
          >
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
                const isToday = key === todayKey;
                const isPrep = prepDays.has(key);
                return (
                  <motion.button
                    key={key}
                    onClick={() => setSelected(key)}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.008, 0.2), type: "spring", stiffness: 420, damping: 30 }}
                    whileTap={{ scale: 0.92 }}
                    className="relative aspect-square rounded-xl p-1 flex flex-col items-stretch overflow-hidden"
                    style={{
                      background: isSelected
                        ? "color-mix(in oklab, var(--primary) 26%, transparent)"
                        : isPrep
                          ? "color-mix(in oklab, var(--primary) 12%, transparent)"
                          : "transparent",
                      border: isToday
                        ? "1px solid color-mix(in oklab, var(--primary) 80%, transparent)"
                        : isSelected
                          ? "1px solid color-mix(in oklab, var(--primary) 50%, transparent)"
                          : "1px solid transparent",
                      boxShadow: isToday
                        ? "0 0 16px -2px color-mix(in oklab, var(--primary) 70%, transparent), inset 0 0 12px -6px color-mix(in oklab, var(--primary) 80%, transparent)"
                        : "none",
                    }}
                  >
                    <span className="text-[11px] font-semibold tabular-nums self-start leading-none pt-0.5 pl-0.5">
                      {d.getDate()}
                    </span>
                    {isPrep ? (
                      <span className="absolute top-1 right-1 text-[9px] leading-none" title="Recommended Prep Window">
                        💡
                      </span>
                    ) : null}
                    <div className="mt-auto flex flex-col gap-0.5 items-stretch">
                      {items.slice(0, 3).map((it) => {
                        const done = !!completed[it.key];
                        const color = done ? DONE_COLOR : kindColor(it.kind);
                        return (
                          <span
                            key={it.key}
                            className={`h-1.5 rounded-full ${it.kind === "missing" && !done ? "pulse-coral" : ""}`}
                            style={{
                              background: color,
                              boxShadow: `0 0 6px ${color}`,
                            }}
                          />
                        );
                      })}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="week"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className="space-y-2"
          >
            {weekList.length === 0 ? (
              <div className="glass p-6 text-center text-sm text-muted-foreground">
                Nothing scheduled this month.
              </div>
            ) : (
              weekList.map((row, idx) => (
                <motion.button
                  key={row.key}
                  onClick={() => {
                    setSelected(row.key);
                    setView("month");
                  }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03, type: "spring", stiffness: 400, damping: 28 }}
                  className="glass w-full p-3 flex items-center gap-3 text-left active:scale-[0.99]"
                >
                  <div className="text-center w-10 shrink-0">
                    <div className="text-[10px] uppercase text-muted-foreground">
                      {row.date.toLocaleDateString("default", { weekday: "short" })}
                    </div>
                    <div className="text-lg font-bold tabular-nums leading-none">{row.date.getDate()}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {row.items.length} item{row.items.length > 1 ? "s" : ""}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {row.items.map((i) => i.name).join(" · ")}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {row.items.slice(0, 4).map((it) => {
                      const color = completed[it.key] ? DONE_COLOR : kindColor(it.kind);
                      return (
                        <span
                          key={it.key}
                          className="h-2 w-2 rounded-full"
                          style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                        />
                      );
                    })}
                  </div>
                </motion.button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Day Agenda detail sheet */}
      <motion.div layout className="glass-strong p-4 rounded-2xl" style={{ backdropFilter: "blur(12px)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {selectedLabel ? `Day Agenda · ${selectedLabel}` : "Select a day"}
          </div>
          {prepDays.has(selected ?? "") ? (
            <span className="text-[10px] font-medium text-primary">💡 Recommended Prep Window</span>
          ) : null}
        </div>
        <AnimatePresence mode="popLayout">
          {selectedItems.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm text-muted-foreground py-6 text-center"
            >
              {selected ? "Nothing scheduled on this day." : "Tap any day to view its agenda."}
            </motion.div>
          ) : (
            <div className="space-y-2">
              {selectedItems.map((it) => {
                const done = !!completed[it.key];
                return (
                  <motion.div
                    key={it.key}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                  >
                    <button
                      onClick={() => toggleCompleted(it.key)}
                      className="relative h-6 w-6 shrink-0 rounded-full grid place-items-center transition-colors"
                      style={{
                        border: `2px solid ${done ? DONE_COLOR : "color-mix(in oklab, var(--primary) 50%, transparent)"}`,
                        background: done ? DONE_COLOR : "transparent",
                      }}
                      aria-label={done ? "Mark incomplete" : "Mark complete"}
                    >
                      <AnimatePresence>
                        {done ? (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 26 }}
                          >
                            <Check className="h-3.5 w-3.5 text-background" strokeWidth={3} />
                          </motion.span>
                        ) : null}
                      </AnimatePresence>
                    </button>
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${it.kind === "missing" && !done ? "pulse-coral" : ""}`}
                      style={{
                        background: done ? DONE_COLOR : kindColor(it.kind),
                        boxShadow: `0 0 8px ${done ? DONE_COLOR : kindColor(it.kind)}`,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate transition-all ${done ? "line-through text-muted-foreground" : ""}`}>
                        {it.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {it.course} · {it.category}
                      </div>
                    </div>
                    <div className="text-xs tabular-nums text-muted-foreground shrink-0">
                      {it.score !== null && it.total ? `${it.score}/${it.total}` : it.total ? `${it.total} pts` : ""}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function Legend({ color, label, pulse }: { color: string; label: string; pulse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`h-2 w-2 rounded-full ${pulse ? "pulse-coral" : ""}`}
        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
      />
      {label}
    </span>
  );
}
