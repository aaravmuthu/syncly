import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { Button, Card, Field, inputClass } from "@/components/quorum/ui";
import { Switch } from "@/components/ui/switch";
import { Wordmark } from "@/components/quorum/Wordmark";
import { getMe, saveProfile } from "@/lib/quorum/plan.functions";
import { linkTeen } from "@/lib/quorum/guardian.functions";
import { TOP_LEVEL_CATEGORIES } from "@/lib/quorum/types";
import { categoryIcon } from "@/lib/quorum/icons";
import { toast } from "sonner";
import { isValidZip } from "@/lib/quorum/location";
import { cn } from "@/lib/utils";
import { PlaceAutocomplete } from "@/components/quorum/PlaceAutocomplete";
import { TimePicker } from "@/components/quorum/TimePicker";
import { AddressPicker } from "@/components/quorum/AddressPicker";
import { SyncAvatar, type SyncMood } from "@/components/quorum/auth/SyncAvatar";
import { SyncSay, type SayLine } from "@/components/quorum/auth/SyncSay";
import { useAvatarFollow } from "@/components/quorum/auth/useAvatarFollow";
import { DynamicButton } from "@/components/quorum/DynamicButton";

const GREET_DELAY_MS = 400;
const GREET_MS = 1500;
const SAY_MS = 2800;
const NAME_PAUSE_MS = 1000;
const STEP_CHEER_MS = 900;
const OUTCOME_MS = 1800;
// The avatar's last reaction gets a beat before the app moves on.
const CELEBRATE_BEFORE_NAV_MS = 700;

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Get set up — Syncly" },
      {
        name: "description",
        content: "A few defaults so Syncly can pre-fill your private answers.",
      },
      { property: "og:title", content: "Get set up — Syncly" },
      { property: "og:description", content: "A few defaults so planning takes seconds." },
    ],
  }),
  component: Onboarding,
});

const AVATARS = ["🙂", "😎", "🦊", "🐙", "🌵", "🍄", "⚡", "🌙", "🎧", "🧃"];

