import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Check, Lock, Shuffle, Users, X } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { Wordmark } from "@/components/quorum/Wordmark";
import { Card, Pill } from "@/components/quorum/ui";
import { OPTION_CATALOG } from "@/lib/quorum/catalog";
import { rankOptions, buildTransportPlan, type MemberInput } from "@/lib/quorum/engine";
import { estimateCost } from "@/lib/quorum/cost";
import { CATEGORIES, type ConstraintPayload, type PlanCategory } from "@/lib/quorum/types";

const TITLE = `Try ${BRAND.name} — interactive demo, no account needed`;
const DESCRIPTION =
  "Play with a sample group: change private budgets, curfews, rides and diets and watch Syncly re-rank plans that work for everyone.";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { property: "og:url", content: "https://syncly.website/demo" },
    ],
    links: [{ rel: "canonical", href: "https://syncly.website/demo" }],
  }),
  component: DemoPage,
});

type DemoMember = {
  id: string;
  name: string;
  emoji: string;
  sacrificeLoad: number;
  constraints: ConstraintPayload;
};

const INITIAL: DemoMember[] = [
  {
    id: "m1",
    name: "Maya",
    emoji: "🌿",
    sacrificeLoad: 0.6,
    constraints: {
      maxSpend: 20,
      dietary: ["vegetarian"],
      likedTags: ["cozy", "indoor"],
      maxTravelMinutes: 20,
      needsRide: true,
      latestEnd: "21:30",
      parentApprovalRequired: true,
    },
  },
  {
    id: "m2",
    name: "Dev",
    emoji: "🎧",
    sacrificeLoad: 0.1,
    constraints: {
      maxSpend: 45,
      likedTags: ["games", "active"],
      maxTravelMinutes: 35,
      canDrive: true,
      seats: 3,
      latestEnd: "23:00",
    },
  },
  {
    id: "m3",
    name: "Sofia",
    emoji: "📚",
    sacrificeLoad: 0.3,
    constraints: {
      maxSpend: 30,
      dietary: ["gluten-free"],
      likedTags: ["group", "indoor"],
      dislikedTags: ["late-night"],
      maxTravelMinutes: 25,
      needsRide: true,
      latestEnd: "22:00",
    },
  },
  {
    id: "m4",
    name: "Theo",
    emoji: "🏀",
    sacrificeLoad: 0.2,
    constraints: {
      maxSpend: 25,
      likedTags: ["active", "outdoor"],
      maxTravelMinutes: 30,
      canDrive: true,
      seats: 4,
      latestEnd: "22:30",
    },
  },
];

const TAG_CHOICES = ["active", "indoor", "outdoor", "games", "cozy", "group", "late-night"];
const DIET_CHOICES = ["vegetarian", "vegan", "gluten-free", "halal", "nut-free"];
const CURFEWS = ["20:30", "21:30", "22:30", "23:30"];

