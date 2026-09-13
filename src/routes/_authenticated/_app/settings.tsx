import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  MapPinned,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserCog,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/quorum/AppShell";
import { pushPermission, requestPush } from "@/lib/quorum/push";
import { Button, Card, Field, Skeleton, inputClass } from "@/components/quorum/ui";
import { Switch } from "@/components/ui/switch";
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

export const Route = createFileRoute("/_authenticated/_app/settings")({
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData({ queryKey: ["me"], queryFn: () => getMe() });
  },
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

/** Icon + title used at the top of every section so the page reads as
 * distinct groups instead of one undifferentiated scroll. */
function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <div>
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
    </div>
  );
}

/** One preference toggle rendered as its own glass card instead of a flat
 * list row, matching the rest of the app's surface styling. The label area
 * and the Switch are independent sibling controls (not nested) so both are
 * clickable without double-firing onToggle. */
function ToggleCard({
  label,
  hint,
  on,
  onToggle,
  action,
}: {
  label: string;
  hint: string;
  on: boolean;
  onToggle?: () => void;
  action?: React.ReactNode;
}) {
  const Wrapper = onToggle ? "button" : "div";
  return (
    <Card as="article" className="flex w-full items-center justify-between gap-4 p-4">
      <Wrapper
        type={onToggle ? "button" : undefined}
        onClick={onToggle}
        className={cn(
          "flex flex-1 items-center gap-4",
          onToggle && "text-left transition active:scale-[0.99]",
        )}
      >
        <span>
          <span className="block text-sm font-medium">{label}</span>
          <span className="block text-xs text-muted-foreground">{hint}</span>
        </span>
      </Wrapper>
      {onToggle ? <Switch checked={on} onCheckedChange={onToggle} aria-label={label} /> : null}
      {action}
    </Card>
  );
}

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
      <>
        <PageHeader title="You" />
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
    { key: "notifications_enabled", label: "Notify me", hint: "When a plan needs my answers or vote" },
  ];

  const isGuardian = (form["account_type"] ?? "teen") === "guardian";

  return (
    <>
      <PageHeader title="You" subtitle="Your defaults travel with you into every questionnaire." />
      {/* Profile */}
      <Card className="space-y-4">
        <SectionHeader icon={UserRound} title="Profile" />
        <div className="flex items-center gap-4">
          <Avatar
            url={form["avatar_url"] as string | null}
            emoji={String(form["avatar_emoji"] ?? "🙂")}
            name={String(form["display_name"] ?? "")}
            size={64}
          />
          <div className="space-y-1">
            <label className="tap-target pressable active:pressable-active inline-flex cursor-pointer items-center rounded-full border border-input px-4 text-sm font-medium transition-colors hover:bg-secondary">
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
                  "tap-target h-11 w-11 rounded-2xl text-lg transition",
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
      </Card>

      {/* I use Syncly as — moved right after Profile: it decides whether
          Family/pairing fields below even apply, so it can't wait until
          mid-page to be answered. */}
      <Card className="mt-4 space-y-4">
        <SectionHeader
          icon={UserCog}
          title="I use Syncly as"
          subtitle="Parents get the Family hub. Teens get the pairing code and safety tools."
        />
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { id: "teen", label: "Teen", icon: "🎒" },
              { id: "guardian", label: "Parent", icon: "🛡️" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                set("account_type", opt.id);
                save.mutate({ data: { account_type: opt.id } });
              }}
              className={cn(
                "tap-target inline-flex items-center justify-center rounded-2xl border px-3 text-sm font-medium transition",
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
      </Card>

      {/* School & location */}
      <Card className="mt-4 space-y-4">
        <SectionHeader icon={MapPinned} title="School & location" />
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

      {/* Family — the account-type-conditional hub/pairing content, plus the
          phone fields that only matter once linked to a parent. */}
      <Card className="mt-4 space-y-4">
        <SectionHeader
          icon={Users}
          title="Family"
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
        <Field label="Phone" hint="Only shared with linked parents if you allow it below.">
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className={inputClass}
            value={String(form["phone"] ?? "")}
            placeholder="(555) 555-5555"
            onChange={(e) => set("phone", e.target.value)}
            onBlur={() => save.mutate({ data: { phone: form["phone"] } })}
          />
        </Field>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3">
          <button
            type="button"
            className="flex-1 text-left"
            onClick={() => {
              const next = !form["share_contact_with_parents"];
              set("share_contact_with_parents", next);
              save.mutate({ data: { share_contact_with_parents: next } });
            }}
          >
            <span className="block text-sm font-medium">Share my number with parents on the plan</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Off by default. Never visible to your squad — only linked parents, only if you turn
              this on.
            </span>
          </button>
          <Switch
            checked={Boolean(form["share_contact_with_parents"])}
            onCheckedChange={(checked) => {
              set("share_contact_with_parents", checked);
              save.mutate({ data: { share_contact_with_parents: checked } });
            }}
            aria-label="Share my number with parents on the plan"
          />
        </div>
      </Card>

      {/* Appearance */}
      <Card className="mt-4 space-y-3">
        <SectionHeader
          icon={Palette}
          title="Appearance"
          subtitle="Follows your device by default. Your choice is saved to this device and your profile."
        />
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: "light", label: "Light", icon: "☀" },
              { id: "dark", label: "Dark", icon: "☾" },
              { id: "system", label: "System", icon: "◐" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => chooseTheme(opt.id)}
              className={cn(
                "tap-target inline-flex items-center justify-center rounded-2xl border px-3 text-sm font-medium transition",
                theme === opt.id ? "border-primary/50 bg-primary/10" : "border-border hover:bg-secondary",
              )}
            >
              <span className="mr-1.5">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Preferences — each toggle is its own glass card (Card/.surface) so
          they read as distinct settings instead of one flat divided list. */}
      <div className="mt-4 space-y-3">
        <SectionHeader icon={SlidersHorizontal} title="Preferences" />
        {toggles.map((t) => {
          const on = Boolean(form[t.key]);
          return <ToggleCard key={t.key} label={t.label} hint={t.hint} on={on} onToggle={() => set(t.key, !on)} />;
        })}
        <ToggleCard
          label="Browser notifications"
          hint={
            pushState === "granted"
              ? "Enabled on this device"
              : pushState === "denied"
                ? "Blocked in your browser settings"
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
      </div>

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

      {/* Account & security */}
      <Card className="mt-8 space-y-4">
        <SectionHeader icon={KeyRound} title="Account & security" subtitle="Set or change your password." />
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
                {showPw.next ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
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

      {/* Privacy & data */}
      <Card className="mt-4 space-y-4">
        <SectionHeader icon={ShieldCheck} title="Privacy & data" />
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>Your questionnaire answers are readable only by you — enforced at the database level.</li>
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

      {/* Danger zone — pulled well clear of routine settings with a divider
          and its own top margin, a heavier destructive border, and a tinted
          background so it never reads as just another card in the list. */}
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
    </>
  );
}
