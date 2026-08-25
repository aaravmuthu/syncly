import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Download, KeyRound, Trash2 } from "lucide-react";
import { AppShell } from "@/components/quorum/AppShell";
import { pushPermission, requestPush } from "@/lib/quorum/push";
import { Button, Card, Field, Skeleton, inputClass } from "@/components/quorum/ui";
import { Modal } from "@/components/quorum/Modal";
import { getMe, saveProfile, uploadAvatar, deleteAccount } from "@/lib/quorum/plan.functions";
import { Avatar } from "@/components/quorum/Avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isValidZip } from "@/lib/quorum/location";
import { useTheme, type ThemeChoice } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { PlaceAutocomplete } from "@/components/quorum/PlaceAutocomplete";
import { TimePicker } from "@/components/quorum/TimePicker";
import { AddressPicker } from "@/components/quorum/AddressPicker";
import { GuardianSyncCard } from "@/components/quorum/guardian/GuardianSyncCard";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Your profile — Syncly" },
      {
        name: "description",
        content: "Control your defaults, which features you see, and what Syncly remembers about you.",
      },
      { property: "og:title", content: "Your profile — Syncly" },
      { property: "og:description", content: "Control your defaults and privacy settings." },
    ],
  }),
  component: SettingsPage,
});

const AVATARS = ["🙂", "😎", "🦊", "🐙", "🌵", "🍄", "⚡", "🌙", "🎧", "🧃"];
const GRAD_YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i - 1);

function SettingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ["me"], queryFn: useServerFn(getMe) });
  const [form, setForm] = useState<Record<string, unknown>>({});
  const { theme, setTheme } = useTheme();
  const [pushState, setPushState] = useState<string>("unsupported");

  useEffect(() => {
    setPushState(pushPermission());
  }, []);

  useEffect(() => {
    if (me.data) setForm(me.data as unknown as Record<string, unknown>);
  }, [me.data]);

  const [uploading, setUploading] = useState(false);
  const doUpload = useServerFn(uploadAvatar);

  const [passwordForm, setPasswordForm] = useState({ next: "", confirm: "" });
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

  async function onPickAvatar(file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5 MB");
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read that file"));
        reader.readAsDataURL(file);
      });
      const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
      const res = await doUpload({ data: { dataUrl, ext } });
      set("avatar_url", res.avatar_url);
      void qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Photo updated");
    } catch (e) {
      toast.error("Couldn't upload that image", {
        description: e instanceof Error ? e.message : "Please try another file.",
      });
    } finally {
      setUploading(false);
    }
  }




  const save = useMutation({
    mutationFn: useServerFn(saveProfile),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Saved");
    },
    onError: (e: unknown) =>
      toast.error("Couldn't save", {
        description: e instanceof Error ? e.message : "Please try again.",
      }),
  });

  // Restore the stored preference once the profile loads.
  useEffect(() => {
    const pref = me.data?.theme_preference as ThemeChoice | undefined;
    if (pref && pref !== theme) setTheme(pref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.data?.theme_preference]);

  const chooseTheme = (t: ThemeChoice) => {
    setTheme(t);
    set("theme_preference", t);
    save.mutate({ data: { theme_preference: t } });
  };

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", search: { next: "/home", mode: "signin" as const }, replace: true });
  }

  if (me.isLoading) {
    return (
      <AppShell title="You">
        <Skeleton className="h-40 rounded-3xl" />
      </AppShell>
    );
  }

  const toggles: { key: string; label: string; hint: string }[] = [
    {
      key: "parent_features_enabled",
      label: "Parent permission features",
      hint: "Show approval links and conditions on plans",
    },
    {
      key: "transport_features_enabled",
      label: "Transportation planning",
      hint: "Ask about rides and build car assignments",
    },
    {
      key: "personalization_enabled",
      label: "Remember my patterns",
      hint: "Use past plans to pre-fill your answers. Off by default keeps nothing.",
    },
    { key: "notifications_enabled", label: "Notify me", hint: "When a plan needs my answers or vote" },
  ];



  return (
    <AppShell title="You" subtitle="Your defaults travel with you into every questionnaire.">
      <Card className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar
            url={form["avatar_url"] as string | null}
            emoji={String(form["avatar_emoji"] ?? "🙂")}
            name={String(form["display_name"] ?? "")}
            size={64}
          />
          <div className="space-y-1">
            <label className="pressable active:pressable-active inline-flex cursor-pointer items-center rounded-full border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary">
              {uploading ? "Uploading…" : "Upload photo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={(e) => void onPickAvatar(e.target.files?.[0])}
              />
            </label>
            <p className="text-xs text-muted-foreground">PNG, JPG, GIF or WebP — animation is kept. Max 5 MB.</p>
            {form["avatar_url"] ? (
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground underline"
                onClick={() => {
                  set("avatar_url", null);
                  save.mutate({ data: { avatar_url: null } });
                }}
              >
                Remove photo
              </button>
            ) : null}
          </div>
        </div>
        <div>
          <span className="text-sm font-medium">Avatar</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => set("avatar_emoji", a)}
                className={cn(
                  "h-10 w-10 rounded-2xl text-lg transition",
                  form["avatar_emoji"] === a ? "bg-primary/15 ring-1 ring-primary/40" : "bg-secondary",
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <Field label="Display name">
          <input
            className={inputClass}
            value={String(form["display_name"] ?? "")}
            onChange={(e) => set("display_name", e.target.value)}
          />
        </Field>
        <Field label="Bio" hint="Optional — up to 160 characters">
          <textarea
            className={cn(inputClass, "min-h-20 resize-y")}
            maxLength={160}
            value={String(form["bio"] ?? "")}
            onChange={(e) => set("bio", e.target.value)}
            placeholder="Two lines about you"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="School" hint="Optional">
            <input
              className={inputClass}
              value={String(form["school"] ?? "")}
              onChange={(e) => set("school", e.target.value)}
              placeholder="Frisco High"
            />
          </Field>
          <Field label="Graduation year" hint="Optional">
            <select
              className={inputClass}
              value={String(form["grad_year"] ?? "")}
              onChange={(e) => set("grad_year", e.target.value === "" ? null : Number(e.target.value))}
            >
              <option value="">Not set</option>
              {GRAD_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label="Home address"
          hint="Required for exact mile distances. Private — never shared with your group."
        >
          <AddressPicker
            value={String(form["home_address"] ?? "")}
            onTextChange={(t) => set("home_address", t)}
            proximity={
              form["home_lat"] != null && form["home_lon"] != null
                ? { lat: Number(form["home_lat"]), lon: Number(form["home_lon"]) }
                : null
            }
            onPick={(p) => {
              set("home_address", p.address);
              set("home_lat", p.lat);
              set("home_lon", p.lon);
              if (p.zip) set("zip_code", p.zip);
            }}
          />

        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ZIP code" hint="Finds real venues nearby — never shared with your group">
            <PlaceAutocomplete
              value={String(form["zip_code"] ?? "")}
              onChange={(zip) => set("zip_code", zip)}
            />
          </Field>
          <Field label="Home area" hint="Used only to estimate travel time">
            <input
              className={inputClass}
              value={String(form["home_area"] ?? "")}
              onChange={(e) => set("home_area", e.target.value)}
            />
          </Field>
          <Field label="Usual curfew" hint="Pre-fills your hard return time">
            <TimePicker
              allowNone
              value={(form["curfew_time"] as string | null) ?? null}
              onChange={(v) => set("curfew_time", v)}
            />
          </Field>
        </div>
      </Card>

      <Card className="mt-4 space-y-4">
        <div>
          <span className="text-sm font-medium">I use Syncly as</span>
          <p className="mt-1 text-xs text-muted-foreground">
            Parents get the Family hub. Teens get the pairing code and safety tools.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {([
            { id: "teen", label: "Teen", icon: "🎒" },
            { id: "guardian", label: "Parent", icon: "🛡️" },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                set("account_type", opt.id);
                save.mutate({ data: { account_type: opt.id } });
              }}
              className={cn(
                "rounded-2xl border px-3 py-2.5 text-sm font-medium transition",
                (form["account_type"] ?? "teen") === opt.id
                  ? "border-primary/50 bg-primary/10"
                  : "border-border hover:bg-secondary",
              )}
            >
              <span className="mr-1.5">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
        <Field label="Phone" hint="Only shared with linked parents if you allow it below.">
          <input
            className={inputClass}
            value={String(form["phone"] ?? "")}
            placeholder="(555) 555-5555"
            onChange={(e) => set("phone", e.target.value)}
            onBlur={() => save.mutate({ data: { phone: form["phone"] } })}
          />
        </Field>
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3">
          <span className="text-sm font-medium">Share my number with parents on the plan</span>
          <input
            type="checkbox"
            className="size-5 accent-emerald-500"
            checked={Boolean(form["share_contact_with_parents"])}
            onChange={(e) => {
              set("share_contact_with_parents", e.target.checked);
              save.mutate({ data: { share_contact_with_parents: e.target.checked } });
            }}
          />
        </label>
      </Card>

      {(form["account_type"] ?? "teen") === "guardian" ? (
        <Card className="mt-4 space-y-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Family hub</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Link your teens with their 6-digit code to see plans, rides and safe arrivals.
            </p>
          </div>
          <Button variant="outline" onClick={() => void navigate({ to: "/guardian" })}>
            Open the Family hub
          </Button>
        </Card>
      ) : (
        <div className="mt-4">
          <GuardianSyncCard sharing={Boolean(form["location_sharing_enabled"])} />
        </div>
      )}



      <Card className="mt-4">
        <span className="text-sm font-medium">Appearance</span>
        <p className="mt-1 text-xs text-muted-foreground">
          Follows your device by default. Your choice is saved to this device and your profile.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {([
            { id: "light", label: "Light", icon: "☀" },
            { id: "dark", label: "Dark", icon: "☾" },
            { id: "system", label: "System", icon: "◐" },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => chooseTheme(opt.id)}
              className={cn(
                "rounded-2xl border px-3 py-2.5 text-sm font-medium transition",
                theme === opt.id ? "border-primary/50 bg-primary/10" : "border-border hover:bg-secondary",
              )}
            >
              <span className="mr-1.5">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="mt-4 divide-y divide-border">
        {toggles.map((t) => {
          const on = Boolean(form[t.key]);
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => set(t.key, !on)}
              className="flex w-full items-center justify-between gap-4 py-3.5 text-left first:pt-0 last:pb-0"
            >
              <span>
                <span className="block text-sm font-medium">{t.label}</span>
                <span className="block text-xs text-muted-foreground">{t.hint}</span>
              </span>
              <span
                className={cn(
                  "h-6 w-10 shrink-0 rounded-full p-0.5 transition",
                  on ? "bg-primary" : "bg-secondary-foreground/20",
                )}
              >
                <span
                  className={cn(
                    "block h-5 w-5 rounded-full bg-background transition",
                    on ? "translate-x-4" : "translate-x-0",
                  )}
                />
              </span>
            </button>
          );
        })}

        <div className="flex items-center justify-between gap-4 py-3.5">
          <span>
            <span className="block text-sm font-medium">Browser notifications</span>
            <span className="block text-xs text-muted-foreground">
              {pushState === "granted"
                ? "Enabled on this device"
                : pushState === "denied"
                  ? "Blocked in your browser settings"
                  : pushState === "unsupported"
                    ? "Not supported on this browser"
                    : "Get pinged when a plan needs you"}
            </span>
          </span>
          {pushState === "default" ? (
            <Button
              variant="outline"
              onClick={async () => {
                setPushState(await requestPush());
              }}
            >
              Enable
            </Button>
          ) : null}
        </div>
      </Card>

      <Card className="mt-4 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium">Password</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password">
            <input
              type="password"
              autoComplete="new-password"
              className={inputClass}
              value={passwordForm.next}
              onChange={(e) => setPasswordForm((f) => ({ ...f, next: e.target.value }))}
            />
          </Field>
          <Field label="Confirm password">
            <input
              type="password"
              autoComplete="new-password"
              className={inputClass}
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))}
            />
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

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          loading={save.isPending}
          onClick={() => {
            const zip = String(form["zip_code"] ?? "").trim();
            if (zip && !isValidZip(zip)) return toast.error("Enter a valid 5-digit ZIP code");
            save.mutate({ data: form });
          }}
        >
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
        <Button variant="outline" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>

      <Card className="mt-8">
        <h2 className="font-display text-base font-semibold">How your data is handled</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>Your questionnaire answers are readable only by you — enforced at the database level.</li>
          <li>Groups see compatibility results, never the individual limits behind them.</li>
          <li>Parents see one plan's details, nothing else about you or the group.</li>
          <li>Turning off "Remember my patterns" means nothing is carried between plans.</li>
        </ul>
        <Button
          variant="outline"
          className="mt-4"
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

      <Card className="mt-4 border-destructive/30">
        <h2 className="font-display text-base font-semibold text-destructive">Danger zone</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Permanently deletes your profile, plans, and location history. This can't be undone.
        </p>
        <Button variant="danger" className="mt-4" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="size-4" aria-hidden /> Delete my account
        </Button>
      </Card>

      <Modal
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteConfirm("");
        }}
        title="Delete your account?"
        description="This permanently removes your profile, plans, messages, and location history. There's no undo."
      >
        <div className="space-y-4">
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
    </AppShell>
  );
}
