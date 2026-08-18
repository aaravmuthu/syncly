import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/quorum/Avatar";
import { Button, Card, Pill, Skeleton } from "@/components/quorum/ui";
import {
  getMyGuardians,
  getMySyncCode,
  setLocationSharing,
  unlinkGuardian,
} from "@/lib/quorum/guardian.functions";

/**
 * Teen-side pairing card: shows the permanent 6-digit sync code, who is
 * currently linked, and the single switch that controls location sharing.
 */
export function GuardianSyncCard({ sharing }: { sharing: boolean }) {
  const qc = useQueryClient();
  const [revealed, setRevealed] = useState(false);
  const codeFn = useServerFn(getMySyncCode);
  const code = useQuery({
    queryKey: ["sync-code"],
    queryFn: () => codeFn(),
    enabled: revealed,
    staleTime: Infinity,
  });
  const guardians = useQuery({ queryKey: ["my-guardians"], queryFn: useServerFn(getMyGuardians) });

  const share = useMutation({
    mutationFn: useServerFn(setLocationSharing),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Location sharing updated");
    },
  });
  const unlink = useMutation({
    mutationFn: useServerFn(unlinkGuardian),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-guardians"] });
      toast.success("Parent unlinked");
    },
  });

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Parent pairing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Share your code so a parent can see your plans, rides and — only if you allow it — your
          live location. Your private answers stay private.
        </p>
      </div>

      {revealed ? (
        code.isLoading ? (
          <Skeleton className="h-14 rounded-2xl" />
        ) : (
          <div className="rounded-2xl border border-border bg-secondary/50 px-4 py-3 text-center">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Your sync code
            </div>
            <div className="font-display text-3xl font-semibold tracking-[0.35em] tabular-nums">
              {code.data?.code}
            </div>
          </div>
        )
      ) : (
        <Button variant="outline" onClick={() => setRevealed(true)}>
          Show my sync code
        </Button>
      )}

      <label className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3">
        <span>
          <span className="text-sm font-medium">Share live location</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Only linked parents see it. Turn it off any time.
          </span>
        </span>
        <input
          type="checkbox"
          className="size-5 accent-emerald-500"
          checked={sharing}
          onChange={(e) => share.mutate({ data: { enabled: e.target.checked } })}
        />
      </label>

      <div className="space-y-2">
        <div className="text-sm font-medium">Linked parents</div>
        {guardians.isLoading ? (
          <Skeleton className="h-12 rounded-2xl" />
        ) : (guardians.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody is linked to your account yet.</p>
        ) : (
          (guardians.data ?? []).map((g) => {
            const p = g.guardian as unknown as {
              display_name?: string;
              avatar_emoji?: string;
              avatar_url?: string | null;
            } | null;
            return (
              <div
                key={g.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Avatar
                    url={p?.avatar_url ?? null}
                    emoji={p?.avatar_emoji}
                    name={p?.display_name}
                    size={30}
                  />
                  <div>
                    <div className="text-sm font-medium">{p?.display_name ?? "Parent"}</div>
                    <Pill tone="good">{g.relation ?? "parent"}</Pill>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className="text-destructive"
                  loading={unlink.isPending}
                  onClick={() => unlink.mutate({ data: { linkId: g.id } })}
                >
                  Unlink
                </Button>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
