import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  AlertTriangle,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { SubpageHeader } from "@/components/quorum/AppShell";
import { PushEnter } from "@/components/quorum/interactions";
import { Button, Card, Field, Skeleton, inputClass } from "@/components/quorum/ui";
import { Modal } from "@/components/quorum/Modal";
import { SectionHeader } from "@/components/quorum/settings/shared";
import { getMe, deleteAccount } from "@/lib/quorum/plan.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { GuardianSyncCard } from "@/components/quorum/guardian/GuardianSyncCard";

export const Route = createFileRoute("/_authenticated/_app/settings/account")({
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData({ queryKey: ["me"], queryFn: () => getMe() });
  },
  head: () => ({
    meta: [{ title: "Account & privacy — Syncly" }],
  }),
  component: AccountPage,
});

function AccountPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ["me"], queryFn: useServerFn(getMe) });
  const form = (me.data ?? {}) as Record<string, unknown>;
  const isGuardian = (form["account_type"] ?? "teen") === "guardian";

  const [passwordForm, setPasswordForm] = useState({ next: "", confirm: "" });
  const [showPw, setShowPw] = useState({ next: false, confirm: false });
  const changePassword = useMutation({
    mutationFn: async () => {
      if (passwordForm.next.length < 6) throw new Error("Use at least 6 characters");
      if (passwordForm.next !== passwordForm.confirm) throw new Error("Passwords don't match");
      const { error } = await supabase.auth.updateUser({ password: passwordForm.next });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Password updated");
      setPasswordForm({ next: "", confirm: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const removeAccount = useMutation({
    mutationFn: useServerFn(deleteAccount),
    onSuccess: async () => {
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      void navigate({ to: "/", replace: true });
    },
    onError: (e: Error) => toast.error("Couldn't delete your account", { description: e.message }),
  });

  if (me.isLoading) {
    return (
      <PushEnter>
        <SubpageHeader title="Account & privacy" backTo="/settings" />
        <Skeleton className="h-40 rounded-surface" />
      </PushEnter>
    );
  }

  return (
    <PushEnter>
      <SubpageHeader title="Account & privacy" backTo="/settings" />

      {/* Family & pairing — kept as its own clearly labeled group: sync
          code, linked parents/teens and live-location sharing all live
          together. Titled distinctly from GuardianSyncCard's own "Parent
          pairing" heading below it, to avoid a literal duplicate title. */}
      <Card className="space-y-4">
        <SectionHeader
          icon={Users}
          title="Family & pairing"
          subtitle={
            isGuardian
              ? "Link your teens with their 6-digit code to see plans, rides and safe arrivals."
              : "Pair with a parent so they can see plans, rides and safe arrivals."
          }
        />
        {isGuardian ? (
          <Button variant="outline" onClick={() => void navigate({ to: "/guardian" })}>
            Open the Family hub
          </Button>
        ) : (
          <GuardianSyncCard sharing={Boolean(form["location_sharing_enabled"])} />
        )}
      </Card>

      <Card className="mt-4 space-y-4">
        <SectionHeader
          icon={KeyRound}
          title="Account & security"
          subtitle="Set or change your password."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password">
            <div className="relative">
              <input
                type={showPw.next ? "text" : "password"}
                autoComplete="new-password"
                className={cn(inputClass, "pr-11")}
                value={passwordForm.next}
                onChange={(e) => setPasswordForm((f) => ({ ...f, next: e.target.value }))}
              />
              <button
                type="button"
                aria-label={showPw.next ? "Hide password" : "Show password"}
                onClick={() => setShowPw((s) => ({ ...s, next: !s.next }))}
                className="tap-target absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPw.next ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            </div>
          </Field>
          <Field label="Confirm password">
            <div className="relative">
              <input
                type={showPw.confirm ? "text" : "password"}
                autoComplete="new-password"
                className={cn(inputClass, "pr-11")}
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))}
              />
              <button
                type="button"
                aria-label={showPw.confirm ? "Hide password" : "Show password"}
                onClick={() => setShowPw((s) => ({ ...s, confirm: !s.confirm }))}
                className="tap-target absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPw.confirm ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            </div>
          </Field>
        </div>
        <Button
          variant="outline"
          loading={changePassword.isPending}
          disabled={!passwordForm.next || !passwordForm.confirm}
          onClick={() => changePassword.mutate()}
        >
          Update password
        </Button>
      </Card>

      <Card className="mt-4 space-y-4">
        <SectionHeader icon={ShieldCheck} title="Privacy & data" />
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            Your questionnaire answers are readable only by you — enforced at the database level.
          </li>
          <li>Groups see compatibility results, never the individual limits behind them.</li>
          <li>Parents see one plan's details, nothing else about you or the group.</li>
          <li>Turning off "Remember my patterns" means nothing is carried between plans.</li>
        </ul>
        <Button
          variant="outline"
          onClick={() => {
            const blob = new Blob([JSON.stringify(me.data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `syncly-data-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download className="size-4" aria-hidden /> Download my data
        </Button>
      </Card>

      {/* Danger zone — pulled well clear of routine settings with its own
          dashed divider, heavier destructive border, and tinted background
          so it never reads as just another card in the list. */}
      <div className="mt-10">
        <div className="mb-4 border-t border-dashed border-destructive/25" aria-hidden />
        <Card className="space-y-3 border-2 border-destructive/40 bg-destructive/[0.04]">
          <SectionHeader icon={AlertTriangle} title="Danger zone" />
          <p className="text-sm text-muted-foreground">
            Permanently deletes your profile, plans, and location history. This can't be undone.
          </p>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" aria-hidden /> Delete my account
          </Button>
        </Card>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteConfirm("");
        }}
        title="Delete your account?"
        description="There's no undo. This permanently removes:"
      >
        <div className="space-y-4">
          <ul className="space-y-1.5 rounded-2xl border border-destructive/30 bg-destructive/[0.04] px-4 py-3 text-sm text-muted-foreground">
            <li>Your profile, photo, and preferences</li>
            <li>Every plan, message, and squad membership</li>
            <li>Your location history and any active sharing</li>
          </ul>
          <Field label='Type "DELETE" to confirm'>
            <input
              className={inputClass}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Button
            variant="danger"
            className="w-full"
            disabled={deleteConfirm !== "DELETE"}
            loading={removeAccount.isPending}
            onClick={() => removeAccount.mutate({})}
          >
            Permanently delete my account
          </Button>
        </div>
      </Modal>
    </PushEnter>
  );
}
