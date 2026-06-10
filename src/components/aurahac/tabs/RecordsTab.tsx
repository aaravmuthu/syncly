import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useHac } from "@/lib/hac/store";
import {
  transcriptByYear,
  totalCredits,
  reportCardFor,
  termGrade,
  attendanceFor,
  attendanceByDate,
  attendanceMeta,
  gradeTxt,
  gradeColor,
  txt,
} from "@/lib/hac/records";
import { cumulativeGPA } from "@/lib/hac/gpa";
import { MarkingPeriodSlider } from "../MarkingPeriodSlider";
import type { MarkingPeriod } from "@/lib/hac/marking";
import {
  ChevronDown,
  GraduationCap,
  ScrollText,
  ClipboardList,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  Award,
} from "lucide-react";

type Section = "transcript" | "report" | "attendance";

const SECTIONS: { id: Section; label: string; icon: typeof ScrollText }[] = [
  { id: "transcript", label: "Transcript", icon: ScrollText },
  { id: "report", label: "Report Card", icon: ClipboardList },
  { id: "attendance", label: "Attendance", icon: CalendarX2 },
];

export function RecordsTab() {
  const { data } = useHac();
  const [section, setSection] = useState<Section>("transcript");
  if (!data) return null;

  return (
    <div className="space-y-4 pb-32">
      <header className="pt-2">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Academic Records</div>
        <h1 className="text-2xl font-bold tracking-tight">Your Full File</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {txt(data.student.name)} · ID {txt(data.student.studentId)} · {txt(data.student.school)}
        </p>
      </header>

      {/* Section selector */}
      <div className="relative flex p-1 rounded-2xl bg-white/[0.04] border border-white/10">
        {SECTIONS.map((s) => {
          const active = section === s.id;
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`relative flex-1 py-2 text-xs font-semibold rounded-xl transition-colors z-10 inline-flex items-center justify-center gap-1.5 ${
                active ? "text-[#090915]" : "text-muted-foreground"
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="records-section-pill"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: "var(--primary)", boxShadow: "0 0 14px -3px var(--primary)" }}
                  transition={{ type: "spring", stiffness: 500, damping: 34 }}
                />
              ) : null}
              <span className="relative z-10 inline-flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" /> {s.label}
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={section}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {section === "transcript" ? <TranscriptView /> : null}
          {section === "report" ? <ReportCardView /> : null}
          {section === "attendance" ? <AttendanceView /> : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ----------------------- Transcript ----------------------- */

function TranscriptView() {
  const { data } = useHac();
  const [open, setOpen] = useState<string | null>(null);
  const years = useMemo(() => (data ? transcriptByYear(data.transcript) : []), [data]);
  const credits = useMemo(() => (data ? totalCredits(data.transcript) : 0), [data]);
  const cumW = useMemo(() => (data ? cumulativeGPA(data.transcript, true) : 0), [data]);
  const cumU = useMemo(() => (data ? cumulativeGPA(data.transcript, false) : 0), [data]);

  // Auto-open the most recent year on first paint.
  const activeYear = open ?? years[0]?.year ?? null;

  if (years.length === 0) {
    return <EmptyCard text="No transcript records found yet." />;
  }

  return (
    <div className="space-y-3">
      {/* GPA + credit summary */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryStat label="Cum · Wtd" value={cumW.toFixed(3)} icon={Award} />
        <SummaryStat label="Cum · Unwtd" value={cumU.toFixed(3)} />
        <SummaryStat label="Credits" value={credits.toFixed(1)} icon={GraduationCap} />
      </div>

      {years.map((y) => {
        const isOpen = activeYear === y.year;
        return (
          <div
            key={y.year}
            className="glass rounded-2xl overflow-hidden"
            style={{ backdropFilter: "blur(12px)" }}
          >
            <button
              onClick={() => setOpen(isOpen ? "__none__" : y.year)}
              className="w-full flex items-center gap-3 p-4 text-left"
            >
              <div
                className="h-10 w-10 rounded-xl grid place-items-center shrink-0 font-bold text-sm"
                style={{
                  background: "color-mix(in oklab, var(--primary) 16%, transparent)",
                  color: "var(--primary)",
                  border: "1px solid color-mix(in oklab, var(--primary) 36%, transparent)",
                }}
              >
                {txt(y.grade)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold">{txt(y.year)}</div>
                <div className="text-[11px] text-muted-foreground">
                  Grade {txt(y.grade)} · {y.courses.length} courses · {y.credits.toFixed(1)} credits
                </div>
              </div>
              <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 26 }}>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 320, damping: 32 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 space-y-1.5">
                    {y.courses.map((c, i) => (
                      <div
                        key={`${c.course}-${i}`}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-white/[0.03]"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{txt(c.course)}</div>
                          <div className="text-[11px] text-muted-foreground">{txt(c.credits, "0.0")} credits</div>
                        </div>
                        <Mark label="S1" value={c.sem1} />
                        <Mark label="S2" value={c.sem2} />
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function Mark({ label, value }: { label: string; value: string | null }) {
  const n = value !== null ? parseFloat(value) : NaN;
  const color = Number.isFinite(n) ? gradeColor(n) : "var(--muted-foreground)";
  const display = value && value.trim() !== "" ? value : "—";
  return (
    <div className="shrink-0 text-center w-12">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-sm font-bold tabular-nums" style={{ color }}>
        {display}
      </div>
    </div>
  );
}

/* ----------------------- Report card ----------------------- */

function ReportCardView() {
  const { data, activePeriod, setActivePeriod } = useHac();
  if (!data) return null;

  return (
    <div className="space-y-3">
      <MarkingPeriodSlider value={activePeriod} onChange={setActivePeriod} layoutKey="records-rc-pill" />

      {data.courses.length === 0 ? (
        <EmptyCard text="No enrolled courses to report." />
      ) : (
        data.courses.map((course) => {
          const term = reportCardFor(course);
          const active = termGrade(term, activePeriod as MarkingPeriod);
          const color = gradeColor(active);
          const pct = active !== null && Number.isFinite(active) ? Math.min(100, active) : 0;
          return (
            <div key={course.id} className="glass rounded-2xl p-4" style={{ backdropFilter: "blur(12px)" }}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate">{txt(course.name)}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {txt(course.room, "Room --")} · {txt(course.teacher)}
                  </div>
                </div>
                <div
                  className="shrink-0 px-3 py-1.5 rounded-xl text-sm font-bold tabular-nums"
                  style={{
                    background: `color-mix(in oklab, ${color} 18%, transparent)`,
                    color,
                    border: `1px solid color-mix(in oklab, ${color} 40%, transparent)`,
                  }}
                >
                  {gradeTxt(active)}
                </div>
              </div>

              {/* Progress toward the active marking period grade */}
              <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden mb-3">
                <motion.div
                  className="h-full rounded-full"
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 200, damping: 26 }}
                  style={{ background: `linear-gradient(90deg, color-mix(in oklab, ${color} 70%, transparent), ${color})` }}
                />
              </div>

              {/* Full matrix */}
              <div className="grid grid-cols-6 gap-1.5 text-center">
                <MatrixCell label="MP1" value={term.mp1} highlight={activePeriod === "MP1"} />
                <MatrixCell label="MP2" value={term.mp2} highlight={activePeriod === "MP2"} />
                <MatrixCell label="MP3" value={term.mp3} highlight={activePeriod === "MP3"} />
                <MatrixCell label="MP4" value={term.mp4} highlight={activePeriod === "MP4"} />
                <MatrixCell label="Exam" value={term.exam} />
                <MatrixCell label="Sem" value={term.semester} bold />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function MatrixCell({
  label,
  value,
  highlight,
  bold,
}: {
  label: string;
  value: number | null;
  highlight?: boolean;
  bold?: boolean;
}) {
  const color = gradeColor(value);
  return (
    <div
      className="rounded-lg py-1.5"
      style={{
        background: highlight ? "color-mix(in oklab, var(--primary) 14%, transparent)" : "rgba(255,255,255,0.03)",
        border: highlight ? "1px solid color-mix(in oklab, var(--primary) 40%, transparent)" : "1px solid transparent",
      }}
    >
      <div className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-xs tabular-nums ${bold ? "font-extrabold" : "font-bold"}`} style={{ color }}>
        {value !== null && Number.isFinite(value) ? value.toFixed(0) : "—"}
      </div>
    </div>
  );
}

/* ----------------------- Attendance ----------------------- */

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function AttendanceView() {
  const { data } = useHac();
  const ledger = useMemo(() => (data ? attendanceFor(data) : null), [data]);
  const byDate = useMemo(() => (ledger ? attendanceByDate(ledger) : new Map()), [ledger]);

  // Anchor the calendar to the most recent incident, or today.
  const initialMonth = useMemo(() => {
    const last = ledger?.log[0]?.date;
    return startOfMonth(last ? new Date(last) : new Date());
  }, [ledger]);
  const [cursor, setCursor] = useState(initialMonth);

  if (!ledger) return null;

  const gridDays = Array.from({ length: 42 }, (_, i) => {
    const first = startOfMonth(cursor);
    const start = addDays(first, -first.getDay());
    return addDays(start, i);
  });
  const monthName = cursor.toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div className="space-y-3">
      {/* Ledger summary */}
      <div className="grid grid-cols-4 gap-2">
        <SummaryStat label="Absences" value={String(ledger.totalAbsences)} />
        <SummaryStat label="Excused" value={String(ledger.excusedAbsences)} />
        <SummaryStat label="Unexcused" value={String(ledger.unexcusedAbsences)} />
        <SummaryStat label="Tardies" value={String(ledger.tardies)} />
      </div>

      {/* Month grid */}
      <div className="glass rounded-2xl p-3" style={{ backdropFilter: "blur(12px)" }}>
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="h-8 w-8 grid place-items-center rounded-lg bg-white/[0.05]">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm font-bold">{monthName}</div>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="h-8 w-8 grid place-items-center rounded-lg bg-white/[0.05]">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {gridDays.map((d) => {
            const key = ymd(d);
            const entries = byDate.get(key) ?? [];
            const inMonth = d.getMonth() === cursor.getMonth();
            const primary = entries[0];
            const meta = primary ? attendanceMeta(primary.code) : null;
            return (
              <div
                key={key}
                className="relative aspect-square grid place-items-center rounded-lg text-[11px] tabular-nums"
                style={{
                  background: meta ? `color-mix(in oklab, ${meta.color} 18%, transparent)` : "rgba(255,255,255,0.02)",
                  border: meta ? `1px solid color-mix(in oklab, ${meta.color} 45%, transparent)` : "0.5px solid rgba(255,255,255,0.05)",
                  color: inMonth ? (meta ? meta.color : "var(--foreground)") : "color-mix(in oklab, var(--muted-foreground) 50%, transparent)",
                  fontWeight: meta ? 700 : 400,
                }}
              >
                {d.getDate()}
                {entries.length > 1 ? (
                  <span className="absolute bottom-0.5 right-0.5 text-[7px]">+{entries.length - 1}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Incident log */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Incident Log</div>
        {ledger.log.length === 0 ? (
          <EmptyCard text="Perfect attendance — no incidents recorded." />
        ) : (
          ledger.log.map((e, i) => {
            const meta = attendanceMeta(e.code);
            return (
              <div key={i} className="glass rounded-2xl p-3 flex items-center gap-3" style={{ backdropFilter: "blur(12px)" }}>
                <span
                  className="shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest"
                  style={{
                    background: `color-mix(in oklab, ${meta.color} 18%, transparent)`,
                    color: meta.color,
                    border: `1px solid color-mix(in oklab, ${meta.color} 40%, transparent)`,
                  }}
                >
                  {e.code}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{meta.label}{e.course ? ` · ${e.course}` : ""}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {txt(e.date)}{e.note ? ` · ${e.note}` : ""}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ----------------------- shared ----------------------- */

function SummaryStat({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof Award }) {
  return (
    <div className="glass rounded-2xl p-3" style={{ backdropFilter: "blur(12px)" }}>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
        {Icon ? <Icon className="h-3 w-3" /> : null}
        {label}
      </div>
      <div className="text-xl font-bold tabular-nums mt-0.5 text-gradient">{value}</div>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">{text}</div>;
}
