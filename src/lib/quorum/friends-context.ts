import { createContext, useContext } from "react";

export type FriendSheetCtx = {
  nicknames: Record<string, string>;
  /** Nickname-first display name for any profile id. */
  alias: (profileId: string | null | undefined, fallback: string | null | undefined) => string;
  /** Opens the Friend Profile Sheet for a member. */
  openFriend: (profileId: string) => void;
  closeFriend: () => void;
  friendId: string | null;
};

export const Ctx = createContext<FriendSheetCtx | null>(null);

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
