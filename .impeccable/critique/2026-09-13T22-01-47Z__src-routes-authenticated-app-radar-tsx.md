---
target: Radar map screen
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:/Users/aaravmuthu/syncly/src/routes/_authenticated/_app/radar.tsx"
target_fingerprint: "sha256:28f9d95f73c7f01cf54b857b3a12f3336bca5a07d7328f739ae885720295c327"
target_path: /Users/aaravmuthu/syncly/src/routes/_authenticated/_app/radar.tsx
timestamp: 2026-09-13T22-01-47Z
slug: src-routes-authenticated-app-radar-tsx
---
Method: dual-agent (A: design-review subagent · B: detector-scan subagent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No staleness cue on pins/focus card, no geolocation-permission state, unlabeled generic skeleton (radar.tsx:312) |
| 2 | Match System / Real World | 3 | Plain-spoken copy ("Ghost Mode," "I arrived safely," "Fair midpoint") fits brand voice well |
| 3 | User Control and Freedom | 2 | Stop-sharing/Ghost mode exist but nested in modals reached only via FindMyFriends, not from the map itself |
| 4 | Consistency and Standards | 1 | Hardcoded, non-token pin/route/zone colors directly violate the app's own Evergreen/Ember two-color rule |
| 5 | Error Prevention | 2 | "Remove from my map" (FindMyFriends.tsx:411-418) fires immediately on click, no confirm step |
| 6 | Recognition Rather Than Recall | 2 | Five icon-only map-dock controls with no visible labels or first-run hint |
| 7 | Flexibility and Efficiency | 3 | List-view fallback, search, adaptive desktop rail vs. mobile dock |
| 8 | Aesthetic and Minimalist Design | 2 | Search pill + 5-button dock + focus card + RadarSheet pill can all be on-screen at once on a phone |
| 9 | Error Recovery | 1 | SquadMap.tsx:47 — a failed location-token fetch renders nothing, no error, no retry |
| 10 | Help and Documentation | 2 | Icon buttons carry only screen-reader `aria-label`; sighted first-timers get no inline explainer |
| **Total** | | **20/40** | **Acceptable — significant improvements needed** |

## Design Specificity Verdict

**Fails the "authored for Night Radar" bar, despite the surrounding chrome clearly being built for it.** The frosted-glass pills, the `--chrome-top`/`--chrome-bottom` inset system, and the pulse-ring markup are genuinely bespoke. But the actual signal color — pin halo, safe-zone, route, isochrone, place-pin — is completely decoupled from the design system's tokens:

- `haloFor()` in `src/components/quorum/map/SquadMapInner.tsx:57-58` hardcodes `#34d399` / `#fbbf24` / `#a1a1aa` (Tailwind emerald/amber/zinc) instead of `var(--success)` / `var(--warning)` / `var(--muted-foreground)`.
- Isochrone rings: `#22d3ee` cyan (`SquadMapInner.tsx:204,211`).
- Safe zones/routes: `#34d399` again (`SquadMapInner.tsx:221,227,235`).
- "Fair midpoint" pin: `#a78bfa` violet (`src/styles.css:745`).
- Place pins: `#38bdf8` sky / `#f472b6` pink (`src/styles.css:717-726`).

None of these are Evergreen Signal or Warm Ember. A screen whose whole design system calls its map-pin language "the signature component" ships a map that is, chromatically, a generic six-color demo underneath genuinely well-built glass chrome. Swap the Mapbox style and pin markup into any other live-tracking app and nothing about the color language would out it as Syncly.

**Deterministic scan**: `impeccable detect --json` ran clean (exit 0, zero findings) against `radar.tsx`, `src/components/quorum/map/`, and `AppShell.tsx`. This is a real gap between the two assessments worth naming directly: the detector's `design-system-color` rule evidently doesn't catch hex literals sitting inside JS object literals (Mapbox `paint`/style-spec properties in `SquadMapInner.tsx`), only ones in className/CSS-facing syntax — and `styles.css` (where the `.q-map-pin-fair`/`.q-place-pin` hex values live) wasn't in this scan's target list. So the "zero findings" result is a real blind spot in the deterministic pass, not evidence the color drift above is a false alarm — Assessment A's source read is the more reliable signal here. No false positives to flag since there were no findings at all.

**Visual overlays**: unavailable this run — no browser automation tool is exposed in this session, so no live `[Human]`-tab overlay was attempted. This is a fallback-signal limitation of the environment, not a skipped step.

## Overall Impression

The chrome around Radar is disciplined and on-brand — inset glass pills, a shared chrome-inset system, restrained battery badges. But the map itself, the thing the screen exists to show, ships an entirely different, untokenized color language, and the screen's highest-stakes affordances (recovering from a failed map load, knowing if a friend's location is stale, confirming you got home safe) are the weakest parts of the experience. The single biggest opportunity: wire the signature pin/zone/route language into the actual design tokens and give live data a visible freshness signal — right now a pulsing ring means "this is live" whether the data is 30 seconds or 3 hours old, which is exactly backwards for a trust-and-safety surface.

## What's Working

1. **Low-battery badge restraint** (`SquadMapInner.tsx:342,355`; `.q-avatar-battery-low` at `styles.css:672-687`) — appears only when actually low, matching the convention used elsewhere (DirectChat, TeenWidget). Quiet, not gamified.
2. **Shared `--chrome-top`/`--chrome-bottom` inset system** (`styles.css:218-228`), consumed identically by `AppShell`'s header/tab bar, `RadarSheet` (`radar.tsx:368`), and the map's own control-positioning constants (`SquadMapInner.tsx:38-44`) — disciplined "Inset Chrome Rule" engineering; nothing drifts if the pill size changes.
3. **`cooperativeGestures: false`** (`SquadMapInner.tsx:174`), a deliberate, well-reasoned call: since Radar *is* the page (no scroll to protect), one-finger pan is correctly enabled, matching Apple/Google Maps convention instead of the generic-embed default of forcing two-finger pan friction.