function Onboarding() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ["me"], queryFn: useServerFn(getMe), retry: false });
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Record<string, unknown>>({
    avatar_emoji: "🙂",
    account_type: "teen",
    preferred_categories: [] as string[],
    parent_features_enabled: false,
    location_sharing_enabled: false,
    transport_features_enabled: true,
  });

  useEffect(() => {
    if (me.data?.display_name && me.data.display_name !== "New member") {
      setForm((f) => ({ ...f, display_name: me.data.display_name }));
    }
  }, [me.data]);

  // The companion: it follows what you are filling in and reacts to it. All
  // moods are derived from the form and from three short-lived signals below.
  const reduce = useReducedMotion();
  const { bind, follow, pulse, kind, isPrivate } = useAvatarFollow();
  const [flash, setFlash] = useState<SyncMood | null>(null);
  const [line, setLine] = useState<SayLine | null>(null);
  const [outcome, setOutcome] = useState<"success" | "error" | null>(null);
  const cheerTimer = useRef<number>(undefined);
  const sayTimer = useRef<number>(undefined);
  const said = useRef(new Set<string>());
  const navTimer = useRef<number>(undefined);

  /** A passing expression: the avatar shows `mood` for `ms`, then goes back to the form. */
  const react = useCallback((mood: SyncMood, ms: number) => {
    setFlash(mood);
    window.clearTimeout(cheerTimer.current);
    cheerTimer.current = window.setTimeout(() => setFlash(null), ms);
  }, []);
  const say = useCallback((text: string, ms = SAY_MS) => {
    setLine((l) => ({ text, id: (l?.id ?? 0) + 1 }));
    window.clearTimeout(sayTimer.current);
    sayTimer.current = window.setTimeout(() => setLine(null), ms);
  }, []);
  /** Say something once per visit, no matter how many times its trigger fires. */
  const sayOnce = useCallback(
    (key: string, text: string) => {
      if (said.current.has(key)) return;
      said.current.add(key);
      say(text);
    },
    [say],
  );
  const lastStep = useRef(2);
  /** A blocked step: the toast says why, the avatar reacts once. */
  const fail = (title: string, description?: string) => {
    toast.error(title, description ? { description } : undefined);
    setOutcome("error");
    say("Oops. Let's fix that.");
  };

  useEffect(() => {
    const t = window.setTimeout(() => {
      react("happy", GREET_MS);
      say("Hey, I'm Sync. Let's get set up.");
    }, GREET_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [react, say]);
  useEffect(
    () => () => {
      window.clearTimeout(cheerTimer.current);
      window.clearTimeout(sayTimer.current);
      window.clearTimeout(navTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (outcome !== "error") return;
    const t = window.setTimeout(() => setOutcome(null), OUTCOME_MS);
    return () => window.clearTimeout(t);
  }, [outcome]);

  const save = useMutation({
    mutationFn: useServerFn(saveProfile),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("You're all set", {
        description: "Your defaults will pre-fill every questionnaire.",
      });
      setOutcome("success");
      say("You're all set!", 2200);
      // Which shell (teen home vs. Family Hub) this lands on is decided
      // centrally by _authenticated/route.tsx's beforeLoad, not here.
      navTimer.current = window.setTimeout(
        () => void navigate({ to: "/home" }),
        reduce ? 0 : CELEBRATE_BEFORE_NAV_MS,
      );
    },
    onError: (e: unknown) => {
      fail("Couldn't save your setup", e instanceof Error ? e.message : "Please try again.");
    },
  });

  const [linkCode, setLinkCode] = useState("");
  const link = useMutation({
    mutationFn: useServerFn(linkTeen),
    onSuccess: (r: { teenName: string; status: "pending" | "linked" }) => {
      if (r.status === "pending") {
        toast.success(`Request sent to ${r.teenName}`, {
          description: "Once they approve it, they'll show up on your Family Hub.",
        });
      }
      save.mutate({ data: { ...form, onboarded: true } });
    },
    onError: (e: unknown) => {
      fail(
        "Couldn't link that code",
        e instanceof Error ? e.message : "Check the code and try again, or skip for now.",
      );
    },
  });

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  // Each new step gets a small hello; the first one is the greeting above.
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    react("happy", STEP_CHEER_MS);
    if (step === lastStep.current) say("Last step!");
  }, [step, react, say]);
  const cats = (form["preferred_categories"] as string[]) ?? [];
  const isGuardian = form["account_type"] === "guardian";

  const whoStep = {
    title: "Who are you here as?",
    caption: "Just a name and a face for your groups.",
    body: (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { id: "teen", label: "I'm planning with friends", icon: "🎒" },
              { id: "guardian", label: "I'm a parent", icon: "🛡️" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                set("account_type", opt.id);
                say(
                  opt.id === "guardian"
                    ? "Welcome. We'll keep this quick."
                    : "Let's go plan something.",
                );
              }}
              className={cn(
                "rounded-2xl border px-3 py-3 text-left text-sm font-medium transition",
                form["account_type"] === opt.id
                  ? "border-primary/50 bg-primary/10"
                  : "border-border hover:bg-secondary",
              )}
            >
              <span className="mr-1.5">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
        <Field label="Display name">
          <input
            className={inputClass}
            data-avatar="name"
            value={String(form["display_name"] ?? "")}
            onChange={(e) => set("display_name", e.target.value)}
            placeholder="Alex"
          />
        </Field>
        <div>
          <span className="text-sm font-medium">Pick an avatar</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => {
                  set("avatar_emoji", a);
                  react("love", 1000);
                  sayOnce("emoji", "Ooh, nice pick.");
                }}
                className={cn(
                  "h-10 w-10 rounded-2xl text-lg transition",
                  form["avatar_emoji"] === a
                    ? "bg-primary/15 ring-1 ring-primary/40"
                    : "bg-secondary",
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>
    ),
  };

  const categoriesStep = {
    title: "What do you plan most?",
    caption: "This only decides which questionnaires appear first.",
    body: (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TOP_LEVEL_CATEGORIES.filter((c) => c.id !== "custom").map((c) => {
          const on = cats.includes(c.id);
          const Icon = categoryIcon(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                if (!on) sayOnce("category", "Good taste.");
                set("preferred_categories", on ? cats.filter((x) => x !== c.id) : [...cats, c.id]);
              }}
              className={cn(
                "flex items-center rounded-2xl border px-3 py-2.5 text-left text-sm transition",
                on ? "border-primary/50 bg-primary/8" : "border-border hover:bg-secondary",
              )}
            >
              <Icon className="mr-1.5 size-4 shrink-0" aria-hidden />
              <span className="font-medium">{c.label}</span>
            </button>
          );
        })}
      </div>
    ),
  };

  const defaultsStep = {
    title: "A couple of defaults",
    caption: "These pre-fill your private answers. You can change them per plan.",
    body: (
      <div className="space-y-4">
        <Field
          label="Home address"
          hint="Required — used for exact distances. Never shared with your group."
        >
          <div data-avatar="address" data-avatar-private>
            <AddressPicker
              value={String(form["home_address"] ?? "")}
              onTextChange={(t) => set("home_address", t)}
              onPick={(p) => {
                set("home_address", p.address);
                set("home_lat", p.lat);
                set("home_lon", p.lon);
                if (p.zip) set("zip_code", p.zip);
                react("love", STEP_CHEER_MS + 200);
                say("Perfect. That stays private.");
              }}
            />
          </div>
        </Field>
        <Field label="ZIP code" hint="Finds real venues near you — never shared with your group">
          <div data-avatar="zip">
            <PlaceAutocomplete
              value={String(form["zip_code"] ?? "")}
              onChange={(zip) => set("zip_code", zip)}
            />
          </div>
        </Field>
        <Field label="Home area" hint="Only used to estimate travel time">
          <input
            className={inputClass}
            value={String(form["home_area"] ?? "")}
            onChange={(e) => set("home_area", e.target.value)}
            placeholder="North side"
          />
        </Field>
        <Field label="Usual curfew" hint="Optional — treated as a hard limit when set">
          <TimePicker
            allowNone
            value={(form["curfew_time"] as string | null) ?? null}
            onChange={(v) => set("curfew_time", v)}
          />
        </Field>
        {[
          { key: "parent_features_enabled", label: "I need parent approval for plans" },
          { key: "transport_features_enabled", label: "Include me in transportation planning" },
        ].map((t) => {
          const on = Boolean(form[t.key]);
          return (
            <div
              key={t.key}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm transition",
                on ? "border-primary/50 bg-primary/8" : "border-border",
              )}
            >
              <button type="button" className="flex-1 text-left" onClick={() => set(t.key, !on)}>
                {t.label}
              </button>
              <Switch
                checked={on}
                onCheckedChange={(checked) => set(t.key, checked)}
                aria-label={t.label}
              />
            </div>
          );
        })}
      </div>
    ),
  };

  const linkTeenStep = {
    title: "Link your first teen",
    caption:
      "Enter the 6-digit code from your teen's Syncly profile — they'll approve the link on their end. You can always do this later.",
    body: (
      <div className="space-y-4">
        <Field label="Teen's sync code">
          <input
            className={cn(inputClass, "text-center text-lg tracking-[0.3em] tabular-nums")}
            data-avatar="code"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={linkCode}
            onChange={(e) => setLinkCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          Don&apos;t have it yet? Skip this — you can link a teen anytime from Family Hub.
        </p>
      </div>
    ),
  };

  const steps = isGuardian ? [whoStep, linkTeenStep] : [whoStep, categoriesStep, defaultsStep];

  lastStep.current = steps.length - 1;
  const current = steps[step]!;
  const last = step === steps.length - 1;

  // Small remarks as you reach certain fields, each said once per visit.
  const nameText = String(form["display_name"] ?? "").trim();
  useEffect(() => {
    if (kind !== "name" || nameText.length < 2 || said.current.has("name")) return;
    const first = nameText.split(" ")[0]!.slice(0, 18);
    const t = window.setTimeout(
      () => sayOnce("name", `Nice to meet you, ${first}.`),
      NAME_PAUSE_MS,
    );
    return () => window.clearTimeout(t);
  }, [kind, nameText, sayOnce]);
  useEffect(() => {
    if (kind === "address") sayOnce("address", "I'm looking away. This stays private.");
  }, [kind, sayOnce]);
  const zipOk = isValidZip(String(form["zip_code"] ?? "").trim());
  useEffect(() => {
    if (kind === "zip" && zipOk) sayOnce("zip", "Got it.");
  }, [kind, zipOk, sayOnce]);
  useEffect(() => {
    if (kind === "code" && linkCode.length === 6) sayOnce("code", "That's the one.");
  }, [kind, linkCode, sayOnce]);

  // A smile when the field being filled in is done and valid.
  const fieldDone =
    (kind === "name" && String(form["display_name"] ?? "").trim().length >= 2) ||
    (kind === "zip" && isValidZip(String(form["zip_code"] ?? "").trim())) ||
    (kind === "code" && linkCode.length === 6);
  const mood: SyncMood =
    save.isPending || link.isPending
      ? "thinking"
      : outcome === "error"
        ? "oops"
        : outcome === "success"
          ? "celebrate"
          : flash
            ? flash
            : follow && isPrivate
              ? "private"
              : follow
                ? fieldDone
                  ? "happy"
                  : "watching"
                : "idle";

  if (me.isPending) {
    return (
      <div
        role="status"
        className="paper-field grid min-h-dvh place-items-center text-sm text-muted-foreground"
      >
        Loading your profile…
      </div>
    );
  }

  if (me.isError) {
    return (
      <div className="paper-field grid min-h-dvh place-items-center px-5">
        <Card className="w-full max-w-md text-center">
          <h1 className="font-display text-xl font-semibold">Couldn't load your profile</h1>
          <p role="alert" className="mt-2 text-sm text-muted-foreground">
            Try again in a moment. If this keeps happening, contact support.
          </p>
          <Button className="mt-5" loading={me.isFetching} onClick={() => void me.refetch()}>
            Try again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10">
      <Wordmark className="mx-auto mb-5 h-7" />
      <div className="flex justify-center">
        <SyncAvatar mood={mood} follow={follow} pulse={pulse} size={108} />
      </div>
      <SyncSay line={line} />
      <div {...bind} className="mt-3">
        <Card>
          <div className="flex gap-1.5">
            {steps.map((s, i) => (
              <span
                key={s.title}
                className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-secondary")}
              />
            ))}
          </div>
          <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight">
            {current.title}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{current.caption}</p>
          <div className="mt-6">{current.body}</div>
          <div data-avatar-ignore className="mt-8 flex items-center justify-between">
            <DynamicButton
              variant="plain"
              type="button"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => {
                if (step === 0 || (isGuardian && last)) {
                  return save.mutate({ data: { ...form, onboarded: true } });
                }
                setStep(step - 1);
              }}
            >
              {step === 0 ? "Skip setup" : isGuardian && last ? "Skip — link later" : "Back"}
            </DynamicButton>
            <DynamicButton
              loading={save.isPending || link.isPending}
              orb={link.isPending ? "connecting" : undefined}
              onClick={() => {
                if (step === 0 && !String(form["display_name"] ?? "").trim()) {
                  return fail("Add a display name so your group knows who you are");
                }
                if (isGuardian && last) {
                  if (linkCode.length !== 6) {
                    return fail("Enter your teen's 6-digit code, or tap Skip");
                  }
                  return link.mutate({ data: { code: linkCode } });
                }
                const zip = String(form["zip_code"] ?? "").trim();
                if (last && (form["home_lat"] == null || form["home_lon"] == null)) {
                  return fail("Pick your home address so Syncly can measure real distances");
                }
                if (last && zip && !isValidZip(zip)) {
                  return fail("Enter a valid 5-digit ZIP code");
                }
                if (last) save.mutate({ data: { ...form, onboarded: true } });
                else setStep(step + 1);
              }}
            >
              {link.isPending
                ? "Linking…"
                : save.isPending
                  ? "Saving…"
                  : last
                    ? isGuardian
                      ? "Link & finish"
                      : "Start planning"
                    : "Continue"}
            </DynamicButton>
          </div>
        </Card>
      </div>
    </main>
  );
}
