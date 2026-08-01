import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIER_LABELS, TIER_ORDER, type GpaCourse, type TierId } from "@/lib/gpacalc/types";
import { entriesForCourse, gradePoints, type ResolvedScale } from "@/lib/gpacalc/engine";

interface Props {
  courses: GpaCourse[];
  scale: ResolvedScale;
  onUpdate: (id: string, patch: Partial<GpaCourse>) => void;
  onRemove: (id: string) => void;
}

export function CourseTable({ courses, scale, onUpdate, onRemove }: Props) {
  if (!courses.length) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
        <p className="text-sm text-muted-foreground">
          No courses yet — paste your HAC transcript above or add one manually.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card/70 backdrop-blur-xl">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Course</th>
              <th className="px-3 py-3 font-medium">Year</th>
              <th className="px-3 py-3 font-medium">Lvl</th>
              <th className="px-3 py-3 font-medium">Difficulty</th>
              <th className="px-3 py-3 font-medium">S1</th>
              <th className="px-3 py-3 font-medium">S2</th>
              <th className="px-3 py-3 font-medium">Final</th>
              <th className="px-3 py-3 font-medium">Credits</th>
              <th className="px-3 py-3 font-medium">Pts</th>
              <th className="px-3 py-3 font-medium">Exempt</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => {
              const entries = entriesForCourse(c);
              const pts = entries.length
                ? (
                    entries.reduce(
                      (s, e) => s + gradePoints(e.numeric, e.tier, scale) * e.credits,
                      0,
                    ) / entries.reduce((s, e) => s + e.credits, 0)
                  ).toFixed(2)
                : "—";
              return (
                <tr
                  key={c.id}
                  className={`border-b border-border/60 transition-colors hover:bg-secondary/30 ${
                    c.exempt ? "opacity-55" : ""
                  }`}
                >
                  <td className="px-4 py-2">
                    <Input
                      value={c.name}
                      placeholder="Course name"
                      onChange={(e) => onUpdate(c.id, { name: e.target.value })}
                      className="h-9 min-w-[180px]"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={c.year}
                      placeholder="2024-2025"
                      onChange={(e) => onUpdate(c.id, { year: e.target.value })}
                      className="h-9 w-28"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={c.gradeLevel ?? ""}
                      placeholder="9"
                      inputMode="numeric"
                      onChange={(e) =>
                        onUpdate(c.id, {
                          gradeLevel: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="h-9 w-14"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={c.tier}
                      onValueChange={(v) => onUpdate(c.id, { tier: v as TierId })}
                    >
                      <SelectTrigger className="h-9 w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIER_ORDER.map((t) => (
                          <SelectItem key={t} value={t}>
                            {TIER_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  {(["sem1", "sem2", "final"] as const).map((k) => (
                    <td key={k} className="px-3 py-2">
                      <Input
                        value={c[k]}
                        placeholder="—"
                        onChange={(e) => onUpdate(c.id, { [k]: e.target.value })}
                        className="h-9 w-16 text-center tabular-nums"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <Input
                      value={c.credits}
                      inputMode="decimal"
                      onChange={(e) => onUpdate(c.id, { credits: Number(e.target.value) || 0 })}
                      className="h-9 w-16 text-center tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-2 text-center font-medium tabular-nums text-primary">
                    {c.exempt ? "—" : pts}
                  </td>
                  <td className="px-3 py-2">
                    <Switch
                      checked={c.exempt}
                      onCheckedChange={(v) => onUpdate(c.id, { exempt: v })}
                      aria-label="Exempt from GPA"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => onRemove(c.id)}
                      aria-label={`Delete ${c.name || "course"}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
