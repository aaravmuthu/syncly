import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
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
import { cn } from "@/lib/utils";
import { LogoMarkDark } from "@/components/quorum/Logo";
import { UnicornScene, type UnicornSceneHandle } from "@/components/quorum/landing/UnicornScene";

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
    links: [
      { rel: "canonical", href: "https://syncly.website/" },
      {
        rel: "preload",
        href: "/fonts/geist/GeistPixel-Square.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        href: "/fonts/geist/Geist-Variable.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      { rel: "preconnect", href: "https://assets.unicorn.studio", crossOrigin: "anonymous" },
    ],
  }),
  component: Landing,
});

// Published from Unicorn Studio ("Orbital Metallic Spheres (Remix)"). Edit the
// scene there and republish; the embed picks it up from the production CDN.
const HERO_SCENE = "V60yaPp4htyj82871SMZ";
const HERO_LABEL =
  "Eight metallic spheres pulled together on an evergreen field, ringed by the words Syncly, plans that work for everyone. Moving the cursor sends ripples through the scene.";

// Layer ids in that scene. The text layer's font size is live in the published
// scene, so phones get it bigger at runtime.
const HERO_TEXT_LAYER = "8c6adbca-f422-4f70-bab7-2a2de3396d84";
const tuneHero = (scene: UnicornSceneHandle, small: boolean) => {
  if (small && window.innerWidth < 768) scene.setProp(HERO_TEXT_LAYER, "fontSize", 0.15);
};

const SIGNUP = { next: "/home", mode: "signup" } as const;

const CATEGORIES = ["Dinner", "Concerts", "Recreation", "Movies", "Road trips", "Game night"];

// Every name here must be a service Syncly actually calls today.
const SERVICES = ["Mapbox", "OpenStreetMap", "Geoapify", "Open-Meteo", "Supabase"];

const UNSAID = [
  { t: "“I can't spend that much.”", s: "Budget is the hardest thing to say in a group chat." },
  { t: "“I need a ride.”", s: "Getting there is half the plan and never gets planned." },
  { t: "“I have to be home by 10.”", s: "Curfews quietly kill otherwise perfect plans." },
  { t: "“I can't eat there.”", s: "Dietary needs get remembered at the table, too late." },
];

const STEPS = [
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
];

const FEATURES: {
  id: string;
  icon: ComponentType<{ className?: string }>;
  name: string;
  title: string;
  body: string;
  bullets: string[];
}[] = [
  {
    id: "privacy",
    icon: ShieldCheck,
    name: "Privacy",
    title: "Your friends don't need to know why you can't.",
    body: "Constraints stay on your side of the wall. The group only ever sees whether an option works — never who it didn't work for, and never why.",
    bullets: [
      "Private answers are readable only by you",
      "Group sees compatibility, never individual limits",
      "Neutral language everywhere: “doesn't meet every requirement”",
    ],
  },
  {
    id: "compatibility",
    icon: Sparkles,
    name: "Compatibility",
    title: "A score you can actually trust.",
    body: "Hard constraints eliminate. Soft preferences rank. And fairness makes sure the same person isn't quietly sacrificed every single weekend.",
    bullets: [
      "Feasibility before popularity",
      "Fairness-aware ranking across plans",
      "Clear, non-identifying explanations",
    ],
  },
  {
    id: "parents",
    icon: CalendarCheck,
    name: "Parent approval",
    title: "Approval without downloading anything.",
    body: "Send one link. A parent sees the plan, the people, the cost, the ride, and the return time — then approves, declines, or approves with a condition.",
    bullets: [
      "Conditions attach privately to that person",
      "The plan re-checks itself instantly",
      "Alternatives appear if it no longer fits",
    ],
  },
  {
    id: "rides",
    icon: Car,
    name: "Transportation",
    title: "Rides are part of the plan, not an afterthought.",
    body: "Seats, drivers, distance limits and return times get solved together, so nobody finds out at 9pm that they have no way home.",
    bullets: ["Car-by-car assignments", "Respects capacity and curfews", "Ride needs stay private"],
  },
  {
    id: "radar",
    icon: MapPin,
    name: "Live radar",
    title: "See who's close, without oversharing.",
    body: "One clear switch in Settings, off by default. Turn it on and the squad sees live pins, ETAs and arrival status — no digging through a group chat to ask “where are you.”",
    bullets: [
      "One toggle controls sharing — no silent background tracking",
      "Battery and ETA at a glance",
      "Check or turn it off from Settings any time",
    ],
  },
];

const VOICES = [
  {
    q: "We stopped having the “where do you want to go” conversation entirely.",
    a: "Example teen",
  },
  { q: "I didn't have to tell six people my budget. It just worked.", a: "Another example teen" },
  {
    q: "The approval link answered every question I usually have to ask.",
    a: "Example guardian",
  },
];

