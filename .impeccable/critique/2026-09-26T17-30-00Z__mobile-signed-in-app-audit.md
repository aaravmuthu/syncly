# Mobile audit: signed-in app screens (2026-09-26)

Ran against **production** (syncly.website, which deploys from `main`), not the local
working tree. Local WIP in `home.tsx`, `plans.$planId.tsx`, `SpotBrowser.tsx` and others
may already cover some items. Re-check them against localhost before fixing.

Method: each route loaded in a same-origin iframe at 375 / 390 / 428px. A DOM script
measured horizontal overflow, interactive elements under 44px, text under 12px and
inputs under 16px. Screenshots were taken at 390px.

Screens: /home, /plans, /plans/:id, /groups, /groups/:id, /messages, /activity,
/radar, /settings, /settings/profile, /settings/account, /settings/planning,
/settings/info.

## Fixed in this session (uncommitted)

- **Glass nav pills have no blur in Chrome/Android.** `.glass-pill` in
  `src/styles.css` declared both `backdrop-filter` and `-webkit-backdrop-filter`
  with a `var()` value. lightningcss then drops the unprefixed one in the minified build,
  so only Safari blurs. Prod computed `backdrop-filter: none`, so page text shows
  through the top and bottom nav (e.g. "Syncly" over "Weekly update for test").
  Fix: removed the hand-written `-webkit-` lines. The minifier adds them itself.
  Verified that `bun run build` output now has both declarations.

## Already fixed locally, not shipped

- **/settings/planning:** the address suggestion list opens on page load and
  covers the ZIP field's label. `AddressPicker.tsx` WIP (`typed` ref) stops it.

## Open

1. **Plan detail (/plans/:id) floating buttons.** "Ask AI" (bottom-left) and
   "Squad Chat" (bottom-right) sit just above the bottom nav. Together they cover
   about 190px of the 801px viewport, and Squad Chat overlaps the address and search
   rows. The page is also 10,369px tall at 390px.
2. **Inputs under 16px (iOS zooms the page on focus).** All are 14px: home and radar
   "Search squad or venues", messages "Search people, handles or circles",
   plan "Describe the vibe you want" and "Search local spots", and the planning
   curfew text input.
3. **Tap targets under 44px:**
   - home: "Change response" (100×16), "Full radar" (70×16), weekday buttons
     42×65 at 375px
   - activity: filter chips All / Action Needed / Locked In / Groups (30 tall),
     "Vote now" / "Quick re-vote" (32 tall)
   - plan detail: vibe and category chips (30 tall), Browse / Saved (28),
     "Add optional details" (16 tall), "New member" (16), "Save this spot"
     (45×16), "Directions in Maps" / "Photos" (32)
   - settings: Appearance / Preferences triggers (30 tall), profile and account
     toggles (36×20)
   - planning: curfew preset chips (30 tall), "Use my current location" (16 tall)
   - groups: "Launch Plan" (43)
   - every screen: the header "Syncly" logo link (98×24)
4. **Text under 12px (all 11px).** Home weekday labels, "Sharing", "2m ago",
   member count; groups stat labels ("Ongoing", "completed"); groups/:id
   "Conflict" badge; messages timestamps and unread badges; plan detail
   review counts and category headers ("Food & dining", "Sports & activities");
   planning curfew time axis (12 AM / Noon / 6 PM / 11:45 PM).
5. **Home "Active right now" row** truncates the status line
   ("Conflict reported • Hos…"), so the reason is cut off at 390px.

## Clean

- No horizontal overflow on any screen at 375, 390 or 428px.
- /messages, /settings, /settings/profile and /settings/info have no layout problems.

## Test artifacts (not app bugs)

- /plans showed dim cards, and /home and /radar sometimes rendered blank or grey. The
  test tab reported `visibilityState: hidden`, so Chrome paused rAF-driven
  entrance animations and map tiles mid-way.
