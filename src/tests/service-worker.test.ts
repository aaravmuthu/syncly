import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type WorkerEvent = {
  request: Request;
  respondWith: (response: Promise<Response | undefined>) => void;
  waitUntil: (work: Promise<unknown>) => void;
};
const source = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");

function worker() {
  const handlers: Record<string, (event: WorkerEvent) => void> = {};
  const response = new Response("static asset");
  const fetch = vi.fn().mockResolvedValue(response);
  const cache = {
    match: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
    addAll: vi.fn().mockResolvedValue(undefined),
  };
  const offline = new Response("You are offline");
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    match: vi.fn().mockResolvedValue(offline),
    keys: vi.fn().mockResolvedValue(["syncly-v1", "syncly-v2", "another-app"]),
    delete: vi.fn().mockResolvedValue(true),
  };
  runInNewContext(source, {
    URL,
    fetch,
    caches,
    self: {
      location: { origin: "https://syncly.test" },
      addEventListener: (name: string, handler: (event: WorkerEvent) => void) => {
        handlers[name] = handler;
      },
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn() },
    },
  });
  return { handlers, fetch, cache, caches, offline, response };
}
function event(request: Request) {
  return {
    request,
    respondWith: vi.fn<(response: Promise<Response | undefined>) => void>(),
    waitUntil: vi.fn<(work: Promise<unknown>) => void>(),
  };
}

describe("service worker privacy boundary", () => {
  it.each(["/_serverFn/profile", "/approve/private-token", "/api/notifications"])(
    "does not intercept dynamic GET %s",
    (path) => {
      const w = worker();
      const e = event(new Request(`https://syncly.test${path}`));
      w.handlers.fetch(e);
      expect(e.respondWith).not.toHaveBeenCalled();
      expect(w.caches.open).not.toHaveBeenCalled();
    },
  );
  it("never stores a navigation response, even on an approval link", async () => {
    const w = worker();
    const request = {
      method: "GET",
      url: "https://syncly.test/approve/private-token",
      mode: "navigate",
    } as Request;
    const e = event(request);
    w.handlers.fetch(e);
    expect(await e.respondWith.mock.calls[0][0]).toBe(w.response);
    expect(w.cache.put).not.toHaveBeenCalled();
  });
  it("uses the generic offline page instead of a cached approval or account page", async () => {
    const w = worker();
    w.fetch.mockRejectedValue(new TypeError("Offline"));
    const e = event({
      method: "GET",
      url: "https://syncly.test/home",
      mode: "navigate",
    } as Request);
    w.handlers.fetch(e);
    expect(await e.respondWith.mock.calls[0][0]).toBe(w.offline);
    expect(w.caches.match).toHaveBeenCalledWith("/offline.html");
  });
  it("clears only old Syncly caches during activation", async () => {
    const w = worker();
    const e = event(new Request("https://syncly.test/"));
    w.handlers.activate(e);
    await e.waitUntil.mock.calls[0][0];
    expect(w.caches.delete).toHaveBeenCalledExactlyOnceWith("syncly-v1");
  });
});
