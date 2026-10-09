# Mobile UX review — October 9, 2026

All changes remain uncommitted. The starting working tree was clean.

## Issues and changes

- Form actions could sit below long content. Added shared sticky actions to authentication, setup, questionnaires, settings and the demo; plan creation and AI/squad-creation sheets use separate footers.
- Narrow flex rows, long names and fixed QR dimensions could overflow. Fixed those component constraints rather than clipping the page.
- Keyboard, short-screen and safe-area handling differed across surfaces. Added visible-viewport tracking, consistent sheet bounds and navigation clearance.
- Some controls had small or overlapping targets. Enlarged time presets, sliders, reactions and response controls; added labels and selection state where missing.
- The hybrid-account header overflowed its tablet frame. Reused its existing overflow menu for the extra controls.
- Floating chat could collide with the questionnaire footer. It now measures the footer clearance and constrains the panel height.
- Venue thumbnails always requested a 1200px image. Added responsive sources; retained lazy loading and reserved media sizing.

## Validation

- Typecheck: passed.
- ESLint: passed.
- Vitest: 12 suites, 82 tests passed.
- Production build: passed. Existing dependency/directive and server-function deprecation warnings remain.
- `git diff --check`: passed.
- Browser matrix: 320×568, 360×740, 375×667, 390×844, 393×851, 414×896, 430×932, 844×390, 768×1024 and 1440×900.
- Rendered landing, sign-in, legal pages, demo walkthrough/playground and isolated shared components fit without horizontal page overflow at the checked sizes.
- Component fixtures exercised the real questionnaire, time controls, long names, QR tile, sheets, composer, app shell and floating chat. Tested step focus, footer/navigation clearance, menu dismissal and a same-width viewport reduction while a field was focused. Temporary fixtures were removed.

## Coverage and limitations

Reviewed authenticated routes and their shared forms/components in source. A valid signed-in backend session was unavailable: sign-in reported that it could not check the session. The app-shell fixture used local mock query data and did not perform account or plan writes.

Valid invite/approval tokens, account verification, live group/plan data, maps, location permissions, real iOS/Android keyboards, hardware safe-area behavior and throttled-network performance still need device/account QA. Invite and approval browser checks cover their public loading/error shells, not successful responses. This is not a claim that every authenticated interactive state has been verified live.

The existing brand, hero composition, typography, palette and animation direction were retained. No dependencies, backend rules, service worker behavior, commits or deployments were added.

## Modified source files

