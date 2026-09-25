export const LAST_CONTEXT_KEY = "syncly:lastContext";

/** Read by _authenticated/route.tsx's beforeLoad routing decision. */
export function getLastContext(): "squad" | "family" | null {
  if (typeof localStorage === "undefined") return null;
  const v = localStorage.getItem(LAST_CONTEXT_KEY);
  return v === "squad" || v === "family" ? v : null;
}
