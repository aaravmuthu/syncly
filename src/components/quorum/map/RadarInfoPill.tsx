import { useState } from "react";
import { motion } from "motion/react";
import { ShieldCheck, X } from "lucide-react";

/**
 * Replaces the old boxed "Live radar" header card: a small floating pill
 * over the map that expands into the same title/description on tap, instead
 * of permanently occupying page space above a now-full-screen map.
 */
export function RadarInfoPill() {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="map-glass pointer-events-auto absolute left-3 top-16 z-10 max-w-[280px] overflow-hidden rounded-3xl"
    >
      {open ? (
        <motion.div layout="position" className="p-4" id="radar-info-pill-content">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
              <ShieldCheck className="h-4 w-4" aria-hidden /> Live radar
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Collapse live radar info"
              aria-expanded="true"
              aria-controls="radar-info-pill-content"
              className="tap-target -m-2 grid place-items-center text-muted-foreground"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <h2 className="mt-1 font-display text-base font-semibold text-foreground">
            Everyone, on one map
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Live pins update while a hangout is running. Safe-zone arrivals ping linked parents
            automatically.
          </p>
        </motion.div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Show live radar info"
          aria-expanded="false"
          aria-controls="radar-info-pill-content"
          className="tap-target flex items-center gap-1.5 px-4 text-sm font-semibold text-primary"
        >
          <ShieldCheck className="h-4 w-4" aria-hidden /> Live radar
        </button>
      )}
    </motion.div>
  );
}
