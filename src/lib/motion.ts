/**
 * The landing page's one motion language: a strong ease-out that starts fast
 * and settles softly, so scroll reveals feel like they respond rather than
 * drift in. Shared by the hero device and every Reveal below it.
 */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Entrance for content arriving on scroll: rise a short way while fading in. */
export const REVEAL_TRANSITION = { duration: 0.5, ease: EASE_OUT } as const;
export const REVEAL_RISE = 16;