function Landing() {
  const heroRef = useRef<HTMLElement>(null);
  const [pastHero, setPastHero] = useState(false);

  // The nav reads ink-on-teal over the scene and turns solid once the dark
  // sections slide under it.
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const io = new IntersectionObserver(([entry]) => setPastHero(!entry.isIntersecting), {
      rootMargin: "-64px 0px 0px 0px",
    });
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  return (
    <div className="us-landing">
      <a href="#main" className="us-skip">
        Skip to content
      </a>
      <header className="us-nav safe-top" data-solid={pastHero || undefined}>
        <div className="us-wrap flex h-16 items-center justify-between gap-3">
          <Link to="/" className="us-brand" aria-label={`${BRAND.name} home`}>
            <LogoMarkDark size={30} className="drop-shadow-none" />
            <span>{BRAND.name}</span>
          </Link>
          <nav className="flex items-center gap-1.5 sm:gap-2" aria-label="Account">
            <Link to="/auth" search={{ next: "/home", mode: "signin" }} className="us-navlink">
              Log in
            </Link>
            <Link to="/auth" search={SIGNUP} className="us-btn us-btn--nav">
              Start planning
            </Link>
          </nav>
        </div>
      </header>

      <main id="main">
        <section ref={heroRef} className="us-hero" aria-labelledby="hero-title">
          <UnicornScene
            projectId={HERO_SCENE}
            label={HERO_LABEL}
            poster={{ desktop: "/hero/unicorn-desktop.jpg", mobile: "/hero/unicorn-mobile.jpg" }}
            tune={tuneHero}
            className="absolute inset-0"
          />
          <h1 id="hero-title" className="sr-only">
            {BRAND.name} — {BRAND.tagline}
          </h1>
          <div className="us-hero__foot us-wrap">
            <p className="us-hero__pitch">{BRAND.shortPitch}</p>
            <div className="us-hero__actions">
              <Link to="/auth" search={SIGNUP} className="us-btn us-btn--ink">
                Start planning <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link to="/demo" className="us-btn us-btn--line">
                Try the demo
              </Link>
            </div>
          </div>
        </section>

        <section className="us-ticker" aria-label="Plan categories and the services Syncly uses">
          <div className="marquee">
            <div className="marquee-track us-ticker__track">
              {[0, 1].map((copy) => (
                <ul key={copy} className="us-ticker__row" aria-hidden={copy === 1 || undefined}>
                  {CATEGORIES.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
          <p className="us-wrap us-ticker__works">
            Works with the tools &amp; places you already use:{" "}
            {SERVICES.map((s, i) => (
              <span key={s}>
                <span className="text-[var(--us-foam)]">{s}</span>
                {i < SERVICES.length - 1 ? " · " : ""}
              </span>
            ))}
          </p>
        </section>

        <section className="us-section" aria-labelledby="unsaid-title">
          <div className="us-wrap">
            <h2 id="unsaid-title" className="us-display us-display--xl max-w-[18ch]">
              Group plans don't fail because nobody cares. They fail because of everything nobody
              wants to say out loud.
            </h2>
            <ul className="us-unsaid">
              {UNSAID.map((c) => (
                <li key={c.t}>
                  <p className="us-unsaid__quote">{c.t}</p>
                  <p className="us-unsaid__why">{c.s}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how" className="us-band" aria-labelledby="how-title">
          <div className="us-wrap">
            <h2 id="how-title" className="us-display us-display--xl">
              Four steps. No negotiating.
            </h2>
            <ol className="us-steps">
              {STEPS.map((s, i) => (
                <Step key={s.n} index={i} {...s} />
              ))}
            </ol>
          </div>
        </section>

        <Features />

        <section className="us-section us-section--deep" aria-labelledby="sync-title">
          <div className="us-wrap grid items-center gap-14 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <h2 id="sync-title" className="us-display us-display--lg max-w-[16ch]">
                Change it on your phone. It's already there on the web.
              </h2>
              <p className="us-lede mt-6 max-w-[44ch]">
                One plan, kept in sync live across every device your squad opens it on.
              </p>
            </div>
            <SyncPreview />
          </div>
        </section>

        <section className="us-section" aria-labelledby="voices-title">
          <div className="us-wrap">
            <h2 id="voices-title" className="sr-only">
              Example scenarios
            </h2>
            <p className="us-note">
              Illustrative examples of how Syncly can help. These are not customer testimonials.
            </p>
            <div className="us-voices">
              {VOICES.map((v) => (
                <figure key={v.a}>
                  <blockquote>{v.q}</blockquote>
                  <figcaption>{v.a}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section className="us-band us-close" aria-labelledby="close-title">
          <div className="us-wrap flex flex-col items-start gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 id="close-title" className="us-display us-display--xxl max-w-[14ch]">
                Everyone gets a seat at the table.
              </h2>
              <p className="us-lede mt-6">
                Private constraints. Better plans. Free to start with your group.
              </p>
            </div>
            <Link to="/auth" search={SIGNUP} className="us-btn us-btn--ink us-btn--lg shrink-0">
              Start planning <ArrowRight className="size-5" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="us-footer">
        <div className="us-wrap flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="us-brand" aria-label={`${BRAND.name} home`}>
            <LogoMarkDark size={26} className="drop-shadow-none" />
            <span>{BRAND.name}</span>
          </Link>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link to="/privacy" className="us-footlink">
              Privacy
            </Link>
            <Link to="/terms" className="us-footlink">
              Terms
            </Link>
            <Link to="/accessibility" className="us-footlink">
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

/** One step of "how it works"; its rule draws in as the row reaches view. */
function Step({ n, t, d, index }: { n: string; t: string; d: string; index: number }) {
  const reduce = useReducedMotion();
  return (
    <li className="us-step">
      <motion.span
        className="us-step__rule"
        aria-hidden
        initial={reduce ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: "0px 0px -15% 0px" }}
        transition={{ duration: 0.9, delay: index * 0.12, ease: [0.16, 1, 0.3, 1] }}
      />
      <span className="us-step__n">{n}</span>
      <h3 className="us-step__title">{t}</h3>
      <p className="us-step__desc">{d}</p>
    </li>
  );
}

/**
 * The feature list with a sticky index beside it on wide screens: the entry
 * for whichever feature sits in the middle of the viewport lights up.
 */
function Features() {
  const [active, setActive] = useState(FEATURES[0].id);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const f of FEATURES) {
      const el = document.getElementById(f.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  return (
    <section className="us-section" aria-labelledby="features-title">
      <div className="us-wrap grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <h2 id="features-title" className="us-display us-display--lg max-w-[14ch]">
            Everything a group plan quietly depends on.
          </h2>
          <nav aria-label="Features" className="us-index">
            <ul>
              {FEATURES.map(({ id, icon: Icon, name }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    aria-current={active === id ? "true" : undefined}
                    className="us-index__link"
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div>
          {FEATURES.map(({ id, title, body, bullets }) => (
            <article key={id} id={id} className="us-feature" aria-labelledby={`${id}-title`}>
              <h3 id={`${id}-title`} className="us-display us-display--md">
                {title}
              </h3>
              <p className="us-feature__body">{body}</p>
              <ul className="us-feature__bullets">
                {bullets.map((b) => (
                  <li key={b}>
                    <Check className="mt-1 size-4 shrink-0" aria-hidden />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Two mocked-up devices sharing the same plan snippet, with a "Live sync"
 * connector pulsing between them — separately styled but identically valued,
 * so it reads on its own even without the pulse (reduced motion).
 */
function SyncPreview() {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
      <DeviceFrame variant="web">
        <p className="text-sm font-semibold">Saturday Night Out</p>
        <div className="us-device__row mt-3 px-3 py-2 text-sm">
          <span>Your budget</span>
          <span className="font-semibold">$30</span>
        </div>
        <span className="us-device__ok mt-2.5 text-xs">
          <Check className="size-3.5" aria-hidden /> Synced
        </span>
      </DeviceFrame>

      <div className="flex items-center gap-3 sm:flex-col sm:px-1">
        <span className="us-device__wire" aria-hidden />
        <motion.div
          className="us-device__pill"
          animate={reduce ? undefined : { scale: [1, 1.06, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <RefreshCw className="size-3.5" aria-hidden /> Live sync
        </motion.div>
        <span className="us-device__wire" aria-hidden />
      </div>

      <DeviceFrame variant="phone">
        <p className="text-xs font-semibold">Saturday Night Out</p>
        <div className="us-device__row mt-2.5 px-2.5 py-1.5 text-xs">
          <span>Your budget</span>
          <span className="font-semibold">$30</span>
        </div>
        <span className="us-device__ok mt-2 text-xs">
          <span className="size-1.5 rounded-full bg-current" aria-hidden /> Updated just now
        </span>
      </DeviceFrame>
    </div>
  );
}

function DeviceFrame({ variant, children }: { variant: "web" | "phone"; children: ReactNode }) {
  return (
    <div className={cn("us-device", variant === "web" ? "us-device--web" : "us-device--phone")}>
      {variant === "web" && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
        </div>
      )}
      <div className="us-device__screen">{children}</div>
    </div>
  );
}
