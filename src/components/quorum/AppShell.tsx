import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
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
  SunMoon,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { haptic } from "@/lib/quorum/haptics";
import { Wordmark } from "./Wordmark";
import { ContextSwitcher } from "./ContextSwitcher";

import { Avatar } from "./Avatar";
import { InstallPrompt } from "./InstallPrompt";
import { cn } from "@/lib/utils";
import { ThemeToggle, useTheme } from "@/lib/theme";
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
  const navigate = useNavigate();
  const routedTab = navTab(pathname);
  const selectedTab = routedTab;
  const visibleTab = exactTab(pathname);
  // Radar is map-native: its map is a fixed, full-viewport layer, so the
  // header and bottom nav can't reserve their own flow space above/below it
  // the way every other (normally scrolling) tab needs them to. On Radar
  // they become floating glass overlays instead -- same content, just
  // repositioned out of flow and given a frosted background instead of an
  // opaque one, so the map reads through them at the very top/bottom edges.
  const isRadar = visibleTab === "/radar";
  const navigationLock = useRef({ to: "" as TabPath | "", until: 0 });
  const suppressClickUntil = useRef(0);

  const { unread } = useNotifications();
  const me = useQuery({ queryKey: ["me"], queryFn: useServerFn(getMe), retry: false });
  // AppShell is the "My Squad" experience for everyone -- Family Hub now has
  // its own shell (GuardianShell) and is reached via the ContextSwitcher, not
  // a swapped nav tab here.
  const NAV: NavItem[] = [...BASE_NAV];

  const navigateOnTouch = useCallback((event: React.PointerEvent<HTMLAnchorElement>, to: TabPath) => {
    if (event.pointerType === "mouse" || event.button !== 0) return;
    event.preventDefault();
    const now = performance.now();
    if (to === exactTab(pathname) || now < navigationLock.current.until) return;
    navigationLock.current = { to, until: now + 180 };
    suppressClickUntil.current = now + 500;
    haptic("select");
    void navigate({ to });
  }, [navigate, pathname]);

  const suppressTouchClick = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    if (performance.now() >= suppressClickUntil.current) return;
    event.preventDefault();
    suppressClickUntil.current = 0;
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
        {/* No backdrop-blur outside Radar: this header sits on screen through
            every page transition, and blurring the animating content behind
            it forces the browser to recomposite on every frame -- a real,
            network-independent cost that a near-opaque background avoids.
            On Radar the map behind it needs to actually read through, so it
            switches to `fixed` (out of document flow entirely -- nothing
            below it needs to know it exists) with the glass treatment; the
            main-thread cost of blurring a mostly-static map is worth it
            there specifically. */}
        <header
          className={cn(
            "inset-x-0 top-0 z-30 pt-[env(safe-area-inset-top)]",
            isRadar
              ? "fixed border-0 bg-transparent px-3 md:border-b md:border-border/70 md:px-0"
              : "sticky border-b border-border/70 bg-background/95",
          )}
        >
          <div
            className={cn(
              "mx-auto flex max-w-3xl items-center justify-between px-4 py-3",
              isRadar && "map-glass mt-2 rounded-full py-2 md:mt-0 md:rounded-none md:border-x-0 md:border-t-0 md:py-3",
            )}
          >
            <Link to="/home" className="flex items-center gap-2">
              <Wordmark className="h-6" />
            </Link>
            <div className="flex items-center gap-2">
              <DesktopTabs
                nav={NAV}
                selectedTab={selectedTab}
              />
              <div className={cn("contents", isRadar && "max-md:hidden")}>
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
              {isRadar ? <RadarMobileMenu unread={unread} /> : null}
            </div>
          </div>
        </header>

        {/* Radar's own map container is `fixed inset-0` -- already viewport-
            relative and independent of this padding either way -- but every
            OTHER tab sharing this same persistent host still needs it to
            clear the now-`fixed` header/nav, so it's stripped only while
            Radar is actually the visible tab, not removed outright. */}
        <main className={cn("mx-auto w-full max-w-3xl", !isRadar && "px-4 pb-32 pt-6")}>
          <InstallPrompt />
          <PersistentTabHost activeTab={visibleTab} />
          {visibleTab ? null : <PageTransition>{children}</PageTransition>}
        </main>

        {/* Same reasoning as the header above: opaque everywhere except
            Radar, where it floats over the full-bleed map as glass. */}
        <nav
          className={cn(
            "fixed z-50 pb-[env(safe-area-inset-bottom)] md:hidden",
            isRadar
              ? "inset-x-3 bottom-2 rounded-3xl border-0 bg-transparent"
              : "inset-x-0 bottom-0 border-t border-border/70 bg-background/95",
          )}
        >
          <div className={cn("relative mx-auto flex max-w-md items-stretch justify-between px-2 py-1.5", isRadar && "map-glass rounded-3xl")}>
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
                  onPointerDown={(event) => navigateOnTouch(event, n.to as TabPath)}
                  onClick={suppressTouchClick}
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
}: {
  nav: NavItem[];
  selectedTab: TabPath | null;
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

function RadarMobileMenu({ unread }: { unread: number }) {
  const { resolved, toggle } = useTheme();
  return (
    <div className="md:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Open menu"
            className="tap-target grid place-items-center rounded-full text-foreground"
          >
            <MoreHorizontal className="size-5" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={10} className="map-glass min-w-52 rounded-2xl p-1.5">
          <DropdownMenuItem onSelect={toggle} className="rounded-xl py-2.5">
            <SunMoon aria-hidden />
            {resolved === "dark" ? "Light appearance" : "Dark appearance"}
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="rounded-xl py-2.5">
            <Link to="/activity">
              <Bell aria-hidden />
              Activity{unread > 0 ? ` (${Math.min(unread, 9)}${unread > 9 ? "+" : ""})` : ""}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="rounded-xl py-2.5">
            <Link to="/settings">
              <Settings aria-hidden /> Settings and profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className="px-1 py-1"><ContextSwitcher className="w-full justify-center" /></div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
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
