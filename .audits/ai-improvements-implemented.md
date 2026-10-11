# Implemented AI and planning improvements

This is the first implementation pass following the October 10 app review.

## Changes

- AI and manual finalization share lifecycle, feasibility, current-answer, route, curfew, and hours checks.
- New service-only PostgreSQL actions lock selections and replace rides atomically. Retime actions clear old votes, options, and rides, and reject competing window edits.
- Plans save an IANA timezone. Older scheduled plans require one host refresh to establish their timezone rather than guessing it.
- Recommendations use the scheduled window. Complete itineraries check all stops, total estimated cost, inter-stop travel, food requirements, transport capacity, and the trip home.
- Selecting an itinerary option updates the displayed anchor and full outing duration.
- Venue facts are checked against live provider results at launch and when adding a spot. Browser-supplied prices or dietary claims do not become authoritative.
- Manually added spots go through the same deterministic engine; browser clients cannot insert their own feasibility flags.
- Opening-hours checks account for weekdays and overnight windows. Unknown hours remain estimates; unsupported formats cannot be treated as verified open.
- Exact private caps, curfews, and dietary answers are omitted from group AI explanation prompts and deterministic fallback explanations.
- Weather backups no longer fall back to blocked options. Compromise actions are selected from checked candidates; the model explains the proposal instead of inventing its timing.
- AI chat requests have bounded history and input length. Failed questions stay visible with retry, and assistant responses are announced accessibly.
- Planner revisions receive the current accepted itinerary, preserve unaffected venue picks, and retain the previous draft if AI is unavailable. Unresolved stops must be removed explicitly or given a venue before launch.
- AI generation has request deadlines, bounded output, and no automatic SDK retries layered on top of provider failover.
- Fabricated reviews, ratings, review counts, and synthetic venue addresses were removed from live planning. Illustrative photos are labeled.
- Guardian/digest summaries show retry states and distinguish basic summaries; message and summary entrances respect reduced motion.
- Group-memory travel estimates are computed from completed outings instead of a constant.

## Deployment prerequisite

Apply `supabase/migrations/20261012010000_checked_plan_actions.sql` before deploying this code. It adds the plan timezone, service-only action functions, timing-change guards, and server-only recommendation inserts. It has been exercised on an isolated PostgreSQL instance; it has not been applied to the hosted database.

## Validation

TypeScript, ESLint on changed source files, all 134 tests across 19 test files, and the production build passed. Browser inspection used an isolated temporary fixture for actual chat and venue components, including mobile chat retry; the fixture was removed afterward. Dependencies were borrowed from the existing installation, with build caches kept local to this checkout.

Hosted AI/provider calls, a fresh lockfile install, live database policies, full authenticated user journeys, and real-device background location were not exercised.

## Remaining roadmap

Draft restoration and undo, transaction/idempotency handling for plan creation, proactive minimal-change repairs, linked digest actions, historical compromise weighting, and private free/busy scheduling remain separate work. The full product/design audit remains in `app-ai-review-2026-10-10.md`; it records the pre-change findings.
