export function statusLabel(status: string) {
  if (status === "voting") return "Voting open";
  if (status === "collecting") return "Collecting answers";
  if (status === "recommending") return "Finding options";
  if (status === "finalized") return "Confirmed";
  if (status === "completed") return "Completed";
  // Only ever set by settlePastPlans() for plans whose time ran out unlocked.
  if (status === "cancelled") return "Expired";
  return "Draft";
}

export function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  return x;
}

export const dayKey = (d: Date | string) => {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(
    x.getDate(),
  ).padStart(2, "0")}`;
};

export function formatWhen(iso?: string | null) {
  if (!iso) return "Date TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date TBD";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
