import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useHac } from "@/lib/hac/store";
import type { Course } from "@/lib/hac/types";
import {
  CalendarCheck,
  BellRing,
  CalendarRange,
  Mail,
  LineChart,
  FileText,
  ScrollText,
  ChevronRight,
  X,
  type LucideIcon,
} from "lucide-react";

type ItemId =
  | "attendance"
  | "bell"
  | "schedule"
  | "contact"
  | "progress"
  | "report"
  | "transcript";

type Item = {
  id: ItemId;
  title: string;
  icon: LucideIcon;
  tint: string;
};

const ITEMS: Item[] = [
  { id: "attendance", title: "Attendance", icon: CalendarCheck, tint: "var(--primary)" },
  { id: "bell", title: "Bell Schedule", icon: BellRing, tint: "#f59e0b" },
  { id: "schedule", title: "Class Schedule", icon: CalendarRange, tint: "#3b82f6" },
  { id: "contact", title: "Contact Teachers", icon: Mail, tint: "#ec4899" },
  { id: "progress", title: "Progress Report", icon: LineChart, tint: "#a855f7" },
  { id: "report", title: "Report Card", icon: FileText, tint: "#06b6d4" },
  { id: "transcript", title: "Transcript", icon: ScrollText, tint: "#10b981" },
];

function avgColor(v: number | null): string {
  if (v === null) return "var(--muted-foreground)";
  if (v >= 90) return "var(--success)";
  if (v >= 80) return "var(--primary)";
  if (v >= 70) return "var(--warning)";
  return "var(--destructive)";
}

/** Sort courses by numeric period when available. */
function byPeriod(courses: Course[]): Course[] {
  return [...courses].sort((a, b) => {
    const pa = a.period ? parseInt(a.period, 10) : 99;
    const pb = b.period ? parseInt(b.period, 10) : 99;
    return (isNaN(pa) ? 99 : pa) - (isNaN(pb) ? 99 : pb);
  });
}

