import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Minus, Plus } from "lucide-react";
import { CONCEPT_BY_ID, conceptsForCourse } from "@/lib/studygraph/curriculum";
import { STATUS_META, graphLayout, retention, recordFor, statusOf } from "@/lib/studygraph/engine";
import { useStudyGraph } from "@/lib/studygraph/store";
import type { ConceptStatus } from "@/lib/studygraph/types";

interface Props {
  courseId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  filter?: ConceptStatus | "all";
  query?: string;
  highlightPath?: string[];
  className?: string;
}

const MIN_K = 0.3;
const MAX_K = 2.4;
const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));

export function GraphCanvas({
  courseId,
  selectedId,
  onSelect,
  filter = "all",
  query = "",
  highlightPath = [],
  className,
}: Props) {
  const { state } = useStudyGraph();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 0.7 });
  const viewRef = useRef(view);
  viewRef.current = view;

  /** Live pointers for pan + pinch. */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; cx: number; cy: number; k: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const moved = useRef(false);

  const layout = useMemo(() => graphLayout(courseId), [courseId]);
  const positions = useMemo(() => new Map(layout.map((n) => [n.id, n])), [layout]);
  const concepts = useMemo(() => conceptsForCourse(courseId), [courseId]);

  const edges = useMemo(() => {
    const list: { from: string; to: string }[] = [];
    for (const concept of concepts) {
      for (const p of concept.prerequisites) {
        if (positions.has(p)) list.push({ from: p, to: concept.id });
      }
    }
    return list;
  }, [concepts, positions]);

  const bounds = useMemo(() => {
    const xs = layout.map((n) => n.x);
    const ys = layout.map((n) => n.y);
    const minX = Math.min(...xs) - 120;
    const minY = Math.min(...ys) - 120;
    return {
      minX,
      minY,
      w: Math.max(...xs) - minX + 160,
      h: Math.max(...ys) - minY + 160,
    };
  }, [layout]);

  /** Fit the whole graph on first paint and whenever the course changes. */
  const fit = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const k = clampK(Math.min(rect.width / bounds.w, rect.height / bounds.h) * 0.92);
    setView({
      x: (rect.width - bounds.w * k) / 2,
      y: (rect.height - bounds.h * k) / 2,
      k,
    });
  }, [bounds]);

  useLayoutEffect(() => {
    fit();
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);


  /** Focus the selected node without yanking zoom. */
  useEffect(() => {
    if (!selectedId) return;
    const pos = positions.get(selectedId);
    const el = wrapRef.current;
    if (!pos || !el) return;
    const rect = el.getBoundingClientRect();
    const { k } = viewRef.current;
    const nx = rect.width / 2 - (pos.x - bounds.minX) * k;
    const ny = rect.height / 2 - (pos.y - bounds.minY) * k;
    const cur = viewRef.current;
    if (Math.abs(nx - cur.x) < 24 && Math.abs(ny - cur.y) < 24) return;
    setView({ x: nx, y: ny, k });
  }, [selectedId, positions, bounds]);

  /** Zoom around a point given in container-local pixels. */
  const zoomAt = useCallback((nextK: number, px: number, py: number) => {
    setView((v) => {
      const k = clampK(nextK);
      const ratio = k / v.k;
      return { k, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio };
    });
  }, []);

  const zoomCenter = (factor: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    zoomAt(viewRef.current.k * factor, rect.width / 2, rect.height / 2);
  };

  /** Non-passive wheel + trackpad pinch. */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomAt(
        viewRef.current.k * Math.exp(-dy * 0.0018),
        e.clientX - rect.left,
        e.clientY - rect.top,
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const matches = (id: string) => {
    const concept = CONCEPT_BY_ID.get(id);
    if (!concept) return false;
    if (query && !concept.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter !== "all" && statusOf(state, concept) !== filter) return false;
    return true;
  };

  const localPoint = (e: React.PointerEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const p = localPoint(e);
    pointers.current.set(e.pointerId, p);
    moved.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        dist: Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1,
        cx: (a!.x + b!.x) / 2,
        cy: (a!.y + b!.y) / 2,
        k: viewRef.current.k,
      };
      panStart.current = null;
    } else {
      panStart.current = { x: p.x, y: p.y, vx: view.x, vy: view.y };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = localPoint(e);
    pointers.current.set(e.pointerId, p);

    if (pointers.current.size >= 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1;
      moved.current = true;
      zoomAt(gesture.current.k * (dist / gesture.current.dist), gesture.current.cx, gesture.current.cy);
      return;
    }

    if (!panStart.current) return;
    const dx = p.x - panStart.current.x;
    const dy = p.y - panStart.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true;
    setView((v) => ({ ...v, x: panStart.current!.vx + dx, y: panStart.current!.vy + dy }));
  };

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
    if (pointers.current.size === 0) panStart.current = null;
  };

  const tap = (id: string) => {
    if (moved.current) return;
    onSelect(id);
  };

  return (
    <div
      className={
        className ??
        "relative h-[62dvh] min-h-[380px] w-full overflow-hidden rounded-3xl border border-border bg-background/40"
      }
    >
      <div
        ref={wrapRef}
        className="h-full w-full touch-none overscroll-none cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
      >
        <div
          style={{
            width: bounds.w,
            height: bounds.h,
            transformOrigin: "0 0",
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
            willChange: "transform",
          }}
        >
          <svg
            width={bounds.w}
            height={bounds.h}
            viewBox={`${bounds.minX} ${bounds.minY} ${bounds.w} ${bounds.h}`}
          >
            <g>
              {edges.map((edge) => {
                const a = positions.get(edge.from)!;
                const b = positions.get(edge.to)!;
                const onPath = highlightPath.includes(edge.from) && highlightPath.includes(edge.to);
                const active = selectedId === edge.from || selectedId === edge.to || onPath;
                const strength = retention(recordFor(state, edge.from));
                const mid = (a.x + b.x) / 2;
                return (
                  <path
                    key={`${edge.from}-${edge.to}`}
                    d={`M${a.x},${a.y} C${mid},${a.y} ${mid},${b.y} ${b.x},${b.y}`}
                    fill="none"
                    stroke={
                      active
                        ? "var(--primary)"
                        : strength < 0.5
                          ? "color-mix(in oklab, var(--destructive) 45%, transparent)"
                          : "color-mix(in oklab, var(--foreground) 16%, transparent)"
                    }
                    strokeWidth={active ? 2.6 : 1.3}
                    strokeDasharray={strength < 0.5 ? "6 6" : undefined}
                    style={
                      active
                        ? { animation: "sg-dash 1.4s linear infinite", strokeDasharray: "8 8" }
                        : undefined
                    }
                    opacity={active ? 0.95 : 0.45}
                  />
                );
              })}
            </g>
            <g>
              {concepts.map((concept) => {
                const pos = positions.get(concept.id);
                if (!pos) return null;
                const status = statusOf(state, concept);
                const meta = STATUS_META[status];
                const r = retention(recordFor(state, concept.id));
                const dim = !matches(concept.id);
                const selected = selectedId === concept.id;
                const radius = 22 + concept.importance * 3.2;
                return (
                  <g
                    key={concept.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    opacity={dim ? 0.2 : 1}
                    style={{ cursor: "pointer" }}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                      tap(concept.id);
                    }}
                  >
                    {selected ? (
                      <circle
                        r={radius + 12}
                        fill="none"
                        stroke="var(--primary)"
                        strokeWidth={1.5}
                        opacity={0.5}
                      />
                    ) : null}
                    {/* generous invisible touch target */}
                    <circle r={radius + 14} fill="transparent" />
                    <circle
                      r={radius}
                      fill={`color-mix(in oklab, ${meta.token} ${18 + r * 45}%, var(--background))`}
                      stroke={meta.token}
                      strokeWidth={selected ? 3 : 1.6}
                    />
                    <circle
                      r={radius - 6}
                      fill="none"
                      stroke={meta.token}
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * (radius - 6) * r} ${2 * Math.PI * (radius - 6)}`}
                      transform="rotate(-90)"
                      opacity={0.85}
                    />
                    <text
                      y={radius + 19}
                      textAnchor="middle"
                      fontSize={14}
                      fill="var(--foreground)"
                      style={{ pointerEvents: "none", fontWeight: 500 }}
                    >
                      {concept.name.length > 24 ? `${concept.name.slice(0, 22)}…` : concept.name}
                    </text>
                    <text
                      y={5}
                      textAnchor="middle"
                      fontSize={13}
                      fill="var(--foreground)"
                      style={{ pointerEvents: "none", fontWeight: 600 }}
                    >
                      {Math.round(r * 100)}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </div>

      {/* Zoom controls — thumb reachable */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1 rounded-2xl border border-border bg-popover/90 p-1 backdrop-blur-xl">
        <button
          className="grid h-9 w-9 place-items-center rounded-xl hover:bg-secondary"
          onClick={() => zoomCenter(1.25)}
          aria-label="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          className="grid h-9 w-9 place-items-center rounded-xl hover:bg-secondary"
          onClick={() => zoomCenter(0.8)}
          aria-label="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          className="grid h-9 w-9 place-items-center rounded-xl hover:bg-secondary"
          onClick={fit}
          aria-label="Fit graph to screen"
        >
          <Crosshair className="h-4 w-4" />
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap gap-x-3 gap-y-1 rounded-2xl border border-border bg-popover/80 px-3 py-2 pr-16 text-[10px] backdrop-blur-xl">
        {(["mastered", "strong", "developing", "weak", "locked"] as ConceptStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: STATUS_META[s].token }} />
            {STATUS_META[s].label}
          </span>
        ))}
      </div>
    </div>
  );
}
