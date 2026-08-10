import { AnimatePresence, motion } from "motion/react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useHac } from "@/lib/hac/store";

/** Subtle glowing "Data Encrypted & Saved" pill shown whenever data is written. */
export function SaveIndicator() {
  const { saveState } = useHac();
  return (
    <AnimatePresence>
      {saveState !== "idle" ? (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[10000] glass-strong rounded-full px-3.5 py-1.5 flex items-center gap-2 text-[11px] font-semibold ${
            saveState === "saved" ? "save-glow" : ""
          }`}
          style={{ border: "1px solid color-mix(in oklab, var(--success) 40%, transparent)" }}
        >
          {saveState === "saving" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--success)" }} />
          )}
          <span style={{ color: saveState === "saved" ? "var(--success)" : undefined }}>
            {saveState === "saving" ? "Encrypting…" : "Data Encrypted & Saved"}
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
