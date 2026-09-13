import { Link, useRouterState } from "@tanstack/react-router";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, House, MessageCircle, Radar, Settings, Users, Zap, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { haptic } from "@/lib/quorum/haptics";
import { Wordmark } from "./Wordmark";
import { ContextSwitcher } from "./ContextSwitcher";

import { Avatar } from "./Avatar";
import { InstallPrompt } from "./InstallPrompt";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/lib/theme";
import { useNotifications } from "@/lib/quorum/useNotifications";
import { getMe } from "@/lib/quorum/plan.functions";
import { FriendProvider } from "@/lib/quorum/nicknames";
import { FriendProfileSheet } from "./friend/FriendProfileSheet";
import { PageTransition } from "./interactions/PageTransition";
import { AskSynclySheet } from "./ai/AskSynclySheet";

// Settings/profile lives at the header gear + avatar tap, and Activity lives
// at the header bell (below) — keeping the tab bar at 5 items per Apple's HIG
// guidance instead of the previous 7.
const BASE_NAV = [
  { to: "/home", label: "Home", icon: House },
  { to: "/groups", label: "Groups", icon: Users },
  { to: "/radar", label: "Radar", icon: Radar },
  { to: "/plans", label: "Plans", icon: Zap },
  { to: "/messages", label: "Chats", icon: MessageCircle },
] as const;

type NavItem = { to: string; label: string; icon: LucideIcon };

type TabPath = (typeof BASE_NAV)[number]["to"];

const HomeTab = lazy(() => import("@/routes/_authenticated/_app/home").then((m) => ({ default: m.HomePage })));
const GroupsTab = lazy(() =>
  import("@/routes/_authenticated/_app/groups.index").then((m) => ({ default: m.GroupsPage })),
);
const RadarTab = lazy(() => import("@/routes/_authenticated/_app/radar").then((m) => ({ default: m.RadarPage })));
const PlansTab = lazy(() =>
  import("@/routes/_authenticated/_app/plans.index").then((m) => ({ default: m.PlansPage })),
);
const MessagesTab = lazy(() =>
  import("@/routes/_authenticated/_app/messages").then((m) => ({ default: m.MessagesPage })),
);

const TAB_COMPONENTS: Record<TabPath, React.LazyExoticComponent<() => ReactNode>> = {
  "/home": HomeTab,
  "/groups": GroupsTab,
  "/radar": RadarTab,
  "/plans": PlansTab,
  "/messages": MessagesTab,
};

function exactTab(pathname: string): TabPath | null {
  return BASE_NAV.find((item) => item.to === pathname)?.to ?? null;
}

function navTab(pathname: string): TabPath | null {
  return BASE_NAV.find((item) => pathname.startsWith(item.to))?.to ?? null;
}

/**
 * Animated title block a page renders at the top of its own content. Split
 * out of AppShell so the header/nav chrome below can live in a persistent
 * layout route instead of remounting on every navigation.
 */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  if (!title) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="mb-6 flex items-start justify-between gap-4"
    >
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </motion.div>
  );
}

