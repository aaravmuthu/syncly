import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCompromiseSummaries } from "@/lib/quorum/ai.functions";

/** AI "why this works" lines, keyed by recommendation id. */
export function useCompromiseSummaries(planId: string, enabled: boolean) {
  const fetchSummaries = useServerFn(getCompromiseSummaries);
  return useQuery({
    queryKey: ["plan-compromise", planId],
    queryFn: () => fetchSummaries({ data: { planId } }) as Promise<Record<string, string>>,
    enabled,
    staleTime: 10 * 60_000,
  });
}
