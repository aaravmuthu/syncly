import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useHac } from "@/lib/hac/store";
import { ChevronLeft, ChevronRight, Check, Plus, Clock, Trash2, Bell } from "lucide-react";
import type { Assignment } from "@/lib/hac/types";
import { AddEventModal } from "../AddEventModal";

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
  abbr: string;
  label: string;
  name: string;
  category: string;
  weight: number | null;
  score: number | null;
  total: number | null;
  kind: Kind;
  /** Set when this item was manually added by the student. */
  eventId?: string;
  /** Minutes of work/study for manual items. */
  minutes?: number;
  /** Whether a reminder is set on this manual item. */
  hasReminder?: boolean;
}

function fmtMins(m: number) {
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h}h ${r}m` : `${h}h`;
  }
  return `${m}m`;
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

/** Derive a compact subject code, e.g. "ELA1200B - 3" -> "ELA1". */
function abbreviate(code: string | null, name: string): string {
  const src = code ?? name;
  const m = src.match(/([A-Za-z]+)\s*0*(\d)/);
  if (m) return `${m[1].toUpperCase().slice(0, 3)}${m[2]}`;
  return src.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4) || "GEN";
}

/** Short type label shown in the mini capsule. */
function shortLabel(a: Assignment, kind: Kind): string {
  if (kind === "missing") return "ABS";
  if (kind === "assessment") {
    if (/final|eoy|end of year/i.test(a.name)) return "Final";
    if (/midterm/i.test(a.name)) return "Midterm";
    if (/quiz/i.test(a.name)) return "Quiz";
    return "Test";
  }
  if (/quiz/i.test(a.name)) return "Quiz";
  if (/lab/i.test(a.name)) return "Lab";
  if (/log/i.test(a.name)) return "Logs";
  return "Check";
}

/* ---------------- component ---------------- */

export function CalendarTab() {
  const { data, completed, toggleCompleted, userEvents, removeEvent } = useHac();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<string | null>(() => ymd(new Date()));
  const [view, setView] = useState<"month" | "week">("month");
  const [adding, setAdding] = useState(false);

  // Map every dated assignment + manual event onto its YYYY-MM-DD bucket.
  const byDate = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    if (data) {
      for (const c of data.courses) {
        for (const a of c.assignments) {
          const d = parseDate(a.dueDate);
          if (!d) continue;
          const key = ymd(d);
          const arr = map.get(key) ?? [];
          const kind = classify(a);
          arr.push({
            key: `${c.id}::${a.name}::${a.dueDate}`,
            course: c.name,
            courseId: c.id,
            abbr: abbreviate(c.code, c.name),
            label: shortLabel(a, kind),
            name: a.name,
            category: a.category,
            weight: a.totalPoints,
            score: a.score,
            total: a.totalPoints,
            kind,
          });
          map.set(key, arr);
        }
      }
    }
    // Manually added homework / exams.
    for (const e of userEvents) {
      const arr = map.get(e.date) ?? [];
      const kind: Kind = e.type === "exam" ? "assessment" : "progress";
      arr.push({
        key: e.id,
        course: e.course ?? "Personal",
        courseId: "user",
        abbr: e.course ? abbreviate(null, e.course) : "MINE",
        label: e.type === "exam" ? "Exam" : "HW",
        name: e.title,
        category: e.type === "exam" ? "Exam" : "Homework",
        weight: null,
        score: null,
        total: null,
        kind,
        eventId: e.id,
        minutes: e.minutes,
        hasReminder: !!e.reminderAt,
      });
      map.set(e.date, arr);
    }
    return map;
  }, [data, userEvents]);

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

  // Full 6-week grid including leading/trailing days from neighbouring months.
  const gridDays = useMemo(() => {
    const first = startOfMonth(cursor);
    const start = addDays(first, -first.getDay());
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor]);

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
      {/* Stacked header */}
      <header className="flex items-end justify-between pt-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            Synced Calendar
          </div>
          <h1 className="text-3xl font-bold tracking-tight leading-tight">{monthName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.06 }}
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="h-10 w-10 grid place-items-center rounded-full"
            style={{
              background: "color-mix(in oklab, var(--card) 60%, transparent)",
              backdropFilter: "blur(12px)",
              border: "1px solid color-mix(in oklab, var(--primary) 24%, transparent)",
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.06 }}
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="h-10 w-10 grid place-items-center rounded-full"
            style={{
              background: "color-mix(in oklab, var(--card) 60%, transparent)",
              backdropFilter: "blur(12px)",
              border: "1px solid color-mix(in oklab, var(--primary) 24%, transparent)",
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </motion.button>
        </div>
      </header>

      {/* View toggle + Add */}
      <div className="flex items-center justify-between gap-2">
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
        <motion.button
          whileTap={{ scale: 0.94 }}
          whileHover={{ scale: 1.03 }}
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-sm font-bold"
          style={{
            background: "var(--primary)",
            color: "var(--primary-foreground)",
            boxShadow: "0 10px 30px -12px color-mix(in oklab, var(--primary) 80%, transparent)",
          }}
        >
          <Plus className="h-4 w-4" />
          Add
        </motion.button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground px-1">
        <Legend color="var(--primary)" label="Exam" />
        <Legend color="var(--chart-2)" label="Progress" />
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
            className="rounded-3xl p-3"
            style={{
              background: "color-mix(in oklab, var(--card) 45%, transparent)",
              backdropFilter: "blur(16px)",
              border: "1px solid color-mix(in oklab, var(--primary) 16%, transparent)",
              boxShadow: "0 24px 60px -34px color-mix(in oklab, var(--primary) 50%, transparent)",
            }}
          >
            <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div key={i}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {gridDays.map((d, i) => {
                const key = ymd(d);
                const items = byDate.get(key) ?? [];
                const inMonth = d.getMonth() === cursor.getMonth();
                const isSelected = key === selected;
                const isToday = key === todayKey;
                const isPrep = prepDays.has(key);
                const showCapsules = items.length <= 2;
                return (
                  <motion.button
                    key={key}
                    onClick={() => setSelected(key)}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0, scale: isSelected ? 1.05 : 1 }}
                    transition={{
                      delay: Math.min(i * 0.006, 0.16),
                      type: "spring",
                      stiffness: 420,
                      damping: 26,
                    }}
                    whileTap={{ scale: 0.93 }}
                    className="relative flex flex-col items-stretch overflow-hidden rounded-xl p-1 text-left"
                    style={{
                      minHeight: 62,
                      zIndex: isSelected ? 5 : 1,
                      background: isToday
                        ? "color-mix(in oklab, var(--primary) 22%, transparent)"
                        : isSelected
                          ? "color-mix(in oklab, var(--primary) 16%, transparent)"
                          : isPrep
                            ? "color-mix(in oklab, var(--primary) 9%, transparent)"
                            : "rgba(255,255,255,0.025)",
                      border: isToday
                        ? "1px solid color-mix(in oklab, var(--primary) 85%, transparent)"
                        : isSelected
                          ? "1px solid color-mix(in oklab, var(--primary) 55%, transparent)"
                          : "0.5px solid rgba(255,255,255,0.06)",
                      boxShadow: isToday
                        ? "0 0 15px rgba(147,51,234,0.28), inset 0 0 14px -6px color-mix(in oklab, var(--primary) 80%, transparent)"
                        : isSelected
                          ? "0 0 12px -2px color-mix(in oklab, var(--primary) 45%, transparent)"
                          : "none",
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <span
                        className="text-[12px] font-semibold tabular-nums leading-none pt-0.5 pl-0.5"
                        style={{
                          color: inMonth
                            ? isToday
                              ? "var(--primary-foreground)"
                              : "var(--foreground)"
                            : "color-mix(in oklab, var(--muted-foreground) 55%, transparent)",
                        }}
                      >
                        {d.getDate()}
                      </span>
                      {isPrep ? (
                        <span className="text-[9px] leading-none pt-0.5 pr-0.5" title="Recommended Prep Window">
                          💡
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-1 flex flex-col gap-0.5 items-stretch">
                      {showCapsules ? (
                        items.map((it) => {
                          const done = !!completed[it.key];
                          const color = done ? DONE_COLOR : kindColor(it.kind);
                          return (
                            <span
                              key={it.key}
                              className={`truncate rounded-[5px] px-1 py-[1px] text-[8px] font-semibold leading-tight ${
                                it.kind === "missing" && !done ? "pulse-coral" : ""
                              }`}
                              style={{
                                background: `color-mix(in oklab, ${color} 22%, transparent)`,
                                color: color,
                                border: `0.5px solid color-mix(in oklab, ${color} 45%, transparent)`,
                              }}
                            >
                              {it.abbr} · {it.label}
                            </span>
                          );
                        })
                      ) : (
                        <div className="flex items-center justify-center gap-1 pt-1">
                          {items.slice(0, 4).map((it) => {
                            const done = !!completed[it.key];
                            const color = done ? DONE_COLOR : kindColor(it.kind);
                            return (
                              <span
                                key={it.key}
                                className={`h-1.5 w-1.5 rounded-full ${
                                  it.kind === "missing" && !done ? "pulse-coral" : ""
                                }`}
                                style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                              />
                            );
                          })}
                        </div>
                      )}
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
      <motion.div
        layout
        className="rounded-3xl p-4"
        style={{
          background: "color-mix(in oklab, var(--popover) 55%, transparent)",
          backdropFilter: "blur(16px)",
          border: "1px solid color-mix(in oklab, var(--primary) 22%, transparent)",
          boxShadow: "0 24px 60px -30px color-mix(in oklab, var(--primary) 50%, transparent)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {selectedLabel ? `Day Agenda · ${selectedLabel}` : "Select a day"}
          </div>
          {prepDays.has(selected ?? "") ? (
            <span className="text-[10px] font-semibold text-primary">💡 Prep Window</span>
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
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="flex items-center gap-3 p-3 rounded-2xl"
                    style={{
                      background: "rgba(255,255,255,0.035)",
                      backdropFilter: "blur(10px)",
                      border: "0.5px solid rgba(255,255,255,0.08)",
                    }}
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
                      <div
                        className={`text-sm font-medium truncate transition-all ${
                          done ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {it.name}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground truncate">
                        <span className="truncate">{it.course} · {it.category}</span>
                        {it.minutes ? (
                          <span className="inline-flex items-center gap-1 shrink-0 text-foreground/80">
                            <Clock className="h-3 w-3" />
                            {fmtMins(it.minutes)}
                          </span>
                        ) : null}
                        {it.hasReminder ? <Bell className="h-3 w-3 shrink-0 text-primary" /> : null}
                      </div>
                    </div>
                    {it.eventId ? (
                      <button
                        onClick={() => removeEvent(it.eventId!)}
                        className="h-7 w-7 shrink-0 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive transition-colors active:scale-90"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <div className="text-xs tabular-nums text-muted-foreground shrink-0">
                        {it.score !== null && it.total
                          ? `${it.score}/${it.total}`
                          : it.total
                            ? `${it.total} pts`
                            : ""}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {adding ? (
          <AddEventModal date={selected ?? ymd(new Date())} onClose={() => setAdding(false)} />
        ) : null}
      </AnimatePresence>
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
