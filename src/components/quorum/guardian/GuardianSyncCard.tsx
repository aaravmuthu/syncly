import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "@/lib/quorum/toast";
import { Check, Copy, Link2, MessageSquare } from "lucide-react";
import { Avatar } from "@/components/quorum/Avatar";
import { QrCode } from "@/components/quorum/QrCode";
import { Button, Card, Pill, Skeleton } from "@/components/quorum/ui";
import { Switch } from "@/components/ui/switch";
import {
  answerLinkRequest,
  getMyGuardians,
  getMyLinkRequests,
  getMySyncCode,
  setLocationSharing,
  unlinkGuardian,
} from "@/lib/quorum/guardian.functions";

/**
 * Teen-side pairing card: reveal-on-tap 6-digit sync code (single-use,
 * expires an hour after it's issued -- see ensureSyncCode) with a real
 * scannable QR code plus share-sheet/copy/SMS actions, parent link requests
 * waiting on the teen's approval (a code alone never links anyone), who is
 * currently linked, and the single switch that controls location sharing. This is the
 * one pairing UI in the app -- it used to be split between this bare
 * text-code reveal and a separate, richer GuardianInvite card that (by a
 * placement bug) was also showing up on the *guardian's* own hub screen with
 * teen-facing copy ("Invite a parent"). Both are merged here.
 */
export function GuardianSyncCard({ sharing }: { sharing: boolean }) {
  const qc = useQueryClient();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const codeFn = useServerFn(getMySyncCode);
  const code = useQuery({
    queryKey: ["sync-code"],
    queryFn: () => codeFn(),
    enabled: revealed,
    // The server hands back the same code until it's near expiry, so a short
    // stale time just keeps the card from showing a code that already lapsed.
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
  const expiresAt = code.data?.expiresAt ? new Date(code.data.expiresAt) : null;
  const guardians = useQuery({ queryKey: ["my-guardians"], queryFn: useServerFn(getMyGuardians) });
  const requests = useQuery({
    queryKey: ["my-link-requests"],
    queryFn: useServerFn(getMyLinkRequests),
    refetchInterval: 30_000,
  });
  const answer = useMutation({
    mutationFn: useServerFn(answerLinkRequest),
    onSuccess: (r: { approved: boolean }) => {
      void qc.invalidateQueries({ queryKey: ["my-link-requests"] });
      void qc.invalidateQueries({ queryKey: ["my-guardians"] });
      toast.success(r.approved ? "Parent linked" : "Request declined");
    },
    onError: (e: unknown) => {
      void qc.invalidateQueries({ queryKey: ["my-link-requests"] });
      toast.error("Couldn't answer that request", {
        description: e instanceof Error ? e.message : "Try again.",
      });
    },
  });

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

  const origin = typeof window === "undefined" ? "https://syncly.website" : window.location.origin;
  const inviteUrl = code.data?.code ? `${origin}/guardian?invite=${code.data.code}` : "";
  const smsBody = `Link to my Syncly radar so you can see I got there safe: ${inviteUrl}`;

  const copyValue = async (value: string, which: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
      toast.success(which === "code" ? "Code copied" : "Invite link copied");
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
  };

  const shareInvite = async () => {
    if (!inviteUrl) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Syncly parent invite", text: smsBody, url: inviteUrl });
        return;
      } catch {
        /* user dismissed — fall through to copy */
      }
    }
    void copyValue(inviteUrl, "link");
  };

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
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-secondary/50 px-4 py-3 text-center">
              <div className="text-caption text-muted-foreground">Your sync code</div>
              <div className="font-display text-3xl font-semibold tracking-[0.35em] tabular-nums">
                {code.data?.code}
              </div>
              {expiresAt ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  Works once, until{" "}
                  {expiresAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </div>
              ) : null}
            </div>
            {inviteUrl ? (
              <div className="flex justify-center">
                <QrCode value={inviteUrl} size={160} />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button onClick={shareInvite} disabled={!code.data?.code} className="flex-1">
                <Link2 className="mr-1.5 size-4" aria-hidden />
                Share invite link
              </Button>
              <Button
                variant="ghost"
                disabled={!code.data?.code}
                onClick={() => code.data?.code && copyValue(code.data.code, "code")}
                aria-label="Copy pairing code"
              >
                {copied === "code" ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  <Copy className="size-4" aria-hidden />
                )}
              </Button>
              {code.data?.code ? (
                <a
                  href={`sms:&body=${encodeURIComponent(smsBody)}`}
                  className="tap-target inline-flex items-center justify-center rounded-2xl border border-border px-3 text-sm font-medium transition hover:bg-secondary"
                >
                  <MessageSquare className="mr-1.5 size-4" aria-hidden />
                  Text it
                </a>
              ) : null}
            </div>
          </div>
        )
      ) : (
        <Button variant="outline" onClick={() => setRevealed(true)}>
          Show my sync code
        </Button>
      )}

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3">
        <button
          type="button"
          className="flex-1 text-left"
          onClick={() => share.mutate({ data: { enabled: !sharing } })}
        >
          <span className="block text-sm font-medium">Share live location</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Only linked parents see it — never your squad or friends. Turn it off any time.
          </span>
        </button>
        <Switch
          checked={sharing}
          onCheckedChange={(checked) => share.mutate({ data: { enabled: checked } })}
          aria-label="Share live location"
        />
      </div>

      {(requests.data ?? []).length > 0 ? (
        <div className="space-y-2">
          <div className="text-sm font-medium">Wants to link</div>
          <p className="text-xs text-muted-foreground">
            Only approve someone you know. Once linked they can see your plans, rides and — if you
            share it — your live location.
          </p>
          {(requests.data ?? []).map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-primary/40 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Avatar
                  url={r.guardian?.avatar_url ?? null}
                  emoji={r.guardian?.avatar_emoji}
                  name={r.guardian?.display_name}
                  size={30}
                />
                <div className="truncate text-sm font-medium">
                  {r.guardian?.display_name ?? "Parent"}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  disabled={answer.isPending}
                  onClick={() => answer.mutate({ data: { requestId: r.id, approve: false } })}
                >
                  Decline
                </Button>
                <Button
                  disabled={answer.isPending}
                  onClick={() => answer.mutate({ data: { requestId: r.id, approve: true } })}
                >
                  Approve
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

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
