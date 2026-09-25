import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Info,
  MapPinned,
  Moon,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  SunMoon,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/quorum/AppShell";
import { pushPermission, requestPush } from "@/lib/quorum/push";
import { Button, Card, Skeleton } from "@/components/quorum/ui";
import { ToggleCard } from "@/components/quorum/settings/shared";
import { getMe, saveProfile } from "@/lib/quorum/plan.functions";
import { Avatar } from "@/components/quorum/Avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTheme, type ThemeChoice } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_app/settings/")({
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData({ queryKey: ["me"], queryFn: () => getMe() });
  },
  head: () => ({
    meta: [
      { title: "Settings — Syncly" },
      {
        name: "description",
        content:
          "Control your defaults, which features you see, and what Syncly remembers about you.",
      },
      { property: "og:title", content: "Settings — Syncly" },
      { property: "og:description", content: "Control your defaults and privacy settings." },
    ],
  }),
  component: SettingsHub,
});

function NavRow({
  icon: Icon,
  title,
  subtitle,
  to,
  leading,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  to: string;
  leading?: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="tap-target pressable active:pressable-active flex w-full items-center gap-3 px-1 py-2.5 text-left transition-colors hover:bg-secondary"
    >
      {leading ?? (
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-4.5" aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        {subtitle ? (
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

function SettingsHub() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ["me"], queryFn: useServerFn(getMe) });
  const { theme, setTheme } = useTheme();
  const [pushState, setPushState] = useState<string>("unsupported");
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});

  useEffect(() => {
    setPushState(pushPermission());
  }, []);

  useEffect(() => {
    if (me.data) setForm(me.data as unknown as Record<string, unknown>);
  }, [me.data]);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

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

  // Restore stored theme preference once profile loads.
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

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", search: { next: "/home", mode: "signin" }, replace: true });
  }

  if (me.isLoading) {
    return (
      <>
        <PageHeader title="Settings" />
        <Skeleton className="h-40 rounded-3xl" />
      </>
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
    {
      key: "notifications_enabled",
      label: "Notify me",
      hint: "When a plan needs my answers or vote",
    },
  ];

  return (
    <>
      <PageHeader title="Settings" subtitle="Your account, your privacy, your app." />

      <Card className="divide-y divide-border p-2">
        <NavRow
          icon={UserRound}
          title="Profile"
          subtitle={String(form["display_name"] ?? "Photo, name & identity")}
          to="/settings/profile"
          leading={
            <Avatar
              url={(form["avatar_url"] as string | null) ?? null}
              emoji={String(form["avatar_emoji"] ?? "🙂")}
              name={String(form["display_name"] ?? "")}
              size={36}
            />
          }
        />
        <NavRow
          icon={ShieldCheck}
          title="Account & Privacy"
          subtitle="Parent pairing, password, data & danger zone"
          to="/settings/account"
        />
        <NavRow
          icon={MapPinned}
          title="Planning defaults"
          subtitle="School, home address & curfew"
          to="/settings/planning"
        />
        <NavRow
          icon={Info}
          title="Info & About"
          subtitle="Version, legal & how Syncly works"
          to="/settings/info"
        />
      </Card>

      {/* Appearance — kept inline rather than a sub-page: it's a glanceable
          3-way toggle, not worth a full navigation away and back. Collapsed
          by default so it doesn't compete with the nav rows above it. */}
      <Card className="mt-4 space-y-3">
        <button
          type="button"
          onClick={() => setAppearanceOpen((v) => !v)}
          aria-expanded={appearanceOpen}
          aria-controls="settings-appearance-panel"
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Palette className="size-4" aria-hidden />
            </span>
            <span className="font-display text-base font-semibold">Appearance</span>
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              appearanceOpen && "rotate-180",
            )}
            aria-hidden
          />
        </button>
        {appearanceOpen ? (
          <div id="settings-appearance-panel" className="grid grid-cols-3 gap-2">
            {(
              [
                { id: "light", label: "Light", icon: Sun },
                { id: "dark", label: "Dark", icon: Moon },
                { id: "system", label: "System", icon: SunMoon },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => chooseTheme(opt.id)}
                aria-pressed={theme === opt.id}
                className={cn(
                  "tap-target inline-flex items-center justify-center rounded-2xl border px-3 text-sm font-medium transition",
                  theme === opt.id
                    ? "border-primary/50 bg-primary/10"
                    : "border-border hover:bg-secondary",
                )}
              >
                <opt.icon className="mr-1.5 size-4" aria-hidden />
                {opt.label}
              </button>
            ))}
          </div>
        ) : null}
      </Card>

      {/* Preferences — feature toggles, collapsed by default (same
          disclosure pattern as Appearance above). */}
      <Card className="mt-4 space-y-3">
        <button
          type="button"
          onClick={() => setPrefsOpen((v) => !v)}
          aria-expanded={prefsOpen}
          aria-controls="settings-preferences-panel"
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <SlidersHorizontal className="size-4" aria-hidden />
            </span>
            <span className="font-display text-base font-semibold">Preferences</span>
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              prefsOpen && "rotate-180",
            )}
            aria-hidden
          />
        </button>
        {prefsOpen ? (
          <div id="settings-preferences-panel" className="space-y-3">
            {toggles.map((t) => {
              const on = Boolean(form[t.key]);
              return (
                <ToggleCard
                  key={t.key}
                  label={t.label}
                  hint={t.hint}
                  on={on}
                  onToggle={() => set(t.key, !on)}
                />
              );
            })}
            <ToggleCard
              label="Browser notifications"
              hint={
                pushState === "granted"
                  ? "Enabled on this device"
                  : pushState === "denied"
                    ? "Blocked in browser settings"
                    : pushState === "unsupported"
                      ? "Not supported on this browser"
                      : "Get pinged when a plan needs you"
              }
              on={pushState === "granted"}
              action={
                pushState === "default" ? (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      setPushState(await requestPush());
                    }}
                  >
                    Enable
                  </Button>
                ) : null
              }
            />
            <Button loading={save.isPending} onClick={() => save.mutate({ data: form })}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        ) : null}
      </Card>

      <div className="mt-5">
        <Button variant="outline" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </>
  );
}
