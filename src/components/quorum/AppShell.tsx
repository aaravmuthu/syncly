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
import {
  Bell,
  House,
  MessageCircle,
  MoreHorizontal,
  Radar,
  Settings,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { haptic } from "@/lib/quorum/haptics";
import { Wordmark } from "./Wordmark";
import { ContextSwitcher } from "./ContextSwitcher";

import { Avatar } from "./Avatar";
import { Pill } from "./ui";
import { InstallPrompt } from "./InstallPrompt";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/lib/theme";
import { useNotifications } from "@/lib/quorum/useNotifications";
import { getMe } from "@/lib/quorum/plan.functions";
import { FriendProvider } from "@/lib/quorum/nicknames";
import { FriendProfileSheet } from "./friend/FriendProfileSheet";
import { PageTransition } from "./interactions/PageTransition";
import { AskSynclySheet } from "./ai/AskSynclySheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const clickCommitted = useRef(false);

  const { unread } = useNotifications();
  const me = useQuery({ queryKey: ["me"], queryFn: useServerFn(getMe), retry: false });
  // AppShell is the "My Squad" experience for everyone -- Family Hub now has
  // its own shell (GuardianShell) and is reached via the ContextSwitcher, not
  // a swapped nav tab here.
  const NAV: NavItem[] = [...BASE_NAV];

  useEffect(() => {
    if (optimisticTab && routedTab === optimisticTab) setOptimisticTab(null);
  }, [optimisticTab, routedTab]);

  // Safety net only: if a navigation somehow never lands, don't stay stuck on
  // an optimistic tab forever. Deliberately long, so a slow-loading tab is
  // never yanked back to the previous screen mid-navigation.
  useEffect(() => {
    if (!optimisticTab) return;
    const timeout = window.setTimeout(() => setOptimisticTab(null), 6000);
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
    clickCommitted.current = false;
    navigationLock.current = { to, until: now + 180 };
    setOptimisticTab(to);
    if (window.matchMedia("(pointer: coarse)").matches) haptic("select");

    const target = event.currentTarget;

    // A touch that ends without a click (finger slid off the tab, scroll took
    // over, browser cancelled the gesture) must not leave the optimistic tab
    // selected — otherwise the shell shows a tab the router never navigated
    // to and later snaps back. That's the ONLY case this should revert for.
    //
    // This used to revert on a flat 120ms timeout after pointerup instead,
    // racing it against the browser's own (already-guaranteed, since
    // touch-action: manipulation removes any tap/pan ambiguity) click
    // dispatch. Under Radar's heavier main-thread load -- Mapbox render +
    // marker layout work -- that dispatch could occasionally land after
    // 120ms had already elapsed, so settle() reverted a tab switch that was
    // genuinely still in flight, which is what actually caused switches
    // away from Radar to snap back. A fixed timeout can't self-adjust to
    // main-thread congestion; double requestAnimationFrame can, since it
    // won't run until the browser is idle enough to paint a frame -- the
    // same condition the pending click needs to actually dispatch. So this
    // now only ever reverts on a real abandoned-gesture signal (pointerup
    // landing outside the tapped element, or pointercancel), never on
    // elapsed time alone.
    const settle = () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      if (!clickCommitted.current) {
        console.warn(`[tab-switch] "${to}" primed but no click landed -- reverting`);
        setOptimisticTab((current) => (current === to ? null : current));
      }
    };
    const onUp = (upEvent: PointerEvent) => {
      const landedOnTarget =
        target instanceof Node &&
        (upEvent.target === target || target.contains(upEvent.target as Node));
      if (landedOnTarget) {
        requestAnimationFrame(() => requestAnimationFrame(settle));
      } else {
        settle();
      }
    };
    const onCancel = () => settle();
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("pointercancel", onCancel, { once: true });
  }, []);

  const commitTab = useCallback((event: React.MouseEvent, to: TabPath) => {
    if (blockNextClick.current) {
      blockNextClick.current = false;
      event.preventDefault();
      return;
    }

    clickCommitted.current = true;

    if (event.detail === 0) {
      const now = performance.now();
      if (now < navigationLock.current.until && navigationLock.current.to !== to) {
        event.preventDefault();
        return;
      }
      navigationLock.current = { to, until: now + 180 };
    }
    setOptimisticTab(to);
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
        {/* The floating top bar: a Radar-style glass capsule with margin on
            every side, not an edge-to-edge strip, on every screen -- this is
            the app's one nav-chrome language now, not something special-
            cased for the map. Blurring a `fixed` element that's always on
            screen does cost more than the old opaque bar did (no free
            lunch on the backdrop-filter recompositing cost), but that's the
            deliberate tradeoff of making glass the standard look everywhere
            instead of only where a map happened to make it free. */}
        <header className="glass-pill fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 mx-auto max-w-3xl rounded-full">
          <div className="flex items-center justify-between px-4 py-2.5">
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
              {/* Desktop has room for the full icon row; mobile collapses it
                  into one overflow trigger instead (see OverflowMenu). */}
              <div className="hidden items-center gap-2 md:flex">
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
              <div className="md:hidden">
                <OverflowMenu
                  unread={unread}
                  avatarUrl={me.data?.avatar_url}
                  avatarEmoji={me.data?.avatar_emoji}
                  avatarName={me.data?.display_name}
                />
              </div>
            </div>
          </div>
        </header>

        {/* Every screen's content runs full-bleed behind the floating
            chrome now (the way Radar's map always did) instead of sitting
            in a box the header/nav used to reserve -- --chrome-top/
            --chrome-bottom (styles.css) are the one place that clearance is
            defined, shared with every screen's own floating controls so
            they can't drift out of sync with the bar they're clearing. */}
        <main className="mx-auto w-full max-w-3xl px-4 pb-[var(--chrome-bottom)] pt-[var(--chrome-top)] md:pb-6">
          <InstallPrompt />
          <PersistentTabHost activeTab={visibleTab} />
          {visibleTab ? null : <PageTransition>{children}</PageTransition>}
        </main>

        {/* Same floating-pill treatment as the header; hidden on desktop,
            where DesktopTabs in the header already covers navigation. */}
        <nav className="glass-pill fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-50 mx-auto max-w-md rounded-full md:hidden">
          <div className="relative flex items-stretch justify-between px-2 py-1.5">
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

/**
 * Mobile's collapsed replacement for the header's full desktop icon row --
 * appearance, the AI entry point, activity, settings, and profile all live
 * behind one trigger instead of each claiming their own tap target in an
 * already-compact capsule. Each row keeps its own component's real click
 * handling (ContextSwitcher/ThemeToggle/AskSynclySheet aren't "menu items",
 * they're whole standalone components with their own state) rather than
 * reimplementing their behavior here.
 */
function OverflowMenu({
  unread,
  avatarUrl,
  avatarEmoji,
  avatarName,
}: {
  unread: number;
  avatarUrl?: string | null;
  avatarEmoji?: string | null;
  avatarName?: string | null;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `More, ${unread} unread` : "More"}
          className="tap-target pressable active:pressable-active relative inline-flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <MoreHorizontal className="size-5" aria-hidden />
          {unread > 0 ? (
            <span
              aria-hidden
              className="absolute right-0.5 top-0.5 inline-grid min-w-3.5 place-items-center rounded-full bg-primary px-1 text-caption font-semibold leading-4 text-primary-foreground"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="text-sm text-muted-foreground">Appearance</span>
          <ThemeToggle />
        </div>
        <ContextSwitcher className="mx-2 mb-1.5" />
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <AskSynclySheet />
          <span className="text-sm">Ask Syncly</span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/activity" className="flex w-full items-center gap-2">
            <Bell className="size-4" aria-hidden />
            Activity
            {unread > 0 ? (
              <Pill tone="accent" className="ml-auto">
                {unread > 9 ? "9+" : unread}
              </Pill>
            ) : null}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings" className="flex w-full items-center gap-2">
            <Settings className="size-4" aria-hidden />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings" className="flex w-full items-center gap-2">
            <Avatar url={avatarUrl} emoji={avatarEmoji} name={avatarName} size={20} />
            Your profile
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
