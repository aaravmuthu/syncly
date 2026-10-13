# Syncly bug review and fixes

Reviewed October 12, 2026. The checkout was updated from `d2cc7fb` to the latest fetched `origin/main`, `f5288ef0ee4efdce64dea7bd9498a7d025e86c64`. A final fetch confirmed that main had not advanced. This report accompanies the review fixes; deployment is a separate step.

## Scope

Repository inventory, application graph extraction, targeted source review, the full existing test suite, new regression tests, TypeScript, ESLint, and production compilation. Source review covered authentication/MFA boundaries, private planning constraints, plan mutations, guardian approvals, ownership, location sharing, friend profiles, messaging, MCP tools, calendar/PWA helpers, address lookup, and the newly merged landing-page journey.

This is a broad local review, not a proof that every path is bug-free. Graph extraction does not mean every source line received manual review.

## Fixes

| Area | Verified defect | Result |
| --- | --- | --- |
| Location privacy | Automatic DM status cards included coordinates for every existing conversation, without checking location consent. | Cards go only to authorized active location viewers or linked guardians. Expired/hidden shares and Ghost Mode block friend delivery. |
| Location privacy | Old friend pins remained visible after the global sharing switch was turned off. | Pin reads now require current streaming consent as well as a valid share. |
| Friend profiles | Profile telemetry bypassed Ghost Mode, and either direction of a guardian relationship granted location access. | Friend reads use the same consent predicate as pins. Guardian safety access applies only from the guardian to their linked teen. |
| Direct database reads | The active-share policy queried a shares table with no user-role read policy, so legitimate friends could not receive their shared telemetry. | A narrowly scoped definer predicate checks the caller's own active share, global consent, hiding, expiry, and timed/indefinite pauses without exposing private rows. |
| Sharing deadlines | End-of-day and tomorrow-at-6AM promises used the server's calendar. | Every client sends a validated IANA timezone. Calendar deadlines follow that zone; elapsed-hour choices remain elapsed hours. |
| Ownership | Transferring to yourself could demote the only owner; transfer/departure writes could partially succeed and ignore failures. | Ownership and departure now run in one service-only database transaction, reject self-transfer and unauthorized targets, and roll back together on failure. |
| Transportation | Fractional seat capacities could pass feasibility even though real ride assignments could not seat everyone. | New input requires whole seats; scoring and assignment conservatively floor legacy fractional values. |
| Parent conditions | Any number in a free-text condition could be treated as a curfew. | Only recognizable home/return/curfew phrases or standalone time values become deadlines. Malformed times are not interpreted as clocks; unrelated quantities do not invent schedule failures. This does not automatically validate arbitrary non-time rules. |
| Approval privacy | Expired bearer links still returned child and plan details. | Reads reject expired/invalid expiration values before loading logistics; decisions use the same strict expiration boundary. |
| Approval integrity | Prior decisions survived changes to the reviewed venue, timing, itinerary, or other displayed plan facts. | A database trigger returns decisions to pending when those facts change. Guardian ownership of a request and existing private conditions are preserved. |
| Address lookup | A delayed ZIP/geolocation result could overwrite more recent typing, selection, or parent-provided values. | Request revisions discard superseded callbacks and invalidate work at unmount. |
| MCP configuration | MCP did not recognize the deployed `SB_*` project bindings used by the app. | MCP accepts the same server/browser URL and publishable-key aliases while forwarding the verified user token. |
| MCP planning | Tool-created plans used categories outside the app's planning vocabulary and omitted the persisted timezone. | Canonical categories are supported, old category names map to compatible values, and timezone/instant/title validation is applied. |
| Latest landing page | Approving an example and then changing the venue left the replacement marked approved. | Preview approval resets when the reviewed plan facts change. The original scenario was reproduced and the fix verified in the browser. |
| Latest landing page | Orb cleanup used a mutable current control; pointer leave/cancel could leave an idle orb displaced. | Cleanup restores the control that performed the handoff, and pointer reset events wake the renderer. |

## Validation

- 214 tests passed across 29 files, including 80 additional regression cases.
- TypeScript and the production build passed against the latest checkout plus fixes.
- ESLint reported no errors. Eight existing Fast Refresh warnings remain in `ReceiptPrinter.tsx`.
- Database tests execute SQL in isolated PGlite fixtures and include rollback, authorization, direct-read consent, and approval invalidation cases. They do not validate the deployed Supabase configuration or every historical migration together.
- Browser verification reproduced the stale preview approval, checked the correction, exercised keyboard chapter navigation, tested the mobile sharing preview, and checked a 390px mobile viewport and a 1024×600 short-window fallback for horizontal overflow and inert content. No actual location was requested or shared.
- Earlier browser checks exercised public landing/demo navigation and deterministic invitation/private-answer/filtering interactions. Signed-in user data was not modified.
- `git diff --check` passed.

## Deployment dependencies and limits

Apply the three new migrations before deploying the corresponding application changes:

1. `supabase/migrations/20261012020000_atomic_group_membership.sql`
2. `supabase/migrations/20261012030000_shared_location_visibility.sql`
3. `supabase/migrations/20261012040000_invalidate_changed_plan_approvals.sql`

No migrations were applied to a live database, and no application was deployed. Existing damaged production records were not inspected or repaired. Live RLS checks require a separately configured test database; `psql` is unavailable here. Real account/OAuth/email flows, concurrent multi-request planning operations, provider integrations, and physical-device location/push/install behavior remain unverified.

Graphify was rebuilt for the current application code and project documents. Bundled agent skills, historical audits, decorative assets, and secrets are outside that graph scope. `graphify-out/GRAPH_REPORT.md` and `GRAPH_HEALTH.txt` record extractor integrity warnings; the graph is an incomplete navigation aid, not evidence of zero bugs. Semantic extraction token usage was unavailable and is marked accordingly.