function DemoPage() {
  const [category, setCategory] = useState<PlanCategory>("hangout");
  const [members, setMembers] = useState<DemoMember[]>(INITIAL);
  const [activeId, setActiveId] = useState("m1");

  const active = members.find((m) => m.id === activeId)!;

  const update = (patch: Partial<ConstraintPayload>) =>
    setMembers((prev) =>
      prev.map((m) => (m.id === activeId ? { ...m, constraints: { ...m.constraints, ...patch } } : m)),
    );

  const toggleIn = (key: "likedTags" | "dislikedTags" | "dietary", value: string) => {
    const list = active.constraints[key] ?? [];
    update({ [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] } as never);
  };

  const ranked = useMemo(() => {
    const pool = OPTION_CATALOG.filter((o) => o.category.includes(category));
    const inputs: MemberInput[] = members.map((m) => ({
      profileId: m.id,
      constraints: m.constraints,
      sacrificeLoad: m.sacrificeLoad,
    }));
    return rankOptions(pool.length ? pool : OPTION_CATALOG, inputs).slice(0, 4);
  }, [category, members]);

  const top = ranked[0];

  const cost = top
    ? estimateCost({
        costMin: top.option.costMin,
        costMax: top.option.costMax,
        travelMinutes: top.option.travelMinutes,
        category,
        headcount: members.length,
      })
    : null;

  const transport = top
    ? buildTransportPlan(
        top.option,
        members.map((m) => ({ profileId: m.id, name: m.name, constraints: m.constraints })),
      )
    : null;

  return (
    <div className="paper-field min-h-dvh">
      <header className="safe-top sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3.5">
          <Link to="/">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2">
            <Pill tone="accent">
              <Lock className="size-3" /> Demo — nothing is saved
            </Pill>
            <Link
              to="/auth"
              search={{ next: "/home", mode: "signup" }}
              className="pressable active:pressable-active rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Use for real
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          A sample group, planning in real time
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Each person answers privately. Change anyone's limits below and the ranking updates
          instantly — the group only ever sees the outcome, never who said what.
        </p>

        {/* Category */}
        <div className="mt-6 flex flex-wrap gap-2">
          {CATEGORIES.filter((c) => c.id !== "custom").map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`pressable rounded-full border px-3.5 py-2 text-sm transition-colors ${
                category === c.id
                  ? "border-primary bg-primary/10 font-semibold text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="mr-1">{c.emoji}</span>
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          {/* Private answers */}
          <Card>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4 text-primary" /> Private answers
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveId(m.id)}
                  className={`pressable rounded-2xl border px-3 py-2 text-sm ${
                    m.id === activeId ? "border-primary bg-primary/10 font-semibold" : "border-border"
                  }`}
                >
                  <span className="mr-1">{m.emoji}</span>
                  {m.name}
                </button>
              ))}
            </div>

            <div className="mt-5 space-y-5">
              <Field label={`Max spend — $${active.constraints.maxSpend ?? 0}`}>
                <input
                  type="range"
                  min={5}
                  max={80}
                  step={5}
                  value={active.constraints.maxSpend ?? 20}
                  onChange={(e) => update({ maxSpend: Number(e.target.value) })}
                  className="w-full accent-[hsl(var(--primary))]"
                />
              </Field>

              <Field label={`Max travel — ${active.constraints.maxTravelMinutes ?? 0} min`}>
                <input
                  type="range"
                  min={5}
                  max={60}
                  step={5}
                  value={active.constraints.maxTravelMinutes ?? 20}
                  onChange={(e) => update({ maxTravelMinutes: Number(e.target.value) })}
                  className="w-full accent-[hsl(var(--primary))]"
                />
              </Field>

              <Field label="Home by">
                <div className="flex flex-wrap gap-2">
                  {CURFEWS.map((t) => (
                    <Chip
                      key={t}
                      on={active.constraints.latestEnd === t}
                      onClick={() => update({ latestEnd: t })}
                    >
                      {t}
                    </Chip>
                  ))}
                </div>
              </Field>

              <Field label="Dietary needs">
                <div className="flex flex-wrap gap-2">
                  {DIET_CHOICES.map((d) => (
                    <Chip
                      key={d}
                      on={(active.constraints.dietary ?? []).includes(d)}
                      onClick={() => toggleIn("dietary", d)}
                    >
                      {d}
                    </Chip>
                  ))}
                </div>
              </Field>

              <Field label="Into">
                <div className="flex flex-wrap gap-2">
                  {TAG_CHOICES.map((t) => (
                    <Chip
                      key={t}
                      on={(active.constraints.likedTags ?? []).includes(t)}
                      onClick={() => toggleIn("likedTags", t)}
                    >
                      {t}
                    </Chip>
                  ))}
                </div>
              </Field>

              <Field label="Getting there">
                <div className="flex flex-wrap gap-2">
                  <Chip
                    on={!!active.constraints.canDrive}
                    onClick={() =>
                      update({ canDrive: !active.constraints.canDrive, needsRide: false })
                    }
                  >
                    Can drive ({active.constraints.seats ?? 3} seats)
                  </Chip>
                  <Chip
                    on={!!active.constraints.needsRide}
                    onClick={() =>
                      update({ needsRide: !active.constraints.needsRide, canDrive: false })
                    }
                  >
                    Needs a ride
                  </Chip>
                </div>
              </Field>

              <button
                type="button"
                onClick={() => setMembers(INITIAL)}
                className="pressable inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-sm text-muted-foreground"
              >
                <Shuffle className="size-4" /> Reset the sample group
              </button>
            </div>
          </Card>

          {/* Results */}
          <div className="space-y-4">
            {ranked.map((r, i) => (
              <Card key={r.option.key} className={i === 0 ? "ring-1 ring-primary/40" : ""}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold">{r.option.title}</h2>
                      {i === 0 && <Pill tone="accent">Best for everyone</Pill>}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{r.option.subtitle}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-semibold tabular-nums">{r.score}</div>
                    <div className="text-[11px] text-muted-foreground">compatibility</div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Pill>${r.option.costMin}–${r.option.costMax}</Pill>
                  <Pill>{r.option.travelMinutes} min away</Pill>
                  <Pill>
                    {r.option.start}–{r.option.end}
                  </Pill>
                  {r.feasible ? (
                    <Pill tone="good">
                      <Check className="size-3" /> Works for all {members.length}
                    </Pill>
                  ) : (
                    <Pill tone="bad">
                      <X className="size-3" /> {r.breakdown.hardFailures} blocked
                    </Pill>
                  )}
                </div>

                {i === 0 && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Meter label="Budget fit" value={r.breakdown.budgetFit} />
                    <Meter label="Schedule fit" value={r.breakdown.scheduleFit} />
                    <Meter label="Travel fit" value={r.breakdown.travelFit} />
                    <Meter label="Fairness" value={r.breakdown.fairness} />
                  </div>
                )}

                {i === 0 && (
                  <ul className="mt-4 space-y-1.5 text-sm">
                    {r.breakdown.reasons.slice(0, 4).map((reason) => (
                      <li key={reason} className="flex gap-2 text-muted-foreground">
                        <Check className="mt-0.5 size-4 shrink-0 text-success" />
                        {reason}
                      </li>
                    ))}
                    {r.breakdown.cautions.slice(0, 2).map((c) => (
                      <li key={c} className="flex gap-2 text-muted-foreground">
                        <X className="mt-0.5 size-4 shrink-0 text-warning" />
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}

            {cost && (
              <Card>
                <h3 className="text-sm font-semibold">Cost split for {top!.option.title}</h3>
                <dl className="mt-3 space-y-1.5 text-sm">
                  {cost.lines.map((l) => (
                    <div key={l.label} className="flex justify-between text-muted-foreground">
                      <dt>{l.label}</dt>
                      <dd className="tabular-nums">{l.value}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-border pt-2 font-semibold">
                    <dt>Per person</dt>
                    <dd className="tabular-nums">
                      ${cost.perPersonMin}–${cost.perPersonMax}
                    </dd>
                  </div>
                </dl>
              </Card>
            )}

            {transport && (
              <Card>
                <h3 className="text-sm font-semibold">Rides</h3>
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {transport.cars.map((c) => (
                    <li key={c.label}>
                      <span className="font-medium text-foreground">{c.label}</span> — {c.driver}{" "}
                      driving
                      {c.passengers.length ? ` with ${c.passengers.join(", ")}` : " (no riders yet)"}
                    </li>
                  ))}
                  {transport.unseated.length > 0 && (
                    <li className="text-destructive">
                      Still needs a ride: {transport.unseated.join(", ")}
                    </li>
                  )}
                </ul>
              </Card>
            )}
          </div>
        </div>

        <Card className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Do this with your actual group</h2>
            <p className="text-sm text-muted-foreground">
              Invite links, parent approvals, weather-aware picks and saved plans.
            </p>
          </div>
          <Link
            to="/auth"
            search={{ next: "/home", mode: "signup" }}
            className="pressable active:pressable-active inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Create a group <ArrowRight className="size-4" />
          </Link>
        </Card>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      {children}
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pressable rounded-full border px-3 py-1.5 text-xs transition-colors ${
        on ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{value}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