- [src/components/quorum/AddressPicker.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/AddressPicker.tsx) — Bound and scroll address suggestions.
- [src/components/quorum/AppShell.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/AppShell.tsx) — Safe-area chrome; collapse overflowing hybrid-account controls into the existing menu.
- [src/components/quorum/Avatar.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/Avatar.tsx) — Reserve image dimensions and decode asynchronously.
- [src/components/quorum/ChatDrawer.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/ChatDrawer.tsx) — Bound floating chat height and clear form actions and the keyboard.
- [src/components/quorum/ConstraintForm.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/ConstraintForm.tsx) — Reachable action footer, step focus, wrapping, selection semantics and touch targets.
- [src/components/quorum/CookieConsent.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/CookieConsent.tsx) — Keep the consent banner scrollable on short screens and above navigation.
- [src/components/quorum/CreateGroupModal.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/CreateGroupModal.tsx) — Keep squad creation in the sheet footer; constrain long preview names.
- [src/components/quorum/CreatePlanPanel.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/CreatePlanPanel.tsx) — Keep the expanded form action reachable.
- [src/components/quorum/GroupAppearance.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/GroupAppearance.tsx) — Keep Save look reachable.
- [src/components/quorum/GuardianShell.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/GuardianShell.tsx) — Wrap header controls and support keyboard/safe-area chrome.
- [src/components/quorum/LegalLayout.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/LegalLayout.tsx) — Wrap long addresses and legal content; respect lateral safe areas.
- [src/components/quorum/MobileActions.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/MobileActions.tsx) — Shared sticky actions; measure questionnaire clearance for floating controls.
- [src/components/quorum/Modal.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/Modal.tsx) — Bound sheet height, keep dismiss control visible and support a separate footer.
- [src/components/quorum/PlaceAutocomplete.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/PlaceAutocomplete.tsx) — Bound and scroll place suggestions.
- [src/components/quorum/PlanWizard.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/PlanWizard.tsx) — Separate the primary action from scrolling fields; reset scroll between steps.
- [src/components/quorum/QrCode.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/QrCode.tsx) — Scale the reserved square to the available width.
- [src/components/quorum/QuickResponse.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/QuickResponse.tsx) — Allow narrow response labels to fit; enlarge Edit vote.
- [src/components/quorum/SpotBrowser.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/SpotBrowser.tsx) — Fix flex input overflow and add responsive image sources.
- [src/components/quorum/TimePicker.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/TimePicker.tsx) — Enlarge presets and slider targets; label the custom input.
- [src/components/quorum/VenueDetailModal.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/VenueDetailModal.tsx) — Select appropriately sized venue images.
- [src/components/quorum/ai/ChatSheetShell.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/ai/ChatSheetShell.tsx) — Keep the AI composer outside scrolling history; wrap long replies.
- [src/components/quorum/ai/ConciergeSheet.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/ai/ConciergeSheet.tsx) — Clear questionnaire actions with the floating AI trigger.
- [src/components/quorum/auth/EmailSecondFactor.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/auth/EmailSecondFactor.tsx) — Keep verification action reachable.
- [src/components/quorum/auth/SecondFactor.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/auth/SecondFactor.tsx) — Keep verification action reachable.
- [src/components/quorum/chat/Composer.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/chat/Composer.tsx) — Permit the textarea to shrink and give Send its own full touch target.
- [src/components/quorum/chat/GroupInfoSheet.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/chat/GroupInfoSheet.tsx) — Bound the sheet and add a persistent close control.
- [src/components/quorum/chat/MessageBubble.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/chat/MessageBubble.tsx) — Wrap reaction menus and enlarge reaction chips.
- [src/components/quorum/demo/DemoWalkthrough.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/demo/DemoWalkthrough.tsx) — Keep progression accessible; reduce mobile spacing.
- [src/components/quorum/dm/ChatSheet.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/dm/ChatSheet.tsx) — Bound chat height to the visible viewport.
- [src/components/quorum/friend/FriendProfileSheet.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/friend/FriendProfileSheet.tsx) — Bound/scroll the drawer; retain close access during loading; add dialog semantics.
- [src/components/quorum/settings/shared.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/settings/shared.tsx) — Allow settings text to shrink without squeezing controls.
- [src/components/quorum/ui.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/components/quorum/ui.tsx) — Constrain shared cards, pills, buttons and fields.
- [src/lib/quorum/venuePhotos.ts](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/lib/quorum/venuePhotos.ts) — Provide 400/800/1200px responsive photo sources.
- [src/lib/use-mobile-viewport.ts](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/lib/use-mobile-viewport.ts) — Track visible viewport and keyboard clearance without React render churn.
- [src/routes/__root.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/routes/__root.tsx) — Mount viewport handling once.
- [src/routes/_authenticated/_app/groups.$groupId.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/routes/_authenticated/_app/groups.$groupId.tsx) — Allow stats and plan actions to wrap.
- [src/routes/_authenticated/_app/groups.index.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/routes/_authenticated/_app/groups.index.tsx) — Wrap long squad names.
- [src/routes/_authenticated/_app/settings.index.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/routes/_authenticated/_app/settings.index.tsx) — Keep preference saving accessible.
- [src/routes/_authenticated/_app/settings.planning.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/routes/_authenticated/_app/settings.planning.tsx) — Keep planning-default saving accessible.
- [src/routes/_authenticated/_app/settings.profile.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/routes/_authenticated/_app/settings.profile.tsx) — Keep profile saving accessible.
- [src/routes/_authenticated/guardian.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/routes/_authenticated/guardian.tsx) — Enlarge zone choices and existing telephone links.
- [src/routes/_authenticated/onboarding.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/routes/_authenticated/onboarding.tsx) — Compact mobile setup; sticky actions and step focus.
- [src/routes/approve.$token.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/routes/approve.$token.tsx) — Wrap approval detail rows and label/announce condition errors.
- [src/routes/auth.tsx](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/routes/auth.tsx) — Compact mobile spacing and keep the native form submit reachable.
- [src/styles.css](/Users/aaravmuthu/.codex/worktrees/1a66/syncly/src/styles.css) — Scoped action, sheet, keyboard, safe-area and floating-control rules; no global overflow clipping.
