import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import {
  ArrowRight,
  CalendarCheck,
  Car,
  Check,
  Lock,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import { Wordmark } from "@/components/quorum/Wordmark";
import { MouseSpotlight } from "@/components/quorum/MouseSpotlight";
import { MagneticButton } from "@/components/quorum/MagneticButton";
import { TrendingPills } from "@/components/quorum/TrendingPills";
import { WorksWithMarquee } from "@/components/quorum/WorksWithMarquee";

const TITLE = "Syncly — Squad Planning & Live Radar";
const DESCRIPTION = "Sync hangouts in seconds with live location radar and smart parent safety.";
const OG_IMAGE = "https://syncly.website/og-preview.png?v=5";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:secure_url", content: OG_IMAGE },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Syncly — private plans, group answers" },
      { property: "og:url", content: "https://syncly.website/" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: "https://syncly.website/" }],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="paper-field relative min-h-dvh">
      <MouseSpotlight />
      <header className="safe-top sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Wordmark />
          <div className="flex items-center gap-2">
            <Link
              to="/demo"
              className="hidden rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              Demo
            </Link>
            <Link
              to="/auth"
              search={{ next: "/home", mode: "signin" }}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Log in
            </Link>

            <Link
              to="/auth"
              search={{ next: "/home", mode: "signup" }}
              className="pressable active:pressable-active rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Start planning
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-5 pt-14 pb-8 sm:pt-24">
          <div className="animate-rise mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <Lock className="size-3.5" /> Private by design
            </span>
            <h1 className="mt-5 text-[2.6rem] leading-[1.03] font-semibold sm:text-6xl">
              Plans that actually work for everyone.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {DESCRIPTION}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <MagneticButton
                to="/auth"
                search={{ next: "/home", mode: "signup" }}
                className="pressable active:pressable-active inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground"
              >
                <span className="inline-flex items-center gap-2">
                  Start planning <ArrowRight className="size-4" />
                </span>
              </MagneticButton>
              <MagneticButton
                to="/demo"
                className="inline-flex items-center gap-2 rounded-full border border-input bg-card px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                Try the demo
              </MagneticButton>
              <a
                href="#how"
                className="inline-flex items-center gap-2 rounded-full border border-input bg-card px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                See how it works
              </a>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <div className="inline-flex items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/5 px-4 py-2.5">
                <Zap className="size-4 text-primary" strokeWidth={1.75} />
                <div className="leading-tight">
                  <p className="font-display text-lg font-semibold">&lt;2min</p>
                  <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                    Setup
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Stop planning around the loudest person.
              </p>
            </div>
          </div>

          <div className="mt-16">
            <AppPreview />
          </div>
        </section>

        <TrendingPills />
        <WorksWithMarquee />

        {/* Problem */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="max-w-2xl text-3xl font-semibold sm:text-4xl">
            Group plans don't fail because nobody cares. They fail because of everything nobody
            wants to say out loud.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                t: "\u201cI can't spend that much.\u201d",
                s: "Budget is the hardest thing to say in a group chat.",
              },
              {
                t: "\u201cI need a ride.\u201d",
                s: "Getting there is half the plan and never gets planned.",
              },
              {
                t: "\u201cI have to be home by 10.\u201d",
                s: "Curfews quietly kill otherwise perfect plans.",
              },
              {
                t: "\u201cI can't eat there.\u201d",
                s: "Dietary needs get remembered at the table, too late.",
              },
            ].map((c) => (
              <div key={c.t} className="card-surface p-5">
                <p className="font-semibold">{c.t}</p>
                <p className="mt-2 text-sm text-muted-foreground">{c.s}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-y border-border bg-surface/60 py-20">
          <div className="mx-auto max-w-6xl px-5">
            <p className="text-sm font-semibold tracking-widest text-primary uppercase">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Four steps. No negotiating.</h2>
            <ol className="mt-10 grid gap-5 md:grid-cols-4">
              {[
                { n: "01", t: "Create a plan", d: "Pick a category, a date window, and a group." },
                {
                  n: "02",
                  t: "Everyone answers privately",
                  d: "Budget, timing, rides, food, rules — seen by nobody else.",
                },
                {
                  n: "03",
                  t: "We compute what's possible",
                  d: "Hard limits filter. Preferences rank. Fairness breaks ties.",
                },
                {
                  n: "04",
                  t: "Vote on real options",
                  d: "Every option on the ballot already works for everyone.",
                },
              ].map((s) => (
                <li key={s.n} className="card-surface p-6">
                  <span className="font-display text-2xl text-primary">{s.n}</span>
                  <h3 className="mt-3 text-lg font-semibold">{s.t}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Feature trio */}
        <section className="mx-auto max-w-6xl space-y-5 px-5 py-20">
          <FeatureRow
            icon={<ShieldCheck className="size-5" />}
            kicker="Privacy"
            title="Your friends don't need to know why you can't."
            body="Constraints stay on your side of the wall. The group only ever sees whether an option works — never who it didn't work for, and never why."
            bullets={[
              "Private answers are readable only by you",
              "Group sees compatibility, never individual limits",
              "Neutral language everywhere: \u201cdoesn't meet every requirement\u201d",
            ]}
          />
          <FeatureRow
            icon={<Sparkles className="size-5" />}
            kicker="Compatibility"
            title="A score you can actually trust."
            body="Hard constraints eliminate. Soft preferences rank. And fairness makes sure the same person isn't quietly sacrificed every single weekend."
            bullets={[
              "Feasibility before popularity",
              "Fairness-aware ranking across plans",
              "Clear, non-identifying explanations",
            ]}
          />
          <FeatureRow
            icon={<CalendarCheck className="size-5" />}
            kicker="Parent approval"
            title="Approval without downloading anything."
            body="Send one link. A parent sees the plan, the people, the cost, the ride, and the return time — then approves, declines, or approves with a condition."
            bullets={[
              "Conditions attach privately to that person",
              "The plan re-checks itself instantly",
              "Alternatives appear if it no longer fits",
            ]}
          />
          <FeatureRow
            icon={<Car className="size-5" />}
            kicker="Transportation"
            title="Rides are part of the plan, not an afterthought."
            body="Seats, drivers, distance limits and return times get solved together, so nobody finds out at 9pm that they have no way home."
            bullets={[
              "Car-by-car assignments",
              "Respects capacity and curfews",
              "Ride needs stay private",
            ]}
          />
        </section>

        {/* Testimonial-ish */}
        <section className="border-y border-border bg-surface/60 py-20">
          <div className="mx-auto grid max-w-6xl gap-5 px-5 md:grid-cols-3">
            {[
              {
                q: "We stopped having the \u201cwhere do you want to go\u201d conversation entirely.",
                a: "Maya, 17",
              },
              { q: "I didn't have to tell six people my budget. It just worked.", a: "Dev, 16" },
              {
                q: "The approval link answered every question I usually have to ask.",
                a: "Parent of a junior",
              },
            ].map((t) => (
              <figure key={t.a} className="card-surface p-6">
                <blockquote className="font-display text-lg leading-snug">{t.q}</blockquote>
                <figcaption className="mt-4 text-sm text-muted-foreground">{t.a}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-3xl px-5 py-24 text-center">
          <h2 className="text-3xl font-semibold sm:text-4xl">Everyone gets a seat at the table.</h2>
          <p className="mt-4 text-muted-foreground">
            Private constraints. Better plans. Free to start with your group.
          </p>
          <Link
            to="/auth"
            search={{ next: "/home", mode: "signup" }}
            className="pressable active:pressable-active mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground"
          >
            Start planning <ArrowRight className="size-4" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <Wordmark size="sm" />
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link to="/privacy" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link to="/terms" className="transition-colors hover:text-foreground">
              Terms
            </Link>
            <p>
              © {new Date().getFullYear()} {BRAND.name}. Private constraints. Better plans.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureRow({
  icon,
  kicker,
  title,
  body,
  bullets,
}: {
  icon: React.ReactNode;
  kicker: string;
  title: string;
  body: string;
  bullets: string[];
}) {
  return (
    <div className="card-surface grid gap-6 p-7 sm:p-9 md:grid-cols-[0.9fr_1.1fr]">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-primary uppercase">
          {icon} {kicker}
        </span>
        <h3 className="mt-4 text-2xl font-semibold">{title}</h3>
      </div>
      <div>
        <p className="text-muted-foreground">{body}</p>
        <ul className="mt-4 space-y-2">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AppPreview() {
  const prefersReducedMotion = useReducedMotion();
  // Tied to raw page scroll distance (not the panel's position relative to
  // the viewport) so it behaves the same on every screen size. The earlier
  // target-relative version only ever animated on narrow/mobile layouts —
  // on a normal desktop width the panel sits high enough beside the hero
  // text that it was already past the "resolved" threshold at scroll
  // position zero, before the page even finished loading, so there was
  // nothing left to animate.
  const { scrollY } = useScroll();
  // Resolve distance: measured how far the panel stays visible before
  // scrolling off the top of the viewport. Now that the panel is much
  // larger and sits in its own full-width row below the headline (not
  // beside it), that window is roughly 0-1100px on desktop, well beyond
  // the previous 580px -- widened to 700px to actually use that room for a
  // slower, more deliberate reveal, while still settling comfortably
  // before the panel scrolls out of view.
  const RESOLVE_DISTANCE = 700;
  // Reduced motion: pin both to a constant 1 so the element is always fully
  // visible at rest, regardless of scroll position — no scale, and nothing
  // scroll-linked. Kept as motion values (rather than swapping the `style`
  // prop to `undefined`) because useReducedMotion() resolves to null/false
  // for the first render, and a motion value written to `style` once
  // persists as a raw inline style even after the prop is later omitted.
  const scale = useTransform(
    scrollY,
    [0, RESOLVE_DISTANCE],
    prefersReducedMotion ? [1, 1] : [0.85, 1],
  );
  const opacity = useTransform(
    scrollY,
    [0, RESOLVE_DISTANCE],
    prefersReducedMotion ? [1, 1] : [0.4, 1],
  );
  // Starts tilted back in 3D (top edge leaning away, like a laptop screen
  // not fully opened) and arches down to flat as it resolves — same scroll
  // range as scale/opacity, so all three settle together. rotateX is a
  // transform property like scale, so this stays within "transform/opacity
  // only" for performance; transformPerspective gives the rotation actual
  // 3D depth instead of just squashing the panel vertically.
  const rotateX = useTransform(
    scrollY,
    [0, RESOLVE_DISTANCE],
    prefersReducedMotion ? [0, 0] : [12, 0],
  );

  return (
    <motion.div
      style={{ scale, opacity, rotateX, transformPerspective: 1200 }}
      className="dark mx-auto w-full max-w-[640px]"
    >
      {/* Device bezel — fixed near-black regardless of site theme, like a
          real phone's casing. Not app UI, so it deliberately sits outside
          the token system (same call as the map's HUD chrome elsewhere). */}
      <div className="rounded-[2.6rem] bg-neutral-950 p-3 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.55)]">
        <div className="rounded-[2rem] border border-white/10 bg-card/90 p-4 backdrop-blur-2xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Saturday Night Out</span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" /> 6
            </span>
          </div>
          <div className="mt-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">TopGolf</p>
              <span className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary">
                91%
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">$24–$32 · 12 min away</p>
            <ul className="mt-3 space-y-1.5 text-xs">
              {["Fits everyone's budget", "Works with every schedule", "Rides cover all seats"].map(
                (r) => (
                  <li key={r} className="flex items-center gap-2 text-muted-foreground">
                    <Check className="size-3.5 text-primary" /> {r}
                  </li>
                ),
              )}
            </ul>
          </div>
          {[
            { t: "Bowling + Diner", s: "89%" },
            { t: "Dinner + Movie", s: "85%" },
          ].map((o) => (
            <div
              key={o.t}
              className="mt-2 flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm"
            >
              <span className="text-foreground">{o.t}</span>
              <span className="text-xs font-semibold text-muted-foreground">{o.s}</span>
            </div>
          ))}
          <div className="mt-3 rounded-2xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
            One option was hidden because it didn't meet every group member's requirements.
          </div>
        </div>
      </div>
    </motion.div>
  );
}
