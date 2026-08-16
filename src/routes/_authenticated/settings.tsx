import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/quorum/AppShell";
import { pushPermission, requestPush } from "@/lib/quorum/push";
import { Button, Card, Field, Skeleton, inputClass } from "@/components/quorum/ui";
import { getMe, saveProfile } from "@/lib/quorum/plan.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isValidZip } from "@/lib/quorum/location";
import { useTheme, type ThemeChoice } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { PlaceAutocomplete } from "@/components/quorum/PlaceAutocomplete";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Your profile — Quorum" },
      {
        name: "description",
        content: "Control your defaults, which features you see, and what Quorum remembers about you.",
      },
      { property: "og:title", content: "Your profile — Quorum" },
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
            <input
              type="time"
              className={inputClass}
              value={String(form["curfew_time"] ?? "")}
              onChange={(e) => set("curfew_time", e.target.value || null)}
            />
          </Field>
        </div>
      </Card>

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
      </Card>
    </AppShell>
  );
}
