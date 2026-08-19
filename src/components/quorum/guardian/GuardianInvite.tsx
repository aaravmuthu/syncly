import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Link2, MessageSquare, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Card } from "@/components/quorum/ui";
import { getMySyncCode } from "@/lib/quorum/guardian.functions";

/**
 * Teen-side invite: turns the 6-digit pairing code into a one-tap parent
 * invite link (/guardian?invite=123456) that links the parent's account and
 * drops them straight into the teen's radar.
 */
export function GuardianInvite({ className }: { className?: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const gen = useMutation({
    mutationFn: useServerFn(getMySyncCode),
    onSuccess: (r: { code: string }) => setCode(r.code),
    onError: (e: unknown) =>
      toast.error("Couldn't create an invite", {
        description: e instanceof Error ? e.message : "Try again in a moment.",
      }),
  });

  useEffect(() => {
    gen.mutate(undefined as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const origin = typeof window === "undefined" ? "https://syncly.website" : window.location.origin;
  const inviteUrl = code ? `${origin}/guardian?invite=${code}` : "";
  const smsBody = `Link to my Syncly radar so you can see I got there safe: ${inviteUrl}`;

  const copy = async (value: string, which: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
      toast.success(which === "code" ? "Code copied" : "Invite link copied");
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
  };

  const share = async () => {
    if (!inviteUrl) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Syncly parent invite", text: smsBody, url: inviteUrl });
        return;
      } catch {
        /* user dismissed — fall through to copy */
      }
    }
    void copy(inviteUrl, "link");
  };

  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Invite a parent</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Send this link to link their account and give them your live radar.
          </p>
        </div>
        <QrCode className="size-5 shrink-0 text-primary" aria-hidden />
      </div>

      <div className="mt-3 rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-center">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Pairing code
        </div>
        <div className="font-display text-3xl font-semibold tabular-nums tracking-[0.3em]">
          {code ?? "······"}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          onClick={share}
          disabled={!code}
          loading={gen.isPending && !code}
          className="flex-1"
        >
          <Link2 className="mr-1.5 size-4" aria-hidden />
          Share invite link
        </Button>
        <Button
          variant="ghost"
          disabled={!code}
          onClick={() => code && copy(code, "code")}
          aria-label="Copy pairing code"
        >
          {copied === "code" ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
        </Button>
        {code ? (
          <a
            href={`sms:&body=${encodeURIComponent(smsBody)}`}
            className="tap-target inline-flex items-center justify-center rounded-2xl border border-border px-3 text-sm font-medium transition hover:bg-secondary"
          >
            <MessageSquare className="mr-1.5 size-4" aria-hidden />
            Text it
          </a>
        ) : null}
      </div>
    </Card>
  );
}
