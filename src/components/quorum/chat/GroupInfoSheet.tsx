import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Drawer } from "vaul";
import { X } from "lucide-react";
import { Avatar } from "@/components/quorum/Avatar";
import { Skeleton } from "@/components/quorum/ui";
import { useFriends } from "@/lib/quorum/friends-context";
import { getGroup } from "@/lib/quorum/plan.functions";
import { UNNAMED } from "@/lib/quorum/names";

type MemberRow = {
  role: string | null;
  profile_id: string;
  profiles: {
    id: string;
    display_name: string | null;
    avatar_emoji: string | null;
    avatar_url: string | null;
  } | null;
};

/**
 * Who is in this squad, one tap from the chat header. Nested inside the chat
 * sheet so dismissing it returns to the thread. Reads the same `["group", id]`
 * query as the squad page, so it is usually already cached.
 */
export function GroupInfoSheet({
  groupId,
  name,
  emoji,
  avatarUrl,
  open,
  onOpenChange,
  onOpenSquad,
}: {
  groupId: string;
  name: string;
  emoji: string;
  avatarUrl: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOpenSquad: () => void;
}) {
  const fetchGroup = useServerFn(getGroup);
  const { alias, openFriend } = useFriends();
  const q = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => fetchGroup({ data: { groupId } }),
    enabled: open,
  });
  const members = (q.data?.members ?? []) as unknown as MemberRow[];
  const myId = q.data?.myProfileId ?? null;

  return (
    <Drawer.NestedRoot open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[55] bg-black/40" />
        <Drawer.Content className="mobile-sheet fixed inset-x-0 bottom-0 z-[55] mx-auto flex w-full max-w-2xl flex-col rounded-t-surface border border-border bg-card text-foreground shadow-2xl outline-none !px-0">
          <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-foreground/20" />
          <div className="relative flex shrink-0 flex-col items-center gap-1 px-12 pb-3 pt-4 text-center">
            <Drawer.Close
              aria-label="Close group info"
              className="tap-target absolute right-2 top-2 grid place-items-center rounded-full text-muted-foreground"
            >
              <X className="size-5" aria-hidden />
            </Drawer.Close>
            <span className="grid size-16 place-items-center overflow-hidden rounded-full bg-secondary text-3xl">
              {avatarUrl ? <img src={avatarUrl} alt="" className="size-16 object-cover" /> : emoji}
            </span>
            <Drawer.Title className="mt-1 max-w-full text-base font-semibold [overflow-wrap:anywhere]">
              {name}
            </Drawer.Title>
            <Drawer.Description className="text-caption text-muted-foreground">
              {q.isLoading
                ? "Loading members…"
                : `${members.length} member${members.length === 1 ? "" : "s"}`}
            </Drawer.Description>
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border/60 px-2 py-1">
            {q.isLoading
              ? [0, 1, 2].map((i) => (
                  <li key={i} className="flex items-center gap-3 px-2 py-2.5">
                    <Skeleton className="size-10 rounded-full" />
                    <Skeleton className="h-4 w-1/3" />
                  </li>
                ))
              : q.isError
                ? [
                    <li key="err" className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Couldn't load members. Close and try again.
                    </li>,
                  ]
                : members.map((m) => {
                    const p = m.profiles;
                    const shown = alias(m.profile_id, p?.display_name);
                    const unnamed = !p?.display_name || shown === UNNAMED;
                    const you = m.profile_id === myId;
                    return (
                      <li key={m.profile_id}>
                        <button
                          type="button"
                          disabled={you}
                          onClick={() => openFriend(m.profile_id)}
                          className="tap-target flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left active:bg-foreground/5"
                        >
                          <Avatar
                            url={p?.avatar_url}
                            emoji={p?.avatar_emoji}
                            name={shown}
                            size={40}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {unnamed ? (
                              <>
                                Squad member
                                <span className="font-normal italic text-muted-foreground">
                                  {" "}
                                  · no name yet
                                </span>
                              </>
                            ) : (
                              shown
                            )}
                            {you ? <span className="text-muted-foreground"> (you)</span> : null}
                          </span>
                          {m.role === "owner" || m.role === "admin" ? (
                            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-caption font-semibold text-primary">
                              {m.role === "owner" ? "Host" : "Admin"}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
          </ul>

          <div className="shrink-0 border-t border-border/60 p-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
            <Link
              to="/groups/$groupId"
              params={{ groupId }}
              onClick={onOpenSquad}
              className="tap-target flex w-full items-center justify-center rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground active:scale-[0.99]"
            >
              Open squad page
            </Link>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.NestedRoot>
  );
}
