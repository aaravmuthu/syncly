import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import {
  ArrowRight,
  CalendarCheck,
  Car,
  Check,
  Lock,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/quorum/Wordmark";
import { MouseSpotlight } from "@/components/quorum/MouseSpotlight";
import { GlowButton } from "@/components/quorum/GlowButton";
import { TrendingPills } from "@/components/quorum/TrendingPills";
import { Reveal, RevealGroup, RevealItem, SpotlightCard } from "@/components/quorum/interactions";
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
          <RevealGroup stagger={0.09} className="mx-auto max-w-3xl text-center">
            <RevealItem lift={false} className="inline-block">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <Lock className="size-3.5" /> Private by design
              </span>
            </RevealItem>
            <RevealItem lift={false}>
              <h1 className="mt-5 text-[2.6rem] leading-[1.03] font-semibold sm:text-6xl">
                Plans that actually work for everyone.
              </h1>
            </RevealItem>
            <RevealItem lift={false}>
              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {DESCRIPTION}
              </p>
            </RevealItem>
            <RevealItem
              lift={false}
              className="mt-8 flex flex-wrap items-center justify-center gap-3"
            >
              <GlowButton
                to="/auth"
                search={{ next: "/home", mode: "signup" }}
                glow="primary"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground"
              >
                <span className="inline-flex items-center gap-2">
                  Start planning <ArrowRight className="size-4" />
                </span>
              </GlowButton>
              <GlowButton
                to="/demo"
                glow="neutral"
                className="inline-flex items-center gap-2 rounded-full border border-input bg-card px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                Try the demo
              </GlowButton>
            </RevealItem>
            <RevealItem lift={false} className="mt-6 flex items-center justify-center">
              <div className="inline-flex items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/5 px-4 py-2.5">
                <Zap className="size-4 text-primary" strokeWidth={1.75} />
                <div className="leading-tight text-left">
                  <p className="font-display text-lg font-semibold">&lt;2min</p>
                  <p className="text-caption tracking-[0.16em] text-muted-foreground uppercase">
                    Setup
                  </p>
                </div>
              </div>
            </RevealItem>
          </RevealGroup>

          <div className="mt-16">
            <AppPreview />
          </div>
        </section>

        <TrendingPills />
        <WorksWithMarquee />

        {/* Web <-> iPhone sync */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <Reveal className="mx-auto max-w-xl text-center">
            <h2 className="text-3xl font-semibold sm:text-4xl">
              Change it on your phone. It's already there on the web.
            </h2>
            <p className="mt-4 text-muted-foreground">
              One plan, kept in sync live across every device your squad opens it on.
            </p>
          </Reveal>
          <Reveal className="mt-12">
            <SyncPreview />
          </Reveal>
        </section>

        {/* Problem */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <Reveal as="h2" className="max-w-2xl text-3xl font-semibold sm:text-4xl">
            Group plans don't fail because nobody cares. They fail because of everything nobody
            wants to say out loud.
          </Reveal>
          <RevealGroup className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              <RevealItem key={c.t}>
                <SpotlightCard tilt className="card-surface h-full p-5">
                  <p className="font-semibold">{c.t}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{c.s}</p>
                </SpotlightCard>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>

        {/* How it works */}
        <section id="how" className="border-y border-border bg-surface/60 py-20">
          <div className="mx-auto max-w-6xl px-5">
            <Reveal>
              <h2 className="text-3xl font-semibold sm:text-4xl">
                Four steps. No negotiating.
              </h2>
            </Reveal>
            <RevealGroup as="ol" stagger={0.1} className="mt-10 grid gap-5 md:grid-cols-4">
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
                <RevealItem as="li" key={s.n}>
                  <SpotlightCard tilt className="card-surface h-full p-6">
                    <span className="font-display text-2xl text-primary">{s.n}</span>
                    <h3 className="mt-3 text-lg font-semibold">{s.t}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
                  </SpotlightCard>
                </RevealItem>
              ))}
            </RevealGroup>
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
          <FeatureRow
            icon={<MapPin className="size-5" />}
            kicker="Live radar"
            title="See who's close, without oversharing."
            body="One clear switch in Settings, off by default. Turn it on and the squad sees live pins, ETAs and arrival status — no digging through a group chat to ask “where are you.”"
            bullets={[
              "One toggle controls sharing — no silent background tracking",
              "Battery and ETA at a glance",
              "Check or turn it off from Settings any time",
            ]}
          />
        </section>

        {/* Testimonial-ish */}
        <section className="border-y border-border bg-surface/60 py-20">
          <RevealGroup className="mx-auto grid max-w-6xl gap-5 px-5 md:grid-cols-3">
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
              <RevealItem as="figure" key={t.a}>
                <SpotlightCard tilt className="card-surface h-full p-6">
                  <blockquote className="font-display text-lg leading-snug">{t.q}</blockquote>
                  <figcaption className="mt-4 text-sm text-muted-foreground">{t.a}</figcaption>
                </SpotlightCard>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>

        {/* CTA */}
        <Reveal as="section" className="mx-auto max-w-3xl px-5 py-24 text-center">
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
        </Reveal>
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
    <Reveal>
      <SpotlightCard className="card-surface grid gap-6 p-7 sm:p-9 md:grid-cols-[0.9fr_1.1fr]">
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
      </SpotlightCard>
    </Reveal>
  );
}