/**
 * Header, bottom nav and their supporting providers — mounted once by the
 * `_app` pathless layout route so they persist across page navigation
 * instead of tearing down (and re-subscribing realtime notifications) on
 * every tab switch.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const routedTab = navTab(pathname);
  const [optimisticTab, setOptimisticTab] = useState<TabPath | null>(null);
  const selectedTab = optimisticTab ?? routedTab;
  const visibleTab = optimisticTab ?? exactTab(pathname);
  const navigationLock = useRef({ to: "" as TabPath | "", until: 0 });
  const blockNextClick = useRef(false);
  const { unread } = useNotifications();
  const me = useQuery({ queryKey: ["me"], queryFn: useServerFn(getMe), retry: false });
  // AppShell is the "My Squad" experience for everyone -- Family Hub now has
  // its own shell (GuardianShell) and is reached via the ContextSwitcher, not
  // a swapped nav tab here.
  const NAV: NavItem[] = [...BASE_NAV];

  useEffect(() => {
    if (optimisticTab && routedTab === optimisticTab) setOptimisticTab(null);
  }, [optimisticTab, routedTab]);

  useEffect(() => {
    if (!optimisticTab) return;
    const timeout = window.setTimeout(() => setOptimisticTab(null), 900);
    return () => window.clearTimeout(timeout);
  }, [optimisticTab]);

  const primeTab = useCallback((event: ReactPointerEvent, to: TabPath) => {
    const now = performance.now();
    if (now < navigationLock.current.until) {
      blockNextClick.current = true;
      event.preventDefault();
      return;
    }

    blockNextClick.current = false;
    navigationLock.current = { to, until: now + 180 };
    setOptimisticTab(to);
    if (window.matchMedia("(pointer: coarse)").matches) haptic("select");
  }, []);

  const commitTab = useCallback((event: React.MouseEvent, to: TabPath) => {
    if (blockNextClick.current) {
      blockNextClick.current = false;
      event.preventDefault();
      return;
    }

    if (event.detail === 0) {
      const now = performance.now();
      if (now < navigationLock.current.until) {
        event.preventDefault();
        return;
      }
      navigationLock.current = { to, until: now + 180 };
      setOptimisticTab(to);
    }
  }, []);

  // Radar's map pulls in mapbox-gl -- ~500KB gzipped on its own, by far the
  // single heaviest thing this app ships -- which otherwise only starts
  // downloading the moment someone taps the Radar tab. Radar is one of five
  // fixed bottom-nav destinations, so warm that chunk in the background
  // during idle time as soon as the shell mounts, instead of making it part
  // of the critical path the first time someone actually navigates there.
  useEffect(() => {
    const prefetch = () => void import("./map/SquadMapInner");
    if (typeof window === "undefined") return;
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(prefetch, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(prefetch, 2000);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <FriendProvider>
      <div
        data-vaul-drawer-wrapper
        className="mx-auto min-h-dvh w-full bg-background md:max-w-3xl md:shadow-2xl"
      >
        {/* No backdrop-blur here: this header sits on screen through every
            page transition, and blurring the animating content behind it
            forces the browser to recomposite on every frame -- a real,
            network-independent cost. A near-opaque background reads almost
            identically without it. */}
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 pt-[env(safe-area-inset-top)]">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link to="/home" className="flex items-center gap-2">
              <Wordmark className="h-6" />
            </Link>
            <div className="flex items-center gap-2">
              <DesktopTabs
                nav={NAV}
                selectedTab={selectedTab}
                onPointerDown={primeTab}
                onClick={commitTab}
              />
              <ContextSwitcher />
              <ThemeToggle />
              <AskSynclySheet />
              <Link
                to="/activity"
                aria-label={unread > 0 ? `Activity, ${unread} unread` : "Activity"}
                className="tap-target pressable active:pressable-active relative inline-flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Bell className="size-5" aria-hidden />
                {unread > 0 ? (
                  <span className="absolute right-1 top-1 inline-grid min-w-4 place-items-center rounded-full bg-primary px-1 text-caption font-semibold leading-4 text-primary-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </Link>
              <Link
                to="/settings"
                aria-label="Settings"
                className="tap-target pressable active:pressable-active inline-flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Settings className="size-5" aria-hidden />
              </Link>
              <Link
                to="/settings"
                aria-label="Your profile"
                className="tap-target pressable active:pressable-active inline-flex items-center justify-center"
              >
                <Avatar
                  url={me.data?.avatar_url}
                  emoji={me.data?.avatar_emoji}
                  name={me.data?.display_name}
                  size={32}
                  className="ring-1 ring-border"
                />
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6">
          <InstallPrompt />
          <PersistentTabHost activeTab={visibleTab} />
          {exactTab(pathname) ? null : <PageTransition>{children}</PageTransition>}
        </main>

        {/* Same reasoning as the header above: no backdrop-blur on an
            element that's on screen for every page transition. */}
        <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] md:hidden">
          <div className="relative mx-auto flex max-w-md items-stretch justify-between px-2 py-1.5">
            <div className="pointer-events-none absolute inset-x-2 top-1.5 h-0.5" aria-hidden>
              <span
                className={cn(
                  "flex h-full w-1/5 justify-center opacity-0 transition-[transform,opacity] duration-150 ease-out motion-reduce:transition-none",
                  selectedTab && "opacity-100",
                )}
                style={{
                  transform: `translate3d(${Math.max(0, BASE_NAV.findIndex((item) => item.to === selectedTab)) * 100}%, 0, 0)`,
                }}
              >
                <span className="h-0.5 w-8 rounded-full bg-primary" />
              </span>
            </div>
            {NAV.map((n) => {
              const active = selectedTab === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  preload="intent"
                  onPointerDown={(event) => primeTab(event, n.to as TabPath)}
                  onClick={(event) => commitTab(event, n.to as TabPath)}
                  className="flex flex-1"
                >
                  <span
                    className={cn(
                      "tap-target relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-2 text-caption font-medium transition-[transform,opacity] duration-150 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 motion-reduce:transition-none",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <span className="relative leading-none">
                      <n.icon
                        className={cn(
                          "h-5 w-5 transition-transform duration-150 ease-out motion-reduce:transition-none",
                          active && "scale-110",
                        )}
                        aria-hidden
                      />
                    </span>
                    {n.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        <FriendProfileSheet />
      </div>
    </FriendProvider>
  );
}

function DesktopTabs({
  nav,
  selectedTab,
  onPointerDown,
  onClick,
}: {
  nav: NavItem[];
  selectedTab: TabPath | null;
  onPointerDown: (event: ReactPointerEvent, to: TabPath) => void;
  onClick: (event: React.MouseEvent, to: TabPath) => void;
}) {
  const root = useRef<HTMLElement>(null);
  const items = useRef(new Map<TabPath, HTMLAnchorElement>());
  const [indicatorX, setIndicatorX] = useState<number | null>(null);

  useLayoutEffect(() => {
    const update = () => {
      const navElement = root.current;
      const item = selectedTab ? items.current.get(selectedTab) : null;
      if (!navElement || !item) return setIndicatorX(null);
      const navRect = navElement.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      setIndicatorX(itemRect.left - navRect.left + itemRect.width / 2 - 12);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [selectedTab]);

  return (
    <nav ref={root} className="relative hidden items-center gap-1 md:flex">
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-0 left-0 h-0.5 w-6 rounded-full bg-primary opacity-0 transition-[transform,opacity] duration-150 ease-out motion-reduce:transition-none",
          indicatorX != null && "opacity-100",
        )}
        style={{ transform: `translate3d(${indicatorX ?? 0}px, 0, 0)` }}
      />
      {nav.map((item) => {
        const active = selectedTab === item.to;
        return (
          <Link
            key={item.to}
            ref={(node) => {
              if (node) items.current.set(item.to as TabPath, node);
              else items.current.delete(item.to as TabPath);
            }}
            to={item.to}
            preload="intent"
            onPointerDown={(event) => onPointerDown(event, item.to as TabPath)}
            onClick={(event) => onClick(event, item.to as TabPath)}
            className={cn(
              "tap-target inline-flex items-center justify-center rounded-xl px-3 text-sm font-medium transition-[transform,opacity] duration-150 ease-out hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 motion-reduce:transition-none",
              active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function PersistentTabHost({ activeTab }: { activeTab: TabPath | null }) {
  const [visited, setVisited] = useState<Set<TabPath>>(() => new Set(activeTab ? [activeTab] : []));
  const previousTab = useRef<TabPath | null>(activeTab);
  const scrollPositions = useRef(new Map<TabPath, number>());

  useEffect(() => {
    if (!activeTab) return;
    setVisited((current) => {
      if (current.has(activeTab)) return current;
      const next = new Set(current);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  useLayoutEffect(() => {
    const previous = previousTab.current;
    if (previous && previous !== activeTab) scrollPositions.current.set(previous, window.scrollY);
    previousTab.current = activeTab;
    if (!activeTab) return;
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: scrollPositions.current.get(activeTab) ?? 0, behavior: "instant" });
      window.dispatchEvent(new CustomEvent("syncly:tab-visible", { detail: activeTab }));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab]);

  return (
    <Suspense fallback={null}>
      {BASE_NAV.map((item) => {
        if (!visited.has(item.to) && activeTab !== item.to) return null;
        const Component = TAB_COMPONENTS[item.to];
        const active = activeTab === item.to;
        return (
          <div key={item.to} hidden={!active} aria-hidden={!active || undefined} inert={!active || undefined}>
            <Component />
          </div>
        );
      })}
    </Suspense>
  );
}
