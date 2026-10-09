import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A published Unicorn Studio scene, mounted through the self-hosted SDK in
 * public/vendor (pinned, so a CDN release can never change the hero under
 * us). The SDK script is injected by our own bundle, which the nonce-based
 * CSP's 'strict-dynamic' trusts; the scene JSON and its font come from
 * assets.unicorn.studio over fetch, which the CSP leaves open.
 *
 * The poster sits underneath and stays the whole story whenever the live
 * scene shouldn't run: reduced motion, no WebGL, or the SDK failing to load.
 */

const SDK_SRC = "/vendor/unicornstudio/unicornStudio-2.4.0.umd.js";

export type UnicornSceneHandle = {
  destroy: () => void;
  /** Runtime override of a layer property that the published scene left live. */
  setProp: (layer: string, prop: string, value: unknown) => void;
};
type UnicornStudioSDK = {
  addScene: (options: Record<string, unknown>) => Promise<UnicornSceneHandle>;
};

declare global {
  interface Window {
    UnicornStudio?: Partial<UnicornStudioSDK>;
  }
}

let sdkPromise: Promise<UnicornStudioSDK> | null = null;

function loadSdk(): Promise<UnicornStudioSDK> {
  const ready = window.UnicornStudio;
  if (ready?.addScene) return Promise.resolve(ready as UnicornStudioSDK);
  sdkPromise ??= new Promise<UnicornStudioSDK>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.onload = () => {
      const sdk = window.UnicornStudio;
      if (sdk?.addScene) resolve(sdk as UnicornStudioSDK);
      else reject(new Error("Unicorn Studio SDK loaded without addScene"));
    };
    script.onerror = () => {
      sdkPromise = null;
      script.remove();
      reject(new Error("Unicorn Studio SDK failed to load"));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function UnicornScene({
  projectId,
  label,
  poster,
  tune,
  className,
}: {
  projectId: string;
  /** What the scene shows, for screen readers and as SEO text in the canvas. */
  label: string;
  poster: { desktop: string; mobile: string };
  /** Adjust the live scene once it exists; `small` is true on phones and touch. */
  tune?: (scene: UnicornSceneHandle, small: boolean) => void;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  const tuneRef = useRef(tune);
  tuneRef.current = tune;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!supportsWebGL()) return;

    // Phones get the same scene at a lower pixel density: the spheres are
    // raymarched per pixel, and 1.5x on a 3x screen buys nothing you can see.
    const small = window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
    let scene: UnicornSceneHandle | null = null;
    let cancelled = false;

    loadSdk()
      .then((sdk) =>
        sdk.addScene({
          element: host,
          projectId,
          production: true,
          fps: 60,
          scale: 1,
          dpi: small ? 1 : 1.5,
          lazyLoad: false,
          altText: label,
          ariaLabel: label,
        }),
      )
      .then((created) => {
        if (cancelled) {
          created.destroy();
          return;
        }
        scene = created;
        tuneRef.current?.(created, small);
        // Let the first frame paint before the poster hands over.
        requestAnimationFrame(() => requestAnimationFrame(() => setLive(true)));
      })
      .catch(() => {
        // The poster is already the fallback; nothing else to do.
      });

    return () => {
      cancelled = true;
      scene?.destroy();
      scene = null;
    };
  }, [projectId, label]);

  return (
    <div className={cn("us-scene", className)} data-live={live || undefined}>
      <picture className="us-scene__poster" aria-hidden>
        <source media="(max-width: 767px)" srcSet={poster.mobile} />
        <img src={poster.desktop} alt="" decoding="async" fetchPriority="high" />
      </picture>
      <div ref={hostRef} className="us-scene__canvas" />
    </div>
  );
}
