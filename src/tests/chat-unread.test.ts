import { describe, expect, it } from "vitest";
import { unreadSquadMessageIds } from "../lib/quorum/chat-unread";

describe("squad unread receipts", () => {
  const messages = [
    { id: "announcement", sender_id: null },
    { id: "friend", sender_id: "peer" },
    { id: "own", sender_id: "me" },
  ];
  it("marks system plan announcements and peer messages, excluding my own", () => {
    expect(unreadSquadMessageIds(messages, "me", new Set())).toEqual(["announcement", "friend"]);
  });
  it("does not leave a sticky badge after the conversation has been viewed", () => {
    const receipts = new Set(unreadSquadMessageIds(messages, "me", new Set()));
    expect(unreadSquadMessageIds(messages, "me", receipts)).toEqual([]);
  });
  it("preserves only genuinely unread arrivals", () => {
    expect(unreadSquadMessageIds(messages, "me", new Set(["announcement"]))).toEqual(["friend"]);
  });
});
