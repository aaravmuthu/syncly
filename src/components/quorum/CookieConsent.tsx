import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "./ui";
import { Modal } from "./Modal";
import { Switch } from "@/components/ui/switch";
import { CONSENT_EVENT, openCookieSettings, readConsent, saveConsent } from "@/lib/cookie-consent";

export function CookieSettingsButton() {
  return (
    <Button variant="outline" onClick={openCookieSettings}>
      Cookie settings
    </Button>
  );
}
export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [settings, setSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState("");
  const reduce = useReducedMotion();
  useEffect(() => {
    const sync = () => setVisible(!readConsent());
    const open = () => {
      const saved = readConsent();
      setAnalytics(saved?.analytics ?? false);
      setMarketing(saved?.marketing ?? false);
      setError("");
      setSettings(true);
    };
    sync();
    window.addEventListener("syncly:cookie-settings", open);
    window.addEventListener(CONSENT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("syncly:cookie-settings", open);
      window.removeEventListener(CONSENT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  function save(a: boolean, m: boolean) {
    try {
      saveConsent(a, m);
      setVisible(false);
      setSettings(false);
      setError("");
    } catch {
      setError(
        "Your browser could not save these preferences. Allow site storage and try again. Optional cookies remain off.",
      );
    }
  }
  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.section
            aria-labelledby="cookie-title"
            className="fixed left-[max(0.75rem,env(safe-area-inset-left,0px))] right-[max(0.75rem,env(safe-area-inset-right,0px))] bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] z-[60] mx-auto max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1.5rem)] max-w-3xl overflow-y-auto overscroll-contain rounded-2xl bg-card p-4 shadow-xl sm:inset-x-6 sm:p-6"
            initial={{ opacity: 0, transform: reduce ? "none" : "translateY(20px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transform: reduce ? "none" : "translateY(20px)" }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
          >
            <h2 id="cookie-title" className="text-lg font-semibold">
              Your cookie choices
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We use essential storage to keep you signed in and remember your settings. Optional
              analytics and marketing cookies stay off until you choose.{" "}
              <Link to="/privacy" className="underline underline-offset-4">
                Privacy Policy
              </Link>
            </p>
            {error && !settings && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => save(false, false)}>
                Reject optional
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setAnalytics(readConsent()?.analytics ?? false);
                  setMarketing(readConsent()?.marketing ?? false);
                  setSettings(true);
                }}
              >
                Cookie settings
              </Button>
              <Button onClick={() => save(true, true)}>Accept all</Button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
      <Modal
        open={settings}
        onClose={() => setSettings(false)}
        title="Cookie settings"
        description="Choose what this browser can store. You can change your choice at any time from Privacy Policy or Account & privacy."
      >
        <div className="space-y-5">
          <div>
            <p className="font-medium">Essential · always on</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign-in, security, theme and your consent choice. These are needed for the app to
              work.
            </p>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span>
              <label htmlFor="cookie-analytics" className="font-medium">
                Analytics
              </label>
              <span id="cookie-analytics-desc" className="mt-1 block text-sm text-muted-foreground">
                Allow optional measurement of how the app is used.
              </span>
            </span>
            <Switch
              id="cookie-analytics"
              checked={analytics}
              onCheckedChange={setAnalytics}
              aria-describedby="cookie-analytics-desc"
              className="mt-1"
            />
          </div>
          <div className="flex items-start justify-between gap-4">
            <span>
              <label htmlFor="cookie-marketing" className="font-medium">
                Marketing
              </label>
              <span id="cookie-marketing-desc" className="mt-1 block text-sm text-muted-foreground">
                Allow optional cookies for campaigns and advertising.
              </span>
            </span>
            <Switch
              id="cookie-marketing"
              checked={marketing}
              onCheckedChange={setMarketing}
              aria-describedby="cookie-marketing-desc"
              className="mt-1"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Syncly currently has no optional analytics or advertising cookies. Your choice applies
            if these integrations are added. Preferences expire after six months.
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => save(false, false)}>
              Reject optional
            </Button>
            <Button onClick={() => save(analytics, marketing)}>Save preferences</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
