import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useRef, type MouseEvent } from "react";
import { ArrowRight } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { Wordmark } from "@/components/quorum/Wordmark";
import { MouseSpotlight } from "@/components/quorum/MouseSpotlight";
import { GlowButton } from "@/components/quorum/GlowButton";
import { ScrollJourney } from "@/components/quorum/landing/ScrollJourney";
import { WorksWithMarquee } from "@/components/quorum/WorksWithMarquee";
import { SyncOrbit, type OrbitControl } from "@/components/quorum/landing/SyncOrbit";
import { warpTo } from "@/components/quorum/landing/warp";

const TITLE = "Syncly | Squad Planning & Live Radar";
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
      { property: "og:image:alt", content: "Syncly: private plans, group answers" },
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

// The things friends don't say out loud, drifting behind the tagline. Each
// row is one line of the wrapped band: the first two sit above it, the last
// two below.
const HERO_WHISPERS = [
  ["Friday after 6?", "Somewhere close", "Nothing too loud", "Can we split it?"],
  ["I can't spend that much.", "I need a ride.", "Home by 10.", "I can't eat there."],
  ["I'm vegetarian.", "Not too late?", "Who's driving?", "Under $20?"],
  ["My parents need to know.", "Somewhere indoors", "Gluten-free, please.", "I'm in!"],
];

function Landing() {
  const router = useRouter();
  const orbit = useRef<OrbitControl | null>(null);
  const hero = useRef<HTMLElement>(null);
  const heroFoot = useRef<HTMLDivElement>(null);
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
    <div className="paper-field relative min-h-dvh overflow-x-clip">
      <MouseSpotlight />
      <header className="liquid-bar liquid-bar-docked safe-top sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-2.5">
          <Wordmark />
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              search={{ next: "/home", mode: "signin" }}
              className="tap-target inline-flex items-center rounded-full px-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground min-[380px]:px-3.5"
            >
              Log in
            </Link>

            <Link
              to="/auth"
              search={{ next: "/home", mode: "signup" }}
              className="pressable active:pressable-active tap-target inline-flex items-center rounded-full bg-primary px-3.5 text-sm font-semibold whitespace-nowrap text-primary-foreground min-[380px]:px-4"
            >
              Start planning
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero: the squad as eight spheres pulled into one plan, with the
            tagline turning around them (components/quorum/landing/SyncOrbit.tsx) */}
        <section ref={hero} className="orbit-hero" aria-labelledby="hero-title">
          <SyncOrbit
            lines={["Plans that actually", "work for everyone."]}
            whispers={HERO_WHISPERS}
            className="peer absolute inset-0 size-full"
            controlRef={orbit}
            footRef={heroFoot}
          />
          <h1
            id="hero-title"
            className="relative mx-auto max-w-[980px] px-5 pt-[18svh] text-center text-[clamp(40px,6.4vw,80px)] font-semibold leading-[1.05] tracking-[-0.02em] text-balance peer-data-[live=true]:sr-only"
          >
            {BRAND.tagline}
          </h1>
          <div ref={heroFoot} className="orbit-hero__foot">
            <p className="max-w-[34ch] text-lg leading-[1.45] text-pretty text-muted-foreground sm:text-[clamp(17px,1.5vw,20px)] sm:leading-[1.4]">
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

        <ScrollJourney heroRef={hero} orbitRef={orbit} />
        <WorksWithMarquee />
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
              to="/subprocessors"
              className="tap-target inline-flex items-center hover:text-foreground"
            >
              Service providers
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