## Priority Issues

**[P0] Signature pin/zone/route language isn't tokenized**
- **Why it matters**: This is the design system's own named "signature component," yet its colors bypass the token layer entirely and introduce four extra un-sanctioned hues (violet, sky, pink, cyan) into a system with an explicit "amber stays rare" rule. It's the single biggest gap between what DESIGN.md commits to and what ships.
- **Fix**: Route `haloFor()`, isochrone, zone, route, and place-pin colors through the existing CSS custom properties (`var(--success)`, `var(--warning)`, `var(--muted-foreground)`, `var(--primary)`, `var(--accent)`); replace the violet "fair midpoint" pin with Warm Ember or explicitly document why it's an exception.
- **Suggested command**: `/impeccable polish`

**[P1] Silent, unrecoverable failure on map load**
- **Why it matters**: `SquadMap.tsx:47` — `if (token.isError || !token.data) return null;` — a token-fetch failure renders nothing: no message, no retry. On a safety-weight screen, a blank map with zero explanation is a serious failure.
- **Fix**: Render an `Empty`/error state with a retry action, matching the pattern already used for the "no pins" case.
- **Suggested command**: `/impeccable harden`

**[P1] No staleness signal where it matters most**
- **Why it matters**: The presence pulse ring plays unconditionally regardless of `lastSeen` (`SquadMapInner.tsx:344`), and the tap-to-focus mini-card never surfaces `lastSeen`/`elapsed()` at all, despite `MapPerson.lastSeen` being populated and `elapsed()` already existing (`radar.tsx:85-91`). A worried parent or friend can't tell a 30-second-old ping from a 3-hour-old one.
- **Fix**: Dim or stop the pulse past a staleness threshold; add an "Xm ago" chip to the focus card.
- **Suggested command**: `/impeccable harden`

**[P2] No permission-denied state in the live-sharing flow**
- **Why it matters**: `currentPosition()` (`radar.tsx:99-108`) collapses every geolocation error into `null`; both the background auto-ping loop and "I arrived safely" proceed or fail silently. A guardian could believe a teen is "Sharing" (green Pill) while location access has actually been blocked for days.
- **Fix**: Surface a distinct permission-denied state with a CTA to fix it in device settings.
- **Suggested command**: `/impeccable harden`

**[P3] Highest-stakes action is buried; controls are icon-only with no explainer**
- **Why it matters**: "I arrived safely" requires expanding the collapsed `RadarSheet` and scrolling past two other sections (`radar.tsx:392-404`); the 5-icon map-dock (`SquadMapInner.tsx:457-479`) has no visible labels or onboarding.
- **Fix**: Consider a persistent, always-visible safety action; add first-run labels/tooltips to the control dock.
- **Suggested command**: `/impeccable clarify`

## Persona Red Flags

**Jordan (First-Timer)**: Lands on Radar with nobody sharing yet → the `Empty` state (`radar.tsx:328-333`) tells Jordan to "Turn on location sharing in Settings…" but `Empty` supports an `action` slot (`ui.tsx:182-190`) that isn't used here — instructional text with no button to actually get there. Jordan also has no way to learn what the five map-dock icons do without trial-and-error, and won't discover "I arrived safely" without first tapping the collapsed sheet.

**Casey (Distracted Mobile User)**: Two near-identical `glass-pill` bars stack at the bottom edge — `RadarSheet` (`radar.tsx:359`) directly above AppShell's own tab bar (`AppShell.tsx:288`) — a fast glance-and-tap could land on the wrong one. When Casey glances at a pulsing pin to check if a friend is close, nothing signals the data might be 40 minutes stale — exactly the failure mode a distracted user is most likely to be fooled by.

**Sam (Accessibility-Dependent)**: The Mapbox canvas has no accessible summary of on-screen content; the only non-visual entry point is "List view," which is one of five visually undifferentiated icon buttons in a horizontal dock (`SquadMapInner.tsx:472-478`) rather than a prioritized, first-class control — a screen-reader user has to correctly guess which of five unlabeled-on-screen buttons opens the list before accessing "where is everyone" at all. The loading `Skeleton` (`ui.tsx:192-194`, used at `radar.tsx:312`) has no `role="status"`/`aria-live`, so the load state is silent to assistive tech.

## Minor Observations

- "Remove from my map" (`FindMyFriends.tsx:411-418`) is destructive and fires immediately on click, with no confirm step.
- The whole screen force-scopes to `.dark` (`radar.tsx:310`) with no lighter/higher-contrast map option — defensible given the Mapbox style choice, but forecloses a low-vision user who specifically needs light/high-contrast over dark.
- Search only filters people/venues, not safe zones, despite zones being a rendered, tappable-adjacent map layer.

## Questions to Consider

1. If "Evergreen-ringed pins" is the signature language, why does `haloFor()` never reference `var(--primary)` at all — was the map's palette a deliberate, undocumented exception, or did the signature component simply never get wired to the tokens?
2. A pulsing ring is supposed to mean "this is live." With no staleness gating, is Radar currently telling a worried parent something is live when it might be nearly an hour old?
3. The single highest-stakes action on this screen — "I arrived safely" — requires expanding a collapsed sheet and scrolling past two other widgets. Should a safety action like that ever require discovery?
