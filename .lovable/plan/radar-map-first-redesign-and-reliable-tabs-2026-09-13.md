# Radar map-first redesign and reliable tabs

## Goal
Make Radar a true full-screen map with reachable frosted controls, and eliminate tab snap-back by making the URL the only active-tab state.

## Confirmed navigation cause
- The tab bar currently derives selection from both the router URL and a separate `optimisticTab` state.
- Pointer-down changes `optimisticTab` before TanStack Link commits the route, immediately swapping persistent screens and Radar-specific shell layout.
- Pointer-up cleanup can clear that state before or during the later click/navigation commit, revealing the old URL-backed tab again.
- A second six-second cleanup also resets the optimistic state independently of routing.
- This shared `AppShell` race affects every tab pair; Radar load only makes the timing easier to notice.

## Implementation
- Remove `optimisticTab`, its timeout, and pointer-up/click race handlers.
- Start touch navigation directly on primary pointer-down through TanStack Router, update history once, and suppress the duplicate click. Keep ordinary Link activation for keyboard and desktop accessibility.
- Derive the selected and visible tab only from the current route. Keep the short duplicate-tap lock and haptic feedback without maintaining a second active state.
- Add temporary development-only tab tracing around pointer-down, click suppression, router location commits, and visible-tab events; use it to verify event order, then remove it before completion.
- Keep visited tab screens mounted exactly as today, with Radar resize/resume events triggered only after the route commits.
- Make Radar’s map layer fill the viewport beneath all chrome, remove page-space reservation, and present the mobile header and tab bar as inset floating glass surfaces rather than opaque edge-to-edge bars.
- Reduce Radar’s mobile header to the wordmark plus one overflow menu containing theme, AI, activity, settings, profile, and context actions; preserve the existing full desktop header.
- Move Radar search into the lower half and place the map controls in a compact lower-right thumb zone, while keeping clear of the Live Radar sheet and bottom tabs.
- Strengthen the existing map glass so map detail remains visibly present through every Radar overlay, including the status pill and controls.

## Verification
- Run focused type checks and inspect current diagnostics.
- Use an automated mobile-width navigation harness to exercise all 20 directed tab-to-tab pairs and assert the URL and selected tab agree after each switch.
- Repeat from fresh loads and with a 30+ second pause before switching.
- Verify Radar at mobile and desktop widths: map fills the viewport, no page scroll, overlays do not reserve space, controls remain reachable and non-overlapping, and reopening Radar preserves its map instance/state.
