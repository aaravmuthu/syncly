import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Assignment, Course } from "@/lib/hac/types";
import { assignmentPercent } from "@/lib/hac/marking";
import { X, Copy, Check, Send, Sparkles } from "lucide-react";

/** Pull a likely surname out of a teacher field like "Smith, John" or "John Smith". */
function teacherSalutation(teacher: string | null): string {
  if (!teacher) return "Professor";
  const t = teacher.trim();
  if (t.includes(",")) {
    const last = t.split(",")[0].trim();
    if (last) return `Mr./Ms. ${last}`;
  }
  const parts = t.split(/\s+/);
  const last = parts[parts.length - 1];
  return last ? `Mr./Ms. ${last}` : "Professor";
}

function firstName(student: string): string {
  return student.trim().split(/\s+/)[0] || student.trim();
}

type Intent = "missing" | "absent" | "retest" | "tutorial";

function intentLabel(i: Intent): string {
  switch (i) {
    case "missing":
      return "Missing assignment";
    case "absent":
      return "Clarify ABS code";
    case "retest":
      return "Request a retest";
    case "tutorial":
      return "Ask for tutorials";
  }
}

function buildEmail(opts: {
  intent: Intent;
  salutation: string;
  studentName: string;
  courseName: string;
  assignment: string;
  score: number | null;
}): { subject: string; body: string } {
  const { intent, salutation, studentName, courseName, assignment, score } = opts;
  const fname = firstName(studentName);
  const scoreText = score !== null ? `${score.toFixed(0)}%` : "the current mark";

  const sign = `\n\nThank you so much for your time and guidance.\n\nWarm regards,\n${studentName}`;

  if (intent === "missing") {
    return {
      subject: `${courseName} — Missing grade for "${assignment}"`,
      body:
        `Dear ${salutation},\n\n` +
        `I hope you're having a great week. I'm ${fname}, a student in your ${courseName} class. ` +
        `While reviewing my grades, I noticed that "${assignment}" is currently showing as missing. ` +
        `I wanted to reach out respectfully to check whether it may not have been submitted correctly on my end, ` +
        `and to ask how I can resolve it as soon as possible.\n\n` +
        `If there is anything I need to resubmit, please let me know and I will take care of it right away.` +
        sign,
    };
  }
  if (intent === "absent") {
    return {
      subject: `${courseName} — Clarification on "ABS" for "${assignment}"`,
      body:
        `Dear ${salutation},\n\n` +
        `I hope this message finds you well. I'm ${fname} from your ${courseName} class. ` +
        `I noticed an "ABS" code on "${assignment}" and wanted to politely clarify the absence and understand ` +
        `the steps for making up the work. I'm committed to staying on track and would appreciate any guidance ` +
        `on when I can complete it.` +
        sign,
    };
  }
  if (intent === "retest") {
    return {
      subject: `${courseName} — Retest opportunity for "${assignment}"`,
      body:
        `Dear ${salutation},\n\n` +
        `I hope you're doing well. I'm ${fname}, a student in your ${courseName} class. ` +
        `I recently scored ${scoreText} on "${assignment}", and while I understand it didn't reflect my best work, ` +
        `I'm eager to improve my understanding of the material. ` +
        `I wanted to respectfully ask whether a retest or any corrections opportunity might be available, ` +
        `and what I can do to prepare for it.` +
        sign,
    };
  }
  return {
    subject: `${courseName} — Requesting tutorial time for "${assignment}"`,
    body:
      `Dear ${salutation},\n\n` +
      `I hope you're having a good day. I'm ${fname} from your ${courseName} class. ` +
      `After "${assignment}" (currently ${scoreText}), I realized I could use some extra support to strengthen ` +
      `my understanding. Could you please let me know your available tutorial or office-hour times so I can come in ` +
      `for help? I really want to improve.` +
      sign,
  };
}

export function AuraAssistMail({
  course,
  assignment,
  studentName,
  onClose,
}: {
  course: Course;
  assignment: Assignment;
  studentName: string;
  onClose: () => void;
}) {
  const salutation = useMemo(() => teacherSalutation(course.teacher), [course.teacher]);
  const score = useMemo(() => assignmentPercent(assignment), [assignment]);

  const defaultIntent: Intent = assignment.absent
    ? "absent"
    : assignment.missing
      ? "missing"
      : "retest";
  const [intent, setIntent] = useState<Intent>(defaultIntent);
  const [copied, setCopied] = useState(false);

  const { subject, body } = useMemo(
    () =>
      buildEmail({
        intent,
        salutation,
        studentName,
        courseName: course.name,
        assignment: assignment.name,
        score,
      }),
    [intent, salutation, studentName, course.name, assignment.name, score],
  );

  const intents: Intent[] = ["retest", "missing", "absent", "tutorial"];

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  function openMail() {
    const href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div
        initial={{ y: 80, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="glass-strong w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col"
        style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
      >
        <header className="flex items-start gap-3 p-5 pb-3 shrink-0">
          <div
            className="h-9 w-9 grid place-items-center rounded-xl shrink-0"
            style={{
              background: "color-mix(in oklab, var(--primary) 18%, transparent)",
              boxShadow: "0 0 18px -4px var(--primary)",
            }}
          >
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold leading-tight">Aura Assist</h2>
            <div className="text-xs text-muted-foreground truncate">
              To {course.teacher ?? "your teacher"} · {course.name}
            </div>
          </div>
          <button onClick={onClose} className="glass h-9 w-9 grid place-items-center active:scale-95 rounded-xl">
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Intent selector */}
        <div className="px-5 pb-3 shrink-0">
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {intents.map((it) => {
              const active = intent === it;
              return (
                <button
                  key={it}
                  onClick={() => setIntent(it)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    active ? "text-[#090915]" : "text-muted-foreground border-white/10"
                  }`}
                  style={
                    active
                      ? { background: "var(--primary)", borderColor: "transparent", boxShadow: "0 0 12px -3px var(--primary)" }
                      : undefined
                  }
                >
                  {intentLabel(it)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
          <div className="glass rounded-2xl p-3" style={{ backdropFilter: "blur(12px)" }}>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Subject</div>
            <div className="text-sm font-semibold">{subject}</div>
          </div>
          <div className="glass rounded-2xl p-3" style={{ backdropFilter: "blur(12px)" }}>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Draft</div>
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-foreground/90">{body}</pre>
          </div>
        </div>

        <div className="flex gap-3 p-5 pt-3 shrink-0 border-t border-white/5">
          <button
            onClick={copyAll}
            className="flex-1 glass rounded-2xl py-3 flex items-center justify-center gap-2 text-sm font-semibold active:scale-[0.98]"
          >
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.span key="ok" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-success">
                  <Check className="h-4 w-4" /> Copied
                </motion.span>
              ) : (
                <motion.span key="copy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                  <Copy className="h-4 w-4" /> Copy
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          <button
            onClick={openMail}
            className="flex-1 rounded-2xl py-3 flex items-center justify-center gap-2 text-sm font-bold text-[#090915] active:scale-[0.98]"
            style={{ background: "var(--primary)", boxShadow: "0 0 18px -4px var(--primary)" }}
          >
            <Send className="h-4 w-4" /> Open mail
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/** Whether an assignment qualifies for a one-tap Aura Assist email. */
export function needsAssist(a: Assignment): boolean {
  if (a.missing || a.absent) return true;
  const p = assignmentPercent(a);
  return p !== null && p < 85;
}
