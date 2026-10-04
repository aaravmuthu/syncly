// Pure layout helpers shared by DM and squad threads: which consecutive
// messages form one visual cluster (tails, corner radii, sender labels) and
// where a centered time header belongs.

export type ClusterPos = "single" | "first" | "middle" | "last";

export type Row<T> = {
  item: T;
  pos: ClusterPos;
  /** Centered time header rendered above this row, or null. */
  header: string | null;
};

type Meta = { id: string; sender: string | null; at: string; system: boolean };

/** Same sender within this long stays one cluster. */
const CLUSTER_GAP_MS = 5 * 60_000;
/** A longer silence than this earns a centered time header. */
const HEADER_GAP_MS = 30 * 60_000;

export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "3:42 PM", "Yesterday 3:42 PM", "Mon 3:42 PM", "Oct 2, 3:42 PM". */
export function headerLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days <= 0) return clock(iso);
  if (days === 1) return `Yesterday ${clock(iso)}`;
  if (days < 7) return `${d.toLocaleDateString([], { weekday: "short" })} ${clock(iso)}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${clock(iso)}`;
}

export function layoutRows<T>(items: T[], meta: (item: T) => Meta): Row<T>[] {
  const m = items.map(meta);
  const headers = m.map((cur, i) => {
    const prev = m[i - 1];
    if (!prev) return headerLabel(cur.at);
    const gap = new Date(cur.at).getTime() - new Date(prev.at).getTime();
    const newDay = startOfDay(new Date(cur.at)) !== startOfDay(new Date(prev.at));
    return gap > HEADER_GAP_MS || newDay ? headerLabel(cur.at) : null;
  });

  const joins = (a: Meta | undefined, b: Meta | undefined, bHeader: string | null) =>
    Boolean(
      a &&
      b &&
      !bHeader &&
      !a.system &&
      !b.system &&
      a.sender === b.sender &&
      new Date(b.at).getTime() - new Date(a.at).getTime() < CLUSTER_GAP_MS,
    );

  return items.map((item, i) => {
    const joinPrev = joins(m[i - 1], m[i], headers[i]);
    const joinNext = joins(m[i], m[i + 1], headers[i + 1] ?? null);
    const pos: ClusterPos = joinPrev
      ? joinNext
        ? "middle"
        : "last"
      : joinNext
        ? "first"
        : "single";
    return { item, pos, header: headers[i] ?? null };
  });
}
