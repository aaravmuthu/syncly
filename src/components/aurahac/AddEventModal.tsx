import { useState } from "react";
import { motion } from "motion/react";
import { X, BookOpen, GraduationCap, Bell, BellOff } from "lucide-react";
import { useHac } from "@/lib/hac/store";

interface Props {
  date: string; // YYYY-MM-DD
  onClose: () => void;
}

const TIME_PRESETS = [15, 30, 45, 60, 90, 120, 180];

/** Build an ISO datetime string `n` minutes from now. */
function offsetISO(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export function AddEventModal({ date, onClose }: Props) {
  const { data, addEvent, notificationsEnabled, enableNotifications } = useHac();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"homework" | "exam">("homework");
  const [course, setCourse] = useState("");
  const [day, setDay] = useState(date);
  const [minutes, setMinutes] = useState(type === "exam" ? 90 : 45);
  const [remind, setRemind] = useState(true);
  const [remindAt, setRemindAt] = useState<string>(() => {
    const d = new Date();
    d.setHours(17, 0, 0, 0); // default 5:00 PM today
    // localized value for datetime-local
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
  });

  async function submit() {
    if (!title.trim()) return;
    let reminderAt: string | null = null;
    if (remind) {
      if (!notificationsEnabled) await enableNotifications();
      reminderAt = remindAt ? new Date(remindAt).toISOString() : offsetISO(60);
    }
    addEvent({
      title: title.trim(),
      type,
      course: course.trim() || null,
      date: day,
      minutes,
      reminderAt,
    });
    onClose();
  }

  const accent = type === "exam" ? "var(--primary)" : "var(--chart-2)";

  return (
    <motion.div
      className="fixed inset-0 z-[10000] grid place-items-end sm:place-items-center p-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ background: "rgba(5,5,15,0.6)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl p-5 space-y-4"
        style={{
          background: "color-mix(in oklab, var(--popover) 70%, transparent)",
          backdropFilter: "blur(20px)",
          border: "1px solid color-mix(in oklab, var(--primary) 28%, transparent)",
          boxShadow: "0 30px 80px -28px color-mix(in oklab, var(--primary) 55%, transparent)",
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Add to Calendar</h2>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-full bg-white/[0.05] active:scale-90">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Type toggle */}
        <div className="grid grid-cols-2 gap-2">
          {(["homework", "exam"] as const).map((t) => {
            const active = type === t;
            const Icon = t === "exam" ? GraduationCap : BookOpen;
            const c = t === "exam" ? "var(--primary)" : "var(--chart-2)";
            return (
              <button
                key={t}
                onClick={() => {
                  setType(t);
                  setMinutes(t === "exam" ? 90 : 45);
                }}
                className="flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-semibold capitalize transition-all"
                style={{
                  background: active ? `color-mix(in oklab, ${c} 22%, transparent)` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? `color-mix(in oklab, ${c} 55%, transparent)` : "rgba(255,255,255,0.06)"}`,
                  color: active ? c : "var(--muted-foreground)",
                }}
              >
                <Icon className="h-4 w-4" />
                {t}
              </button>
            );
          })}
        </div>

        <Field label="Title">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder={type === "exam" ? "Geometry Unit Exam" : "Chemistry worksheet p. 42"}
            className="w-full bg-transparent outline-none text-sm placeholder:text-muted-foreground/60"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Course (optional)">
            <input
              list="course-list"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              maxLength={60}
              placeholder="e.g. Geometry"
              className="w-full bg-transparent outline-none text-sm placeholder:text-muted-foreground/60"
            />
            <datalist id="course-list">
              {data?.courses.map((c) => <option key={c.id} value={c.name} />)}
            </datalist>
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="w-full bg-transparent outline-none text-sm [color-scheme:dark]"
            />
          </Field>
        </div>

        {/* Time needed */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-1.5">
            {type === "exam" ? "Study time needed" : "Time to finish"}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TIME_PRESETS.map((m) => {
              const active = minutes === m;
              return (
                <button
                  key={m}
                  onClick={() => setMinutes(m)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: active ? `color-mix(in oklab, ${accent} 24%, transparent)` : "rgba(255,255,255,0.04)",
                    border: `1px solid ${active ? `color-mix(in oklab, ${accent} 55%, transparent)` : "rgba(255,255,255,0.06)"}`,
                    color: active ? accent : "var(--muted-foreground)",
                  }}
                >
                  {m >= 60 ? `${m / 60}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Reminder */}
        <div
          className="rounded-2xl p-3 space-y-2"
          style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.08)" }}
        >
          <button
            onClick={() => setRemind((r) => !r)}
            className="flex items-center justify-between w-full"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              {remind ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
              Reminder
            </span>
            <span
              className="relative h-5 w-9 rounded-full transition-colors"
              style={{ background: remind ? "var(--primary)" : "rgba(255,255,255,0.15)" }}
            >
              <motion.span
                layout
                className="absolute top-0.5 h-4 w-4 rounded-full bg-white"
                style={{ left: remind ? 18 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </span>
          </button>
          {remind ? (
            <input
              type="datetime-local"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
              className="w-full bg-transparent outline-none text-sm [color-scheme:dark]"
            />
          ) : null}
        </div>

        <button
          onClick={submit}
          disabled={!title.trim()}
          className="w-full rounded-2xl py-3 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-40"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          Add {type === "exam" ? "Exam" : "Homework"}
        </button>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block rounded-2xl px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.08)" }}>
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-0.5">{label}</div>
      {children}
    </label>
  );
}
