import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GpaCourse } from "@/lib/gpacalc/types";
import { gpaByYear, gradeDistribution, type ResolvedScale } from "@/lib/gpacalc/engine";

const PIE_COLORS = [
  "var(--chart-3)",
  "var(--chart-2)",
  "var(--chart-4)",
  "var(--chart-1)",
  "var(--chart-5)",
];

interface Props {
  courses: GpaCourse[];
  scale: ResolvedScale;
}

export function Charts({ courses, scale }: Props) {
  const byYear = gpaByYear(courses, scale);
  const dist = gradeDistribution(courses);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur-xl">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          GPA by school year
        </h2>
        <div className="mt-4 h-64">
          {byYear.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byYear} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <XAxis dataKey="year" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  domain={[0, scale.maxPoints]}
                />
                <Tooltip
                  cursor={{ fill: "var(--secondary)", opacity: 0.4 }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--popover-foreground)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="weighted" name="Weighted" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                <Bar
                  dataKey="unweighted"
                  name="Unweighted"
                  fill="var(--chart-2)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur-xl">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Grade distribution
        </h2>
        <div className="mt-4 h-64">
          {dist.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dist}
                  dataKey="count"
                  nameKey="letter"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={3}
                  stroke="var(--background)"
                  label={({ letter, count }: { letter?: string; count?: number }) =>
                    `${letter} · ${count}`
                  }
                >
                  {dist.map((d, i) => (
                    <Cell key={d.letter} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--popover-foreground)",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </div>
      </section>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Add courses to see the breakdown.
    </div>
  );
}
