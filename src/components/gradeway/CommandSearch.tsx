import { useEffect, useState } from "react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useGradeway } from "@/lib/gradeway/store";

export function CommandSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { courses } = useGradeway();
  const [q, setQ] = useState("");
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);
  const all = courses.flatMap((c) => c.assignments.map((a) => ({ ...a, course: c.name })));
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search assignments, categories, or 'missing'…" value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Assignments">
          {all
            .filter((a) => {
              const s = q.toLowerCase();
              if (!s) return true;
              if (s === "missing") return a.missing;
              return a.name.toLowerCase().includes(s) || a.category.toLowerCase().includes(s) || a.course.toLowerCase().includes(s);
            })
            .slice(0, 12)
            .map((a) => (
              <CommandItem key={a.id} value={`${a.name} ${a.category} ${a.course}`}>
                <div className="flex w-full items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.course} · {a.category}</div>
                  </div>
                  {a.missing ? <span className="text-xs text-red-300">Missing</span> : <span className="text-xs tabular-nums">{a.score}/{a.outOf}</span>}
                </div>
              </CommandItem>
            ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}