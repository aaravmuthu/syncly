import { motion } from "motion/react";
import {
  CalendarCheck,
  BellRing,
  CalendarRange,
  Mail,
  LineChart,
  FileText,
  ScrollText,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

type Item = {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tint: string; // base color token or hex
};

const ITEMS: Item[] = [
  { title: "Attendance", subtitle: "Track periods and absences", icon: CalendarCheck, tint: "var(--primary)" },
  { title: "Bell Schedule", subtitle: "Periods and the daily bell", icon: BellRing, tint: "#f59e0b" },
  { title: "Class Schedule", subtitle: "Your full course timetable", icon: CalendarRange, tint: "#3b82f6" },
  { title: "Contact Teachers", subtitle: "Email your instructors", icon: Mail, tint: "#ec4899" },
  { title: "Progress Report", subtitle: "View reporting period scores", icon: LineChart, tint: "#a855f7" },
  { title: "Report Card", subtitle: "Posted marking grades", icon: FileText, tint: "#06b6d4" },
  { title: "Transcript", subtitle: "Cumulative academic record", icon: ScrollText, tint: "#10b981" },
];

function Row({ item, index }: { item: Item; index: number }) {
  const Icon = item.icon;
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 360, damping: 30, delay: index * 0.04 }}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.97 }}
      className="liquid group w-full rounded-2xl px-3.5 py-3 flex items-center gap-3.5 text-left"
    >
      {/* Frosted color-themed icon tile */}
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
          {item.subtitle}
        </div>
      </div>

      <motion.span
        className="shrink-0 text-muted-foreground"
        variants={{ rest: { x: 0 }, move: { x: 4 } }}
        initial="rest"
        whileHover="move"
        whileTap="move"
      >
        <ChevronRight className="h-5 w-5 transition-[filter,color] duration-200 group-hover:text-primary group-hover:drop-shadow-[0_0_6px_var(--primary)]" />
      </motion.span>
    </motion.button>
  );
}

export function UtilityMenu() {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-2">Quick Access</h2>
      <div className="space-y-2.5">
        {ITEMS.map((item, i) => (
          <Row key={item.title} item={item} index={i} />
        ))}
      </div>
    </section>
  );
}
