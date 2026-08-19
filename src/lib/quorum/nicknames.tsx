import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getNicknames } from "./friend.functions";
import { aliasFor } from "./friend";

type FriendSheetCtx = {
  nicknames: Record<string, string>;
  /** Nickname-first display name for any profile id. */
  alias: (profileId: string | null | undefined, fallback: string | null | undefined) => string;
  /** Opens the Friend Profile Sheet for a member. */
  openFriend: (profileId: string) => void;
  closeFriend: () => void;
  friendId: string | null;
};

const Ctx = createContext<FriendSheetCtx | null>(null);

/**
 * Holds the signed-in user's private nicknames and the globally-shared Friend
 * Profile Sheet, so any avatar, pin or name anywhere can open the same drawer.
 */
export function FriendProvider({ children }: { children: ReactNode }) {
  const [friendId, setFriendId] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["nicknames"],
    queryFn: useServerFn(getNicknames),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const nicknames = q.data ?? {};

  const alias = useCallback(
    (profileId: string | null | undefined, fallback: string | null | undefined) =>
      aliasFor(nicknames, profileId, fallback),
    [nicknames],
  );

  const value = useMemo<FriendSheetCtx>(
    () => ({
      nicknames,
      alias,
      friendId,
      openFriend: (id: string) => setFriendId(id),
      closeFriend: () => setFriendId(null),
    }),
    [nicknames, alias, friendId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Safe outside the provider (public routes): falls back to plain names. */
export function useFriends(): FriendSheetCtx {
  const ctx = useContext(Ctx);
  return (
    ctx ?? {
      nicknames: {},
      alias: (_id, fallback) => fallback ?? "Member",
      openFriend: () => {},
      closeFriend: () => {},
      friendId: null,
    }
  );
}
