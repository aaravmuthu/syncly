import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Link2, Moon, Rocket, Zap } from "lucide-react";
import { PageHeader } from "@/components/quorum/AppShell";
import { Avatar } from "@/components/quorum/Avatar";
import { Button, Empty, Skeleton, statusToneClasses } from "@/components/quorum/ui";
import { CreateGroupModal } from "@/components/quorum/CreateGroupModal";
import { JoinGroupModal } from "@/components/quorum/JoinGroupModal";
import { coverTheme } from "@/lib/quorum/covers";
import { listGroups } from "@/lib/quorum/plan.functions";
import { PullToRefresh, RevealGroup, RevealItem, SpotlightCard } from "@/components/quorum/interactions";
import { motion } from "motion/react";
import { haptic } from "@/lib/quorum/haptics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_app/groups/")({
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData({ queryKey: ["groups"], queryFn: () => listGroups() });
  },
  head: () => ({
    meta: [
      { title: "Squad hub — Syncly" },
      {
        name: "description",
        content:
          "Your squads at a glance: live votes, member stacks, invite codes, and one-tap plan launches.",
      },
      { property: "og:title", content: "Squad hub — Syncly" },
      {
        property: "og:description",
        content: "Live squads, active votes, and one-tap plan launches.",
      },
    ],
  }),
  component: () => null,
});

type SquadMember = {
  profile_id: string;
  display_name: string;
  avatar_emoji: string;
  avatar_url: string | null;
};

type Squad = {
  id: string;
  name: string;
  emoji: string;
  kind: string;
  invite_code: string;
  avatar_url: string | null;
  cover_theme: string | null;
  member_count: number;
  members: SquadMember[];
  active_plan: { id: string; title: string; status: string } | null;
  hangouts_completed: number;
  top_spot: string | null;
};

const FILTERS = [
  { id: "all", label: "All Squads" },
  { id: "active", label: "Active Plans" },
  { id: "oneoff", label: "One-Off Events" },
] as const;

