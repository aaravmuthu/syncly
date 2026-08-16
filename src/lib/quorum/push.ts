/** Browser notification helpers. All calls are safe to make on the client only. */

export function pushSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestPush() {
  if (!pushSupported()) return "unsupported" as const;
  if (Notification.permission === "granted") return "granted" as const;
  if (Notification.permission === "denied") return "denied" as const;
  return (await Notification.requestPermission()) as NotificationPermission;
}

/** Shows a browser notification if the user has opted in. */
export function showPush(title: string, body?: string, tag?: string) {
  if (!pushSupported() || Notification.permission !== "granted") return;
  if (typeof document !== "undefined" && document.visibilityState === "visible") return;
  try {
    new Notification(title, {
      body: body ?? "",
      ...(tag ? { tag } : {}),
      icon: "/favicon.ico",
    });
  } catch {
    /* some browsers require a service worker — silently skip */
  }
}