export function UtilityMenu() {
  const { data } = useHac();
  const [open, setOpen] = useState<ItemId | null>(null);

  const summaries = useMemo(() => {
    if (!data) return {} as Record<ItemId, string>;
    const courses = data.courses;
    const absences = courses.reduce(
      (n, c) => n + c.assignments.filter((a) => a.absent).length,
      0,
    );
    const periods = new Set(courses.map((c) => c.period).filter(Boolean)).size;
    const teachers = new Set(courses.map((c) => c.teacher).filter(Boolean)).size;
    const graded = courses.filter((c) => c.average !== null);
    const gpa = data.markingPeriodGPAs.at(-1)?.gpa;
    return {
      attendance: absences > 0 ? `${absences} absence${absences === 1 ? "" : "s"} recorded` : "No absences recorded",
      bell: periods > 0 ? `${periods} period${periods === 1 ? "" : "s"} today` : "Periods and the daily bell",
      schedule: `${courses.length} enrolled course${courses.length === 1 ? "" : "s"}`,
      contact: `${teachers} teacher${teachers === 1 ? "" : "s"} on roster`,
      progress: graded.length ? `${graded.length} current period score${graded.length === 1 ? "" : "s"}` : "View reporting period scores",
      report: gpa != null ? `Latest GPA ${gpa.toFixed(2)}` : "Posted marking grades",
      transcript: `${data.transcript.length} historical record${data.transcript.length === 1 ? "" : "s"}`,
    } as Record<ItemId, string>;
  }, [data]);

  if (!data) return null;
  const activeItem = ITEMS.find((i) => i.id === open) ?? null;

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-2">Quick Access</h2>
      <div className="space-y-2.5">
        {ITEMS.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.id}
              onClick={() => setOpen(item.id)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 360, damping: 30, delay: i * 0.04 }}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.97 }}
              className="liquid group w-full rounded-2xl px-3.5 py-3 flex items-center gap-3.5 text-left"
            >
              <span
                className="shrink-0 h-11 w-11 rounded-xl grid place-items-center"
                style={{
                  background: `color-mix(in oklab, ${item.tint} 18%, transparent)`,
                  border: `1px solid color-mix(in oklab, ${item.tint} 35%, transparent)`,
                  boxShadow: `0 0 18px -8px ${item.tint}`,
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                }}
              >
                <Icon className="h-5 w-5" style={{ color: item.tint }} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold tracking-tight truncate">{item.title}</div>
                <div className="text-[11px] truncate" style={{ color: "color-mix(in oklab, var(--primary) 30%, var(--muted-foreground))" }}>
                  {summaries[item.id]}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-[filter,color,transform] duration-200 group-hover:text-primary group-hover:translate-x-1 group-hover:drop-shadow-[0_0_6px_var(--primary)]" />
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {activeItem ? (
          <DetailSheet item={activeItem} onClose={() => setOpen(null)} />
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function DetailSheet({ item, onClose }: { item: Item; onClose: () => void }) {
  const { data } = useHac();
  if (!data) return null;
  const Icon = item.icon;

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[10000] bg-black/60"
        style={{ backdropFilter: "blur(4px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-x-0 bottom-0 z-[10001] max-h-[78dvh] overflow-y-auto rounded-t-3xl px-5 pt-4 pb-10"
        style={{
          background: "color-mix(in oklab, var(--card) 75%, transparent)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(28px) saturate(150%)",
          WebkitBackdropFilter: "blur(28px) saturate(150%)",
        }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 360, damping: 36 }}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/15" />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span
              className="h-9 w-9 rounded-xl grid place-items-center"
              style={{
                background: `color-mix(in oklab, ${item.tint} 18%, transparent)`,
                border: `1px solid color-mix(in oklab, ${item.tint} 35%, transparent)`,
              }}
            >
              <Icon className="h-4.5 w-4.5" style={{ color: item.tint }} />
            </span>
            <h3 className="text-lg font-bold tracking-tight">{item.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-lg bg-white/[0.06] text-muted-foreground active:scale-90 transition"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <DetailContent id={item.id} />
      </motion.div>
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-sm text-muted-foreground py-6 text-center">{text}</div>;
}

function DetailContent({ id }: { id: ItemId }) {
  const { data, courseCustom } = useHac();
  if (!data) return null;
  const courses = data.courses;

  if (id === "attendance") {
    const abs = courses.flatMap((c) =>
      c.assignments.filter((a) => a.absent).map((a) => ({ course: c.name, ...a })),
    );
    if (!abs.length) return <Empty text="No absences on record. Perfect attendance." />;
    return (
      <div className="space-y-2">
        {abs.map((a, i) => (
          <div key={i} className="liquid rounded-xl p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{a.name}</div>
              <div className="text-[11px] text-muted-foreground truncate">{a.course}{a.dueDate ? ` · ${a.dueDate}` : ""}</div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded text-white" style={{ background: "linear-gradient(135deg,#ff6b6b,#f43f5e)" }}>ABS</span>
          </div>
        ))}
      </div>
    );
  }

  if (id === "bell") {
    return <BellScheduleEditor />;
  }

  if (id === "schedule") {
    const sorted = byPeriod(courses);
    return (
      <div className="space-y-2">
        {sorted.map((c) => {
          const d = courseDisplay(c, courseCustom[c.id]);
          return (
            <div key={c.id} className="liquid rounded-xl p-3 flex items-center gap-3">
              <div
                className="shrink-0 h-9 w-9 rounded-lg grid place-items-center text-sm font-bold tabular-nums"
                style={{ background: d.gradient ?? "color-mix(in oklab, var(--primary) 16%, transparent)", color: d.gradient ? "#fff" : "var(--primary)" }}
              >
                {d.emoji ?? c.period ?? "–"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{d.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{c.teacher ?? "—"}{c.period ? ` · Period ${c.period}` : ""}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (id === "contact") {
    const teachers = Array.from(
      new Map(courses.filter((c) => c.teacher).map((c) => [c.teacher, c])).values(),
    );
    if (!teachers.length) return <Empty text="No teacher contacts available." />;
    return (
      <div className="space-y-2">
        {teachers.map((c) => (
          <div key={c.id} className="liquid rounded-xl p-3 flex items-center gap-3">
            <div className="shrink-0 h-9 w-9 rounded-full grid place-items-center text-xs font-bold" style={{ background: "color-mix(in oklab, #ec4899 18%, transparent)", color: "#ec4899" }}>
              {(c.teacher ?? "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{c.teacher}</div>
              <div className="text-[11px] text-muted-foreground truncate">{c.name}</div>
            </div>
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (id === "progress") {
    return (
      <div className="space-y-2">
        {courses.map((c) => (
          <div key={c.id} className="liquid rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{c.name}</div>
              <div className="text-[11px] text-muted-foreground truncate">{c.teacher ?? ""}</div>
            </div>
            <div className="text-xl font-bold tabular-nums shrink-0" style={{ color: avgColor(c.average) }}>
              {c.average !== null ? c.average.toFixed(1) : "—"}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (id === "report") {
    return (
      <div className="space-y-4">
        {data.markingPeriodGPAs.length ? (
          <div className="liquid rounded-xl p-3.5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Marking Period GPA</div>
            <div className="flex flex-wrap gap-2">
              {data.markingPeriodGPAs.map((m) => (
                <div key={m.mp} className="px-3 py-1.5 rounded-lg text-sm font-bold tabular-nums" style={{ background: "color-mix(in oklab, var(--primary) 14%, transparent)", border: "1px solid color-mix(in oklab, var(--primary) 30%, transparent)" }}>
                  <span className="text-[10px] font-medium text-muted-foreground mr-1.5">{m.mp}</span>
                  {m.gpa.toFixed(2)}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="space-y-2">
          {courses.map((c) => (
            <div key={c.id} className="liquid rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{c.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{c.code ?? ""}</div>
              </div>
              <div className="text-xl font-bold tabular-nums shrink-0" style={{ color: avgColor(c.average) }}>
                {c.average !== null ? c.average.toFixed(1) : "—"}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // transcript
  if (!data.transcript.length) return <Empty text="No transcript records available yet." />;
  return (
    <div className="space-y-2">
      {data.transcript.map((t, i) => (
        <div key={i} className="liquid rounded-xl p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{t.course}</div>
            <div className="text-[11px] text-muted-foreground truncate">{t.year}{t.grade ? ` · Grade ${t.grade}` : ""}{t.credits ? ` · ${t.credits} cr` : ""}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-sm font-bold tabular-nums">
            {t.sem1 ? <span className="px-2 py-0.5 rounded bg-white/[0.06]">{t.sem1}</span> : null}
            {t.sem2 ? <span className="px-2 py-0.5 rounded bg-white/[0.06]">{t.sem2}</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
