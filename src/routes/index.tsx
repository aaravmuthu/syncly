import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Brain,
  CalendarRange,
  Gauge,
  Layers,
  LineChart,
  Network,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { Logo } from "@/components/studygraph/Logo";
import { Panel } from "@/components/studygraph/ui";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StudyGraph — Adaptive Knowledge Graph Learning" },
      {
        name: "description",
        content:
          "StudyGraph maps what you know, finds the prerequisite gaps behind every struggle, and tells you the single highest-impact thing to learn next.",
      },
      { property: "og:title", content: "StudyGraph — Adaptive Knowledge Graph Learning" },
      {
        property: "og:description",
        content:
          "Map your knowledge, expose prerequisite gaps, and always know the highest-impact thing to study next.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Network,
    title: "Living knowledge graph",
    body: "Every concept is a node, every prerequisite an edge. Mastery colors the map in real time so gaps are impossible to miss.",
  },
  {
    icon: Gauge,
    title: "Mastery, not completion",
    body: "Bayesian mastery estimates blend accuracy, difficulty, response time and decay — no more checkbox learning.",
  },
  {
    icon: Target,
    title: "Highest-impact next step",
    body: "The engine scores every concept by gap size, exam weight and how many downstream topics it unlocks.",
  },
  {
    icon: Brain,
    title: "Root-cause diagnosis",
    body: "Struggling with buffers? StudyGraph traces it back to equilibrium and tells you exactly where the chain broke.",
  },
  {
    icon: CalendarRange,
    title: "Spaced review that respects decay",
    body: "A forgetting model schedules reviews right before retention drops, not on an arbitrary calendar.",
  },
  {
    icon: LineChart,
    title: "Honest analytics",
    body: "Mastery velocity, retention curves, prerequisite bottlenecks and a projection of when you'll hit your target.",
  },
];

function Landing() {
  return (
    <div className="ambient-field min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-border bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <span className="text-[15px] font-semibold tracking-tight">StudyGraph</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <Link to="/subjects" className="transition-colors hover:text-foreground">Subjects</Link>
          </nav>
          <Link
            to="/dashboard"
            className="accent-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Open StudyGraph
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="grid-field pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-20 text-center">
          <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Adaptive prerequisite intelligence
          </span>
          <h1 className="animate-rise mx-auto mt-6 max-w-3xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            Stop studying topics. <span className="text-gradient">Start closing gaps.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
            StudyGraph builds a live map of everything you know, traces every struggle back to
            the prerequisite that caused it, and answers the only question that matters:
            what should I learn next?
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/dashboard"
              className="accent-gradient inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[0_18px_40px_-16px_var(--primary)]"
            >
              Explore the demo graph
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/graph"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <Network className="h-4 w-4" />
              See a knowledge graph
            </Link>
          </div>

          <Panel className="mx-auto mt-14 max-w-4xl overflow-hidden p-1.5">
            <div className="rounded-[22px] bg-background/60 p-6">
              <div className="grid gap-4 text-left sm:grid-cols-3">
                {[
                  { k: "Next best action", v: "Equilibrium & K", d: "Unlocks 5 downstream concepts" },
                  { k: "Root cause found", v: "Rate laws → 47%", d: "Blocking acids, buffers, ΔG links" },
                  { k: "Projected mastery", v: "90% in 6 weeks", d: "At 300 min/week" },
                ].map((card) => (
                  <div key={card.k} className="glass-soft rounded-2xl p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {card.k}
                    </p>
                    <p className="mt-2 text-lg font-semibold tracking-tight">{card.v}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{card.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-center text-3xl font-semibold tracking-tight">
          Three steps, then the graph does the thinking
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              n: "01",
              t: "Map",
              b: "Pick a subject and StudyGraph loads its full prerequisite graph — every concept, every dependency.",
            },
            {
              n: "02",
              t: "Measure",
              b: "Adaptive diagnostics estimate mastery and confidence per node, then keep updating as you practice.",
            },
            {
              n: "03",
              t: "Move",
              b: "The recommendation engine ranks what to study by impact, readiness and how fast retention is decaying.",
            },
          ].map((s) => (
            <Panel key={s.n} className="p-6">
              <span className="text-xs font-semibold tracking-[0.2em] text-primary">{s.n}</span>
              <h3 className="mt-3 text-lg font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.b}</p>
            </Panel>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-5 pb-16">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <Panel key={f.title} className="p-6">
                <div
                  className="grid h-10 w-10 place-items-center rounded-xl"
                  style={{ background: "color-mix(in oklab, var(--primary) 16%, transparent)" }}
                >
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </Panel>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24">
        <Panel className="flex flex-col items-center gap-4 px-8 py-12 text-center">
          <Layers className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-semibold tracking-tight">
            Your knowledge, finally visible
          </h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Load the AP Chemistry demo graph and see the whole system working — mastery, gaps,
            recommendations, spaced review and analytics — in about thirty seconds.
          </p>
          <Link
            to="/dashboard"
            className="accent-gradient mt-2 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Open the dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Progress stays in your browser until you create an account.
          </p>
        </Panel>
      </section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Logo className="h-5 w-5" />
            StudyGraph
          </div>
          <p>Adaptive knowledge-graph learning.</p>
        </div>
      </footer>
    </div>
  );
}
