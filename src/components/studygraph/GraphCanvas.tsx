import { useMemo, useRef, useState } from "react";
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
}

export function GraphCanvas({
  courseId,
  selectedId,
  onSelect,
  filter = "all",
  query = "",
  highlightPath = [],
}: Props) {
  const { state } = useStudyGraph();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 0.85 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const layout = useMemo(() => graphLayout(courseId), [courseId]);
  const positions = useMemo(
    () => new Map(layout.map((n) => [n.id, n])),
    [layout],
  );
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
    return {
      w: Math.max(...xs) + 320,
      h: Math.max(...ys) + 320,
      minY: Math.min(...ys) - 160,
    };
  }, [layout]);

  const matches = (id: string) => {
    const concept = CONCEPT_BY_ID.get(id);
    if (!concept) return false;
    if (query && !concept.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter !== "all" && statusOf(state, concept) !== filter) return false;
    return true;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setView((v) => ({
      ...v,
      x: drag.current!.vx + (e.clientX - drag.current!.x),
      y: drag.current!.vy + (e.clientY - drag.current!.y),
    }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const zoom = (delta: number) =>
    setView((v) => ({ ...v, k: Math.min(1.8, Math.max(0.35, v.k + delta)) }));

  return (
    <div className="relative h-[68vh] min-h-[460px] w-full overflow-hidden rounded-3xl border border-border bg-background/40">
      <div
        ref={wrapRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={(e) => zoom(e.deltaY > 0 ? -0.08 : 0.08)}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 ${bounds.minY} ${bounds.w} ${bounds.h}`}
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
            transformOrigin: "center center",
            transition: drag.current ? "none" : "transform 220ms ease-out",
          }}
        >
          <g>
            {edges.map((edge) => {
              const a = positions.get(edge.from)!;
              const b = positions.get(edge.to)!;
              const onPath =
                highlightPath.includes(edge.from) && highlightPath.includes(edge.to);
              const active =
                selectedId === edge.from || selectedId === edge.to || onPath;
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
                  strokeWidth={active ? 2.4 : 1.3}
                  strokeDasharray={strength < 0.5 ? "6 6" : undefined}
                  style={
                    active
                      ? { animation: "sg-dash 1.4s linear infinite", strokeDasharray: "8 8" }
                      : undefined
                  }
                  opacity={active ? 0.95 : 0.5}
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
              const radius = 20 + concept.importance * 3.2;
              return (
                <g
                  key={concept.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  opacity={dim ? 0.22 : 1}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(concept.id);
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
                    y={radius + 18}
                    textAnchor="middle"
                    fontSize={13}
                    fill="var(--foreground)"
                    style={{ pointerEvents: "none", fontWeight: 500 }}
                  >
                    {concept.name.length > 26 ? `${concept.name.slice(0, 24)}…` : concept.name}
                  </text>
                  <text
                    y={4}
                    textAnchor="middle"
                    fontSize={12}
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

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
        <div className="glass pointer-events-auto flex flex-wrap gap-3 rounded-2xl px-3 py-2 text-[11px]">
          {(["mastered", "strong", "developing", "weak", "locked"] as ConceptStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: STATUS_META[s].token }}
              />
              {STATUS_META[s].label}
            </span>
          ))}
        </div>
        <div className="glass pointer-events-auto flex items-center gap-1 rounded-2xl p-1">
          <button className="h-8 w-8 rounded-xl hover:bg-secondary" onClick={() => zoom(-0.12)} aria-label="Zoom out">
            −
          </button>
          <button
            className="h-8 rounded-xl px-2 text-xs hover:bg-secondary"
            onClick={() => setView({ x: 0, y: 0, k: 0.85 })}
          >
            Reset
          </button>
          <button className="h-8 w-8 rounded-xl hover:bg-secondary" onClick={() => zoom(0.12)} aria-label="Zoom in">
            +
          </button>
        </div>
      </div>
    </div>
  );
}
