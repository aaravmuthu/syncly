import { useEffect, useState } from "react";

/** Registers the service worker. No-ops in SSR or unsupported browsers. */
export function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline-resilience is a nice-to-have, never block the app on it */
    });
  });
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !("MSStream" in window);
}

/**
 * Drives the "Add to Home Screen" affordance. Chrome/Android/desktop fire
 * `beforeinstallprompt`, which we capture and replay from our own UI instead
 * of the browser's generic mini-infobar. iOS Safari never fires that event
 * at all — there's no programmatic install API — so callers on iOS get
 * `platform: "ios"` and are expected to show the manual Share-sheet
 * instructions instead of an Install button.
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  // "ios" gets manual Share-sheet instructions (no install API exists there);
  // everything else either gets a native prompt button (canPromptInstall) or,
  // if the browser never fired beforeinstallprompt, nothing at all.
  const [platform, setPlatform] = useState<"ios" | "other">("other");

  useEffect(() => {
    setStandalone(isStandaloneDisplay());
    setPlatform(isIos() ? "ios" : "other");

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferred) return "unavailable" as const;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome;
  };

  return {
    standalone,
    platform,
    canPromptInstall: Boolean(deferred),
    promptInstall,
  };
}
