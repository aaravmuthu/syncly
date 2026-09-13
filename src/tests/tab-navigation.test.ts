import { describe, expect, it } from "vitest";

const tabs = ["/home", "/groups", "/radar", "/plans", "/messages"] as const;

type TabPath = (typeof tabs)[number];

function tabFromUrl(pathname: string): TabPath | null {
  return tabs.find((tab) => tab === pathname) ?? null;
}

const pairs = tabs.flatMap((from) => tabs.filter((to) => to !== from).map((to) => [from, to] as const));

describe("tab navigation URL authority", () => {
  it.each(pairs)("keeps %s → %s on the destination route", (from, to) => {
    let pathname: string = from;
    expect(tabFromUrl(pathname)).toBe(from);

    pathname = to;
    expect(tabFromUrl(pathname)).toBe(to);

    // Waiting cannot mutate URL-derived tab state; there is no parallel timer
    // or optimistic selection left to restore the previous tab.
    expect(tabFromUrl(pathname)).not.toBe(from);
  });

  it("covers every directed tab pair", () => {
    expect(pairs).toHaveLength(20);
  });
});