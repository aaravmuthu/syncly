import { useState } from "react";
import { ClipboardPaste, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { blankCourse, parseHacPaste } from "@/lib/gpacalc/parse";
import type { GpaCourse } from "@/lib/gpacalc/types";

interface Props {
  onImport: (courses: GpaCourse[]) => void;
  onClear: () => void;
  activeYear: string;
  count: number;
}

const SAMPLE = `2023-2024   Grade: 9
1101  ENG I PAP        94   96   95   1.0
2201  ALG I            88   91   90   1.0
3301  BIO AP           97   99   98   1.0
9901  PE               A    A    A    0.5`;

export function ImportPanel({ onImport, onClear, activeYear, count }: Props) {
  const [text, setText] = useState("");

  function handleParse() {
    const { courses, skipped } = parseHacPaste(text);
    if (!courses.length) {
      toast.error("Nothing parsed", {
        description: "Paste rows straight from HAC's Transcript or Grades table.",
      });
      return;
    }
    onImport(courses);
    setText("");
    toast.success(`Imported ${courses.length} course${courses.length === 1 ? "" : "s"}`, {
      description: skipped ? `${skipped} line(s) skipped as non-course rows.` : "Difficulty tiers auto-detected.",
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Import from HAC</h2>
          <p className="text-sm text-muted-foreground">
            Copy the Transcript or Grades table and paste it below — courses, years, grades, credits
            and AP/Honors tags are detected automatically.
          </p>
        </div>
        <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          {count} course{count === 1 ? "" : "s"} stored locally
        </span>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={SAMPLE}
        rows={7}
        className="mt-4 resize-y font-mono text-xs"
        aria-label="Paste HAC grade data"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={handleParse} className="gap-2">
          <ClipboardPaste className="size-4" /> Parse &amp; import
        </Button>
        <Button variant="secondary" className="gap-2" onClick={() => onImport([blankCourse(activeYear, null)])}>
          <Plus className="size-4" /> Add course manually
        </Button>
        <Button variant="ghost" className="gap-2 text-destructive" onClick={onClear}>
          <Trash2 className="size-4" /> Clear all
        </Button>
      </div>
    </section>
  );
}
