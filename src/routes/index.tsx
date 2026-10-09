import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  CalendarCheck,
  Car,
  Check,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import { Wordmark } from "@/components/quorum/Wordmark";
import { MouseSpotlight } from "@/components/quorum/MouseSpotlight";
import { GlowButton } from "@/components/quorum/GlowButton";
import { TrendingPills } from "@/components/quorum/TrendingPills";
import { Reveal, RevealGroup, RevealItem, SpotlightCard } from "@/components/quorum/interactions";
import { WorksWithMarquee } from "@/components/quorum/WorksWithMarquee";
import { SyncOrbit, type OrbitControl } from "@/components/quorum/landing/SyncOrbit";
import { warpTo } from "@/components/quorum/landing/warp";

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
  // Without WebGL the scene can't draw the wrapped tagline, so the h1 shows.
  const [flat, setFlat] = useState(false);
  const router = useRouter();
  const orbit = useRef<OrbitControl | null>(null);
  const warping = useRef(false);

  // "Try the demo" flies you there: the spheres collapse into one, it grows
  // to fill the screen, and the demo opens up from inside it.
  const toDemo = (ev: MouseEvent<HTMLAnchorElement>) => {
    if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    ev.preventDefault();
    if (warping.current) return;
    warping.current = true;
    const button = ev.currentTarget.getBoundingClientRect();
    const fromCluster = orbit.current?.implode();
    const origin = fromCluster ?? {
      x: button.left + button.width / 2,
      y: button.top + button.height / 2,
      r: button.height / 2,
    };
    void warpTo({
      origin,
      delay: fromCluster ? 320 : 0,
      ready: router.preloadRoute({ to: "/demo" }),
      go: () => router.navigate({ to: "/demo" }),
    }).finally(() => {
      warping.current = false;
    });
  };
  return (
    <div className="paper-field relative min-h-dvh">
      <MouseSpotlight />
      <header className="safe-top sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-2.5">
          <Wordmark />
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              search={{ next: "/home", mode: "signin" }}
              className="tap-target inline-flex items-center rounded-full px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Log in
            </Link>

            <Link
              to="/auth"
              search={{ next: "/home", mode: "signup" }}
              className="pressable active:pressable-active tap-target inline-flex items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Start planning
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero: the squad as eight spheres pulled into one plan, with the
            tagline turning around them (components/quorum/landing/SyncOrbit.tsx) */}
        <section className="orbit-hero" aria-labelledby="hero-title">
          <SyncOrbit
            lines={["Plans that actually", "work for everyone."]}
            className="absolute inset-0 size-full"
            onFallback={() => setFlat(true)}
            controlRef={orbit}
          />
          <h1
            id="hero-title"
            className={
              flat
                ? "relative mx-auto max-w-[980px] px-5 pt-[18svh] text-center text-[clamp(40px,6.4vw,80px)] leading-[1.05] font-semibold tracking-[-0.02em] text-balance"
                : "sr-only"
            }
          >
            {BRAND.tagline}
          </h1>
          <div className="orbit-hero__foot">
            <p className="max-w-[34ch] text-[clamp(17px,1.5vw,20px)] leading-[1.4] text-pretty text-muted-foreground">
              {DESCRIPTION}
            </p>
            <div className="flex flex-wrap gap-3">
              <GlowButton
                to="/auth"
                search={{ next: "/home", mode: "signup" }}
                glow="primary"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-[22px] py-[11px] text-lg leading-6 text-primary-foreground"
              >
                <span className="inline-flex items-center gap-2">
                  Start planning <ArrowRight className="size-4" />
                </span>
              </GlowButton>
              <GlowButton
                to="/demo"
                glow="neutral"
                onClick={toDemo}
                className="glass-pill inline-flex min-h-11 items-center rounded-full border border-primary px-[22px] py-[11px] text-lg leading-6 text-primary transition-colors hover:bg-primary/[0.06]"
              >
                Try the demo
              </GlowButton>
            </div>
          </div>
        </section>

        <Reveal>
          <TrendingPills />
        </Reveal>
        <Reveal>
          <WorksWithMarquee />
        </Reveal>

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
              <h2 className="text-3xl font-semibold sm:text-4xl">Four steps. No negotiating.</h2>
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

        {/* Illustrative scenarios, not customer evidence */}
        <section className="border-y border-border bg-surface/60 py-20">
          <p className="mx-auto mb-6 max-w-6xl px-5 text-sm text-muted-foreground">
            Illustrative examples of how Syncly can help. These are not customer testimonials.
          </p>
          <RevealGroup className="mx-auto grid max-w-6xl gap-5 px-5 md:grid-cols-3">
            {[
              {
                q: "We stopped having the \u201cwhere do you want to go\u201d conversation entirely.",
                a: "Example teen",
              },
              {
                q: "I didn't have to tell six people my budget. It just worked.",
                a: "Another example teen",
              },
              {
                q: "The approval link answered every question I usually have to ask.",
                a: "Example guardian",
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
            <Link
              to="/privacy"
              className="tap-target inline-flex items-center transition-colors hover:text-foreground"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="tap-target inline-flex items-center transition-colors hover:text-foreground"
            >
              Terms
            </Link>
            <Link
              to="/accessibility"
              className="tap-target inline-flex items-center transition-colors hover:text-foreground"
            >
              Accessibility
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
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-success">
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
    <div className="dark w-48 shrink-0 rounded-[1.8rem] bg-neutral-950 p-2 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)]">
      <div className="rounded-[1.3rem] border border-white/10 bg-card/90 p-3.5 backdrop-blur-2xl">
        {children}
      </div>
    </div>
  );
}
