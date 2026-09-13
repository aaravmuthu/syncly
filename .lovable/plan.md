# Snappy persistent tab navigation

## Goal
Make Home, Groups, Radar, Plans, and Chats react instantly to touch/click while preserving the existing colors, spacing, icons, and layout.

## Implementation
- Add a navigation controller inside the persistent app shell so the selected tab updates on pointer-down, before route data finishes loading.
- Use one shared transform-only indicator for mobile and desktop, with sub-200ms ease-out motion and instant icon color/scale feedback.
- Add a short navigation lock that ignores duplicate or rapid taps while allowing a different destination to replace the pending target cleanly.
- Preserve each top-level tab screen after its first visit in a persistent tab host; hide inactive screens without unmounting them so scroll position, local state, and the Radar map instance survive tab switches.
- Keep detail pages such as a specific group or plan in the normal router outlet so their current behavior is unchanged.
- Add touch-start scale feedback and light haptics on mobile, plus transform/opacity-only hover and keyboard-focus feedback on desktop.
- Respect reduced-motion preferences by removing travel while retaining immediate state changes.

## Technical notes
- Keep TanStack Router links and URLs authoritative for history, deep links, and accessibility.
- Avoid route-wrapper transforms so fixed overlays remain viewport-relative.
- Reuse the existing preloading and design tokens; no visual redesign or data-model changes.
- Verify direct URLs, browser back/forward, rapid taps, mobile/desktop navigation, Radar state retention, and the current build diagnostics.
