import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class Control {
  isConnected = true;
  closest() {
    return this;
  }
  getBoundingClientRect() {
    return { left: 10, top: 20, width: 120, height: 44 };
  }
}

const events = new Map<string, (event: Record<string, unknown>) => void>();

beforeEach(() => {
  vi.resetModules();
  events.clear();
  vi.stubGlobal("Element", Control);
  vi.stubGlobal("document", {
    addEventListener: (name: string, fn: (event: Record<string, unknown>) => void) =>
      events.set(name, fn),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("site-wide action feedback", () => {
  it("attaches success to the pressed control and preserves its explanation", async () => {
    const { toast } = await import("../lib/quorum/toast");
    const { getInlineError } = await import("../lib/quorum/inline-error");
    const button = new Control();
    events.get("pointerdown")!({ target: button, clientX: 40, clientY: 30 });
    toast.success("Saved", { description: "Your preferences are up to date." });
    expect(getInlineError()).toMatchObject({
      anchor: button,
      tone: "success",
      title: "Saved",
      description: "Your preferences are up to date.",
    });
  });

  it("keeps the failure reason and recovery action", async () => {
    const { toast } = await import("../lib/quorum/toast");
    const { getInlineError } = await import("../lib/quorum/inline-error");
    const onClick = vi.fn();
    toast.error("Upload rejected", {
      description: "This image exceeds the 5 MB limit.",
      action: { label: "Choose another image", onClick },
    });
    expect(getInlineError()).toMatchObject({
      tone: "error",
      description: "This image exceeds the 5 MB limit.",
      action: { onClick },
    });
  });

  it("retains outcomes without a live control instead of falling back to a banner", async () => {
    const { toast } = await import("../lib/quorum/toast");
    const { getInlineError } = await import("../lib/quorum/inline-error");
    const button = new Control();
    events.get("pointerdown")!({ target: button });
    button.isConnected = false;
    toast.success("Plan created");
    expect(getInlineError()).toMatchObject({
      anchor: null,
      tone: "success",
      title: "Plan created",
    });
  });

  it("does not attach a background notification to an unrelated recent press", async () => {
    const { showInlineFeedback, getInlineError } = await import("../lib/quorum/inline-error");
    events.get("pointerdown")!({ target: new Control() });
    showInlineFeedback("Location shared", { anchor: null, tone: "info" });
    expect(getInlineError()?.anchor).toBeNull();
  });

  it("maps warnings to rejection feedback and preserves undo actions", async () => {
    const { toast } = await import("../lib/quorum/toast");
    const { getInlineError } = await import("../lib/quorum/inline-error");
    toast.warning("Choose a future date");
    expect(getInlineError()?.tone).toBe("error");
    const undo = vi.fn();
    toast("Plan dimmed for this visit", { action: { label: "Undo", onClick: undo } });
    expect(getInlineError()).toMatchObject({
      tone: "info",
      action: { label: "Undo", onClick: undo },
    });
  });

  it("ignores dismissal from an older outcome", async () => {
    const { toast } = await import("../lib/quorum/toast");
    const { getInlineError } = await import("../lib/quorum/inline-error");
    const first = toast.error("First failure");
    const second = toast.success("Retry worked");
    toast.dismiss(first);
    expect(getInlineError()?.id).toBe(second);
    toast.dismiss(second);
    expect(getInlineError()).toBeNull();
  });
});