export function GroupsPage() {
  const groups = useQuery({ queryKey: ["groups"], queryFn: useServerFn(listGroups) });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const squads = (groups.data ?? []) as unknown as Squad[];
  const shown = useMemo(
    () =>
      squads.filter((g) =>
        filter === "active"
          ? Boolean(g.active_plan)
          : filter === "oneoff"
            ? g.kind === "temporary"
            : true,
      ),
    [squads, filter],
  );

  return (
    <>
      <PageHeader
        title="Squad hub"
        subtitle="Your circles, live votes, and one-tap plan launches."
        action={
          <div className="flex gap-2">
            <Button variant="glass" className="text-primary" onClick={() => setCreateOpen(true)}>
              + Create Group
            </Button>
            <Button variant="glass" onClick={() => setJoinOpen(true)}>
              <Link2 className="size-4" aria-hidden /> Join with Code
            </Button>
          </div>
        }
      />
      <PullToRefresh onRefresh={async () => void (await groups.refetch())}>
      <div className="scrollbar-none sticky top-2 z-20 -mx-1 mb-5 flex snap-x gap-2 overflow-x-auto px-1 py-1">
        {FILTERS.map((f) => (
          <motion.button
            key={f.id}
            type="button"
            whileTap={{ scale: 0.94 }}
            animate={{ scale: filter === f.id ? 1.03 : 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            onClick={() => {
              haptic("select");
              setFilter(f.id);
            }}
            className={cn(
              "tap-target inline-flex shrink-0 items-center justify-center rounded-full px-4 text-sm font-semibold transition",
              // Filled primary is a real selection indicator here (this is
              // a segmented filter, not just "the more important button"),
              // so the active pill stays solid while inactive ones get the
              // floating-glass treatment instead of the old flat bg-secondary.
              filter === f.id ? "bg-primary text-primary-foreground shadow-lg" : "glass-pill text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </motion.button>
        ))}
      </div>

      {groups.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : null}

      {groups.isError ? (
        <Empty
          title="Couldn't load your squads"
          body="Check your connection and try again."
          action={<Button onClick={() => groups.refetch()}>Try again</Button>}
        />
      ) : null}

        {!groups.isLoading && !groups.isError && shown.length === 0 ? (
          <Empty
            title={squads.length ? "Nothing in this filter" : "No squads yet"}
            body={
              squads.length
                ? "Try another tab, or launch a plan to light one up."
                : "Create a squad or join one with a six-character code."
            }
            action={<Button onClick={() => setCreateOpen(true)}>+ Create Group</Button>}
          />
        ) : null}

      <RevealGroup className="grid gap-4 sm:grid-cols-2" stagger={0.07}>
        {shown.map((g) => (
          <RevealItem key={g.id}>
            <SpotlightCard tilt className="rounded-surface">
              <SquadCard squad={g} />
            </SpotlightCard>
          </RevealItem>
        ))}
      </RevealGroup>

      </PullToRefresh>

      <CreateGroupModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinGroupModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </>
  );
}

function SquadCard({ squad }: { squad: Squad }) {
  const navigate = useNavigate();
  const theme = coverTheme(squad.cover_theme);
  const extra = Math.max(0, squad.member_count - squad.members.length);

  return (
    <article className="surface group overflow-hidden transition-all hover:border-primary/40 active:scale-[0.99]">
      <Link to="/groups/$groupId" params={{ groupId: squad.id }} className="block">
        <div className={cn("relative h-24", theme.banner)}>
          <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_10%_0%,rgba(255,255,255,0.18),transparent_60%)]" />
          <span className="absolute right-3 top-3 rounded-full bg-black/35 px-2.5 py-1 text-caption font-semibold text-white ring-1 ring-white/20 backdrop-blur">
            {squad.kind === "temporary" ? "One-Off" : "Ongoing"}
          </span>
          <div className="absolute -bottom-6 left-4 flex items-end gap-3">
            <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-neutral-950/85 text-2xl ring-1 ring-white/15 backdrop-blur">
              {squad.avatar_url ? (
                <img
                  src={squad.avatar_url}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                squad.emoji
              )}
            </span>
          </div>
        </div>

        <div className="px-5 pb-1 pt-8">
          <h3 className="font-display text-lg font-semibold text-foreground">{squad.name}</h3>

          <div className="mt-3 flex items-center gap-3">
            <div className="flex -space-x-2">
              {squad.members.map((m) => (
                <Avatar
                  key={m.profile_id}
                  url={m.avatar_url}
                  emoji={m.avatar_emoji}
                  name={m.display_name}
                  size={30}
                  className="ring-2 ring-card"
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {extra > 0
                ? `+${extra} others`
                : `${squad.member_count} member${squad.member_count === 1 ? "" : "s"}`}
            </span>
          </div>

          <div
            className={cn(
              "mt-3 inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-3 py-1.5 text-xs font-semibold ring-1",
              squad.active_plan ? statusToneClasses("voting") : "bg-secondary text-muted-foreground ring-border",
            )}
          >
            {squad.active_plan ? (
              <>
                <Zap className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">Active vote: {squad.active_plan.title}</span>
              </>
            ) : (
              <>
                <Moon className="size-3.5 shrink-0" aria-hidden /> No active plans
              </>
            )}
          </div>

          <p className="mt-3 text-caption text-muted-foreground">
            {squad.hangouts_completed} hangout{squad.hangouts_completed === 1 ? "" : "s"} completed
            {squad.top_spot ? ` • Most frequent spot: ${squad.top_spot}` : ""}
          </p>
        </div>
      </Link>

      <div className="flex items-center gap-2 px-5 pb-5 pt-4">
        <Button
          className="flex-1"
          onClick={() => void navigate({ to: "/groups/$groupId", params: { groupId: squad.id } })}
        >
          <Rocket className="size-4" aria-hidden /> Launch Plan
        </Button>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(squad.invite_code)
              .then(() => toast.success("Invite code copied"))
              .catch(() => toast.error("Couldn't copy that code"));
          }}
          className="tap-target pressable inline-flex items-center gap-1.5 justify-center rounded-2xl bg-secondary px-3 text-xs font-semibold text-foreground/80 ring-1 ring-border transition hover:bg-secondary/70"
        >
          <Copy className="size-3.5" aria-hidden /> Copy Code {squad.invite_code}
        </button>
      </div>
    </article>
  );
}