/**
 * Two mocked-up devices sharing the same plan snippet, with a "Live sync"
 * connector pulsing between them — the update on the phone and its mirror
 * on the web render as separately-styled but identically-valued cards
 * rather than one screenshot split in half, so it's legible on its own
 * even without the pulse animation (reduced motion / static export).
 */
function SyncPreview() {
  const prefersReducedMotion = useReducedMotion();
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 sm:flex-row sm:justify-center">
      <DeviceFrame variant="web">
        <p className="text-sm font-semibold text-foreground">Saturday Night Out</p>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Your budget</span>
          <span className="font-semibold text-foreground">$30</span>
        </div>
        <span className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-success">
          <Check className="size-3.5" /> Synced
        </span>
      </DeviceFrame>

      <div className="flex items-center gap-3 sm:flex-col sm:px-2">
        <span className="h-px w-8 bg-border sm:h-8 sm:w-px" aria-hidden />
        <motion.div
          className="glass-pill inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium whitespace-nowrap text-muted-foreground"
          animate={prefersReducedMotion ? undefined : { scale: [1, 1.06, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <RefreshCw className="size-3.5 text-primary" aria-hidden /> Live sync
        </motion.div>
        <span className="h-px w-8 bg-border sm:h-8 sm:w-px" aria-hidden />
      </div>

      <DeviceFrame variant="phone">
        <p className="text-xs font-semibold text-foreground">Saturday Night Out</p>
        <div className="mt-2.5 flex items-center justify-between rounded-lg bg-secondary/60 px-2.5 py-1.5 text-xs">
          <span className="text-muted-foreground">Your budget</span>
          <span className="font-semibold text-foreground">$30</span>
        </div>
        <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-success">
          <span className="size-1.5 rounded-full bg-success" /> Updated just now
        </span>
      </DeviceFrame>
    </div>
  );
}

function DeviceFrame({ variant, children }: { variant: "web" | "phone"; children: ReactNode }) {
  if (variant === "web") {
    return (
      <div className="dark w-full max-w-xs rounded-2xl border border-white/10 bg-neutral-950 p-1.5 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)] sm:max-w-sm">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5">
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
        </div>
        <div className="rounded-xl border border-white/10 bg-card/90 p-4 backdrop-blur-2xl">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="dark w-40 shrink-0 rounded-[1.8rem] bg-neutral-950 p-2 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)]">
      <div className="rounded-[1.3rem] border border-white/10 bg-card/90 p-3.5 backdrop-blur-2xl">
        {children}
      </div>
    </div>
  );
}

const PREVIEW_TABS = [
  { id: "progress", label: "Answering" },
  { id: "results", label: "Results" },
  { id: "radar", label: "Live radar" },
] as const;
type PreviewTab = (typeof PREVIEW_TABS)[number]["id"];

function AppPreview() {
  const prefersReducedMotion = useReducedMotion();
  const [tab, setTab] = useState<PreviewTab>("progress");
  // Ref (not a `tab` dependency) so the interval is created once and always
  // advances from whatever tab the visitor last landed on, whether that was
  // autoplay or a manual click -- restarting the timer on every tab change
  // would make a manual click always buy a full extra 4s before the next
  // auto-advance, which reads as the UI fighting the click instead of
  // just continuing on.
  const tabRef = useRef<PreviewTab>("progress");
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);
  useEffect(() => {
    if (prefersReducedMotion) return;
    const id = window.setInterval(() => {
      const i = PREVIEW_TABS.findIndex((t) => t.id === tabRef.current);
      setTab(PREVIEW_TABS[(i + 1) % PREVIEW_TABS.length]!.id);
    }, 4000);
    return () => window.clearInterval(id);
  }, [prefersReducedMotion]);
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
      className="dark mx-auto w-full max-w-[1040px]"
    >
      {/* Device bezel — fixed near-black regardless of site theme, like a
          real phone's casing. Not app UI, so it deliberately sits outside
          the token system (same call as the map's HUD chrome elsewhere). */}
      <div className="rounded-[2.2rem] bg-neutral-950 p-3 shadow-[0_50px_100px_-40px_rgba(0,0,0,0.6)] sm:p-4">
        <div className="rounded-[1.6rem] border border-white/10 bg-card/90 p-5 backdrop-blur-2xl sm:p-8">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Saturday Night Out</span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" /> 6
            </span>
          </div>

          {/* A real segmented control (same pattern as plans.$planId.tsx's
              match/newest toggle) so the preview is something a visitor can
              actually drive, not just watch — autoplay keeps it alive for
              anyone who doesn't touch it. */}
          <div className="mt-4 inline-flex rounded-full bg-secondary p-0.5 text-xs font-medium">
            {PREVIEW_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 transition-colors",
                  tab === t.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative mt-4 min-h-[280px] sm:min-h-[248px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
              >
                {tab === "progress" ? (
                  // Group progress — the actual first step of planning in the
                  // app: everyone answers privately before any option is
                  // ranked. Mirrors plans.$planId.tsx's real "Group progress"
                  // card (status line + per-member response chips).
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-foreground">Group progress</p>
                      <span className="text-sm text-muted-foreground">
                        Waiting on 1 more person
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        { name: "Maya", responded: true },
                        { name: "Jordan", responded: true },
                        { name: "Sam", responded: true },
                        { name: "Riley", responded: true },
                        { name: "Chris", responded: true },
                        { name: "Alex", responded: false },
                      ].map((m) => (
                        <span
                          key={m.name}
                          className={
                            "rounded-full px-3 py-1.5 text-sm " +
                            (m.responded
                              ? "bg-success/15 text-success"
                              : "bg-secondary text-muted-foreground")
                          }
                        >
                          {m.responded ? "✓ " : ""}
                          {m.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {tab === "results" ? (
                  // Results as a two-column layout (winning match + alternatives
                  // stack) rather than one vertical column, so the wider tablet
                  // frame reads as a genuine dashboard-width screen instead of a
                  // phone layout stretched sideways with empty margins.
                  <div className="grid gap-4 sm:grid-cols-[1.3fr_1fr]">
                    <div className="rounded-2xl border border-border bg-card p-5">
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-semibold text-foreground">TopGolf</p>
                        <span className="rounded-full bg-primary/12 px-3 py-1 text-sm font-semibold text-primary">
                          91%
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">$24–$32 · 12 min away</p>
                      <ul className="mt-4 space-y-2 text-sm">
                        {[
                          "Fits everyone's budget",
                          "Works with every schedule",
                          "Rides cover all seats",
                        ].map((r) => (
                          <li key={r} className="flex items-center gap-2 text-muted-foreground">
                            <Check className="size-4 text-primary" /> {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {[
                        { t: "Bowling + Diner", s: "89%" },
                        { t: "Dinner + Movie", s: "85%" },
                      ].map((o) => (
                        <div
                          key={o.t}
                          className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 text-sm"
                        >
                          <span className="text-foreground">{o.t}</span>
                          <span className="text-sm font-semibold text-muted-foreground">{o.s}</span>
                        </div>
                      ))}
                      <div className="flex-1 rounded-2xl border border-dashed border-border px-4 py-3.5 text-sm text-muted-foreground">
                        One option was hidden because it didn't meet every group member's
                        requirements.
                      </div>
                    </div>
                  </div>
                ) : null}

                {tab === "radar" ? (
                  // Live radar — a stand-in for the map (real Mapbox tiles
                  // don't belong on a marketing page), but reuses the exact
                  // pulse language the actual pin does (q-map-pin-pulse /
                  // q-radar-pulse in styles.css) so it reads as the same
                  // feature, not a lookalike.
                  <div className="space-y-4">
                    <div className="relative h-44 overflow-hidden rounded-2xl border border-border bg-secondary/50 sm:h-48">
                      {[
                        { name: "Maya", left: "28%", top: "32%", eta: "6 min" },
                        { name: "Sam", left: "62%", top: "58%", eta: "2 min" },
                        { name: "You", left: "46%", top: "78%", eta: null },
                      ].map((pin) => (
                        <div
                          key={pin.name}
                          className="absolute -translate-x-1/2 -translate-y-1/2"
                          style={{ left: pin.left, top: pin.top }}
                        >
                          <div className="relative grid place-items-center">
                            {pin.eta ? <span className="q-map-pin-pulse" aria-hidden /> : null}
                            <span
                              className={cn(
                                "relative grid size-8 place-items-center rounded-full text-xs font-semibold ring-2 ring-card",
                                pin.eta
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-foreground text-background",
                              )}
                            >
                              {pin.name[0]}
                            </span>
                            {pin.eta ? (
                              <span className="absolute top-9 whitespace-nowrap rounded-full bg-neutral-950/80 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                                {pin.eta}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 text-sm">
                      <span className="text-foreground">Maya is 6 min away</span>
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="size-4" /> Sharing on
                      </span>
                    </div>
                  </div>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
