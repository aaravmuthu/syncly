import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The shared "this is AI, and it's alive" signal: a Sparkles glyph with a
 * soft radar-pulse ring, used everywhere an AI feature identifies itself
 * (concierge, compromise banner, guardian summaries, weather guardian).
 */
export function AiGlyph({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span className="q-ai-pulse-ring" aria-hidden />
      <Sparkles className="relative h-full w-full" aria-hidden />
    </span>
  );
}
