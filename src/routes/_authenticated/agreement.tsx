import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button, Card } from "@/components/quorum/ui";
import { acceptTerms } from "@/lib/quorum/account.functions";
import { supabase } from "@/integrations/supabase/client";
import { LEGAL } from "@/lib/legal";

export const Route = createFileRoute("/_authenticated/agreement")({
  validateSearch: (search: Record<string, unknown>) => ({
    next:
      typeof search.next === "string" &&
      search.next.startsWith("/") &&
      !search.next.startsWith("//") &&
      !search.next.includes("\\") &&
      !search.next.startsWith("/agreement")
        ? search.next
        : "/home",
  }),
  head: () => ({ meta: [{ title: "Your agreement — Syncly" }] }),
  component: AgreementPage,
});

function AgreementPage() {
  const [accepted, setAccepted] = useState(false);
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const record = useServerFn(acceptTerms);
  const save = useMutation({
    mutationFn: async () => {
      if (!accepted) throw new Error("Please check the agreement box to continue.");
      await record({ data: { accepted: true } });
      const { error } = await supabase.auth.refreshSession();
      if (error) throw error;
    },
    onSuccess: () => void navigate({ to: next, replace: true }),
  });
  return (
    <main className="paper-field grid min-h-dvh place-items-center px-5 py-12">
      <Card className="w-full max-w-lg space-y-5">
        <h1 className="font-display text-2xl font-semibold">Review your agreement</h1>
        <p className="text-sm text-muted-foreground">
          Please review the terms updated {LEGAL.effectiveDate}. Your choice is recorded with the
          policy version and time. This does not consent to optional cookies or marketing emails.
        </p>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-1 size-4 shrink-0 accent-primary"
          />
          <span>
            I agree to the{" "}
            <Link to="/terms" className="underline">
              Terms of Service
            </Link>{" "}
            and acknowledge the{" "}
            <Link to="/privacy" className="underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        {save.isError && (
          <p role="alert" className="text-sm text-destructive">
            {save.error.message}
          </p>
        )}
        <Button disabled={!accepted} loading={save.isPending} onClick={() => save.mutate()}>
          Agree & continue
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            await supabase.auth.signOut();
            void navigate({ to: "/", replace: true });
          }}
        >
          Sign out
        </Button>
      </Card>
    </main>
  );
}
