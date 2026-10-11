# Syncly app and AI review

Reviewed October 10, 2026. Review of the current checkout, not other branches or the deployed site.

## Main recommendation

Make AI planning trustworthy end to end before adding more AI entry points. The most valuable expansion is a planner that checks the whole outing, explains what is verified, preserves revisions, and offers the smallest workable change when something stops fitting.

## Scope and validation

Mapped the route/component/library/test inventory and reviewed the core planning, recommendation, AI, itinerary, guardian, location-sharing, onboarding, chat, calendar, and offline paths. This is a broad review with deeper inspection of AI and planning, not a line-by-line audit of every file.

- TypeScript check passed.
- Vitest: 16 files, 102 tests passed, using `--configLoader runner`.
- Dependencies were temporarily borrowed from the existing main checkout. This is not a fresh installation verified against this checkout's lockfile.
- Impeccable detector: 88 advisory findings, zero primary findings. Advisories: 43 color, 39 font-size, 6 radius differences from the documented design system. These are review hints, not 88 verified bugs.
- Browser: inspected local landing page, demo, demo's no-feasible-options state, and sign-in boundary. Checked demo at 390 × 844. Signed-in pages redirected to authentication; their findings below come from source inspection.
- Live AI calls, real-device background location, database policies against a live database, load performance, and full keyboard/screen-reader behavior were not tested. No whole-app accessibility or performance certification is implied.
- Application behavior was not changed during this review.

## Fixes, in priority order

### 1. [P1] AI actions bypass the normal finalization and lifecycle checks

Evidence: `src/lib/quorum/ai.functions.ts:155`, compared with `src/lib/quorum/plan.functions.ts:863`.

Normal finalization calls `assertPlanOpen` and checks `recommendations.feasible`. `applyAiCompromise` checks ownership and that the recommendation belongs to the plan, then uses the admin client to finalize it. It does not check feasibility or whether the plan has ended. Concierge option selection uses this same endpoint (`src/components/quorum/ai/ConciergeSheet.tsx:84`).

Time changes update plan timestamps without regenerating the shortlist, clearing stale votes/selection, or checking private constraints again. They use server-local `setHours`, while the itinerary launcher explicitly handles the user's IANA timezone.

Fix: share one authoritative mutation path for manual and AI actions. Validate the proposed change, reject closed plans, check current feasibility, and recalculate affected recommendations and logistics before confirming. Validate HH:MM ranges and preserve the plan timezone.

Acceptance: AI cannot lock an infeasible or expired plan; a time change reruns every hard constraint and produces correct local times on a UTC server.

### 2. [P1] Recommendations can check a different time from the actual plan

Evidence: `src/lib/quorum/places.server.ts:456`, `src/lib/quorum/recommend.server.ts:105`.

Live venue seeds use fixed evening start/end times. Recommendation generation scores those seeds and checks opening hours and curfews against their times. The plan's window is used for the forecast, but is not applied to those options before scoring. A noon or late-night plan can therefore get checks based on an evening outing.

Fix: derive candidate timing from the actual plan window and timezone. Keep category default times for genuinely unscheduled drafts only.

Acceptance: changing a plan from noon to 9 PM changes hours, availability, curfew, and return-trip checks.

### 3. [P1] Multi-stop itineraries are not evaluated as complete outings

Evidence: `src/lib/quorum/itinerary.functions.ts:192`, `src/lib/quorum/recommend.server.ts:14`, `src/components/quorum/ItineraryCard.tsx:7`.

Launch persists the full itinerary and takes its category from the anchor stop. Recommendation generation does not consume the itinerary, and the itinerary card displays the original host picks. The later shortlist is independently discovered by category. There is no complete-itinerary constraint check or reconciliation of the chosen recommendation with the stored anchor stop.

Impact: dinner may fit while dinner plus bowling exceeds the total budget, return time, ride capacity, or dietary requirements. The displayed itinerary and finalized venue can disagree.

Fix: evaluate total cost, all stop windows, inter-stop travel, the trip home, dietary requirements at food stops, and transport as one candidate. Replacing an anchor must update the itinerary and rerun those checks.

Acceptance: an individually affordable pair of stops that exceeds the group budget is rejected; finalization updates the displayed itinerary.

### 4. [P1] Anonymous AI explanations still expose private constraint values

Evidence: `src/lib/quorum/compromise.server.ts:48`, `src/lib/quorum/ai.server.ts:220` and `:436`.

The AI receives the exact lowest private budget, tightest travel limit, dietary union, and earliest curfew. Prompts explicitly encourage mentioning exact group caps; deterministic explanations also include them. Removing names does not prevent inference in a small group, especially when someone knows their own answers.

Fix: generate explanations from approved public facts and coarse outcomes: within everyone's budget, needs an earlier finish, shorter return trip. Keep exact private caps and sensitive dietary answers inside deterministic validation. Avoid revealing why a particular person blocks a plan.

Acceptance: small-group explanation fixtures never include another member's exact private values, even when the user asks the assistant to reveal them.

### 5. [P1] Venue details invent reviewers, ratings, and venue highlights

Evidence: `src/lib/quorum/reviews.server.ts:20` and `:60`, `src/components/quorum/VenueDetailModal.tsx:116` and `:141`.

The model is asked to write three reviews with fictional author names and star ratings. The non-AI fallback also fabricates these. The UI does disclose sample/AI content below the cards, but the named reviewers and stars still suggest evidence. The Google link also claims “100+ reviews” without a source for that count.

Fix: remove fictional reviews and unsupported counts. Show verified provider details with attribution, actual user feedback when available, and clearly framed suggestions or questions to check when facts are missing. Do not manufacture menu items or parking/seating claims.

Acceptance: every displayed reviewer, rating, review count, and factual highlight has a real source; unknown facts remain unknown.

### 6. [P2] Both AI chats fail after ten completed exchanges

Evidence: `src/lib/quorum/schemas.ts:85`, `src/components/quorum/ai/AskSynclySheet.tsx:53`, `src/components/quorum/ai/ConciergeSheet.tsx:54`.

The validator accepts at most 20 history entries. Both clients submit their entire growing history. After ten question/answer pairs, the next exchange creates more than 20 entries and later requests fail validation. The server's eight-turn truncation happens after validation, so it cannot help.

Fix: bound history before submission and maintain a concise conversation summary if older context matters. Match the input length limit in the UI. Preserve failed questions with a retry control instead of removing them after clearing the input.

Acceptance: 30 exchanges remain usable; oversized input receives a clear, recoverable UI message.

### 7. [P2] Follow-up itinerary edits lose accumulated intent

Evidence: `src/components/quorum/ai/PlanBuilderSheet.tsx:264`.

Rebuild sends the original prompt plus only the latest change, rather than the current itinerary and all accepted changes. “Make it cheaper,” then “start an hour later” can lose the cheaper revision. Manual swaps and edits are also absent from the next rebuild request. Stops without venue options are silently filtered out on launch (`:273`).

Fix: revise the current structured draft, preserve unaffected choices, show a concise change preview, and explicitly resolve failed stops before launch. Add undo and draft restoration after refresh.

Acceptance: three successive edits retain prior changes; unresolved stops are visibly resolved or deliberately removed.

### 8. [P2] Weather backups and compromise fallbacks can be misleading

Evidence: `src/lib/quorum/compromise.server.ts:104`, `src/lib/quorum/ai.server.ts:295` and `:386`.

If no feasible indoor backup exists, Plan B falls back to an indoor option regardless of feasibility, then its explanation says the option still works. The compromise fallback selects the vote leader for budget conflicts without requiring that it is cheaper or feasible. Its time-shift heuristic can clamp to 3 PM and still fail a curfew, while the headline claims everyone clears it.

Fix: select remedies only from candidates that pass all deterministic checks. When none fit, say so and offer a new search or a private request to revise constraints. Let AI explain an already-validated remedy.

Acceptance: no fallback claims a blocked option works; every proposed timing remedy is rechecked.

### 9. [P2] Opening-hours checks ignore the outing's weekday

Evidence: `src/lib/quorum/hardfilter.ts:50`.

The helper extracts all time ranges from an opening-hours string without a date argument. A Monday range can make a Sunday visit appear valid. Unknown or unparseable hours can also pass without exposing uncertainty.

Fix: check date-specific opening hours, closures, and overnight windows. Distinguish verified open, likely open, unknown, and closed instead of collapsing them into one boolean.

Acceptance: a weekday-only venue is not marked verified open on Sunday; missing hours are visibly unverified.

### 10. [P2] AI latency, fallback status, and caching need an explicit contract

Evidence: `src/lib/ai-gateway.server.ts:211`, `src/lib/quorum/aiplus.server.ts:155`, `src/components/quorum/ai/GuardianAiSummary.tsx:33`, `src/components/quorum/ai/SquadDigest.tsx:28`.

Model/key failover can try many candidates sequentially. The call sites do not establish an explicit whole-request deadline or output budget. Closing the builder invalidates its client run counter but does not cancel the server work. Several surfaces return `aiGenerated` but do not display the distinction. Guardian and digest errors remove the card rather than exposing retry. Ten-minute browser cache freshness is not shared server-side caching; another device can repeat the same model work.

Fix: give each feature a total deadline, bounded generation, useful deterministic fallback, visible retry, and a consistent result envelope containing source/fallback state and generation time. Cache derived summaries by authorized data revision, not just elapsed time in one browser. Record latency and fallback rates alongside errors.

Acceptance: provider stalls cannot leave the interface pending indefinitely; unchanged data reuses a summary; changed approvals or answers invalidate it.

### 11. [P2] Long-term fairness and group memory are incomplete

Evidence: `src/lib/quorum/recommend.server.ts:39`, `src/lib/quorum/engine.ts:21`, `src/lib/quorum/memory.server.ts:66`.

The engine supports historical `sacrificeLoad`, but production recommendation construction does not supply it. Demo members do. Group memory stores `typical_travel_minutes` as a constant 25 instead of computing the selected recommendations' travel times. It also tallies all recent plans regardless of whether they happened.

Fix: compute private compromise history from actual completed outings, use it in ranking, and derive group memory from real outcomes. Keep individual history private; users should be able to inspect/reset the group's shared suggestions.

Acceptance: repeatedly compromising members get fairer future options without their individual constraint history becoming public.

### 12. [P2] Launches need retry-safe persistence

Evidence: `src/lib/quorum/itinerary.functions.ts:227`, `src/lib/quorum/planner.functions.ts:273`.

Plan creation and participant insertion are separate operations. If participant insertion fails after plan insertion, a partial plan remains, and retry can create a second plan.

Fix: create the plan and participants transactionally and use a launch idempotency key. Treat notification failure separately from successful creation.

Acceptance: network retries create exactly one complete plan.

## Most useful additions

These are proposed features, not claims that they already work.

| Priority | Addition | Concrete experience | Build on |
| --- | --- | --- | --- |
| First | Whole-night planner | “Dinner and bowling under $30, home by 10” produces an outing checked against every stop and the return trip. | Itinerary builder + deterministic engine |
| First | Minimal-change repair | Rain, a lost driver, or a new guardian condition produces two validated fixes with their time/cost changes and a confirmation button. | Conflict, weather, transport, guardian paths |
| Next | Stateful conversational editing | “Keep dinner, swap bowling for something cheaper” updates only the affected stop, with undo and a before/after preview. | Current structured itinerary |
| Next | Evidence on suggestions | Show venue source, estimated vs verified cost, hours confidence, and when weather/location was updated. | Places, forecast, venue-detail data |
| Next | Actionable squad digest | Each “waiting on you” item opens the exact questionnaire or ballot; propose a reminder that the user confirms before sending. | Existing digest + plan references |
| Later | Outcome-driven group memory | “Something different from last week” uses completed outings and opt-in feedback rather than repeatedly recommending the same category. | Group preferences + fairness history |
| Later | Private availability intersection | Let members share free/busy windows and suggest a shared slot without exposing event titles. | Existing private timing questionnaire |

## Other app improvements

- Preserve unfinished questionnaire and planner drafts across interruptions. Scope storage to the signed-in account, expire private drafts, and clear them on sign-out. Do not add authenticated data to the public service-worker cache.
- Give plan states one clear next action: answer privately, wait for responses, vote, review a repair, or view the finalized outing. Avoid competing AI prompts on each step.
- Make “Why this works” show validated outcomes and factual evidence; avoid opaque percentages that users could interpret as a probability of safety or success.
- On Radar, distinguish last known location from a current signal and set accurate expectations for background updates. Source includes elapsed-time labels, active-route polling, and expiry controls; real-device behavior still needs verification.
- Announce newly received AI answers as well as loading status for screen readers. `AiActivity` already has a live status region; chat responses do not have a corresponding announcement mechanism. Respect reduced motion in message/list entrances.
- Landing page: the animated sphere cluster overlapped the headline at the inspected narrow desktop-pane viewport. Keep the headline readable throughout the animation and check both light/dark modes before a visual change. The mobile demo's hierarchy and recovery state were clear.
- Review design-token advisories as patterns. Do not mechanically replace intentional map colors, data colors, or inherited library styles solely to silence the scanner.

## Implementation order

1. Shared plan mutation guards, actual-window scoring, full-itinerary validation, and privacy-safe explanations.
2. Honest venue evidence, validated backups, date-specific hours, and retry-safe creation.
3. Chat bounds/retry, structured iterative editing, draft persistence, and explicit AI deadlines/fallbacks.
4. Minimal-change repair, linked digest actions, and actual historical fairness/group memory.
5. Targeted authenticated mobile, keyboard, reduced-motion, and real-device location verification; finish with an Impeccable polish pass.

## Missing regression coverage to add during implementation

- Manual and AI actions enforce identical feasibility/lifecycle rules.
- Multi-stop total cost, closing hours, return time, and selected-anchor synchronization.
- Small-group privacy and requests to reveal another member's constraints.
- Long chats and malformed/oversized model outputs.
- Multiple consecutive draft edits preserve accepted changes.
- No-feasible-backup and stalled-provider cases.
- Concurrent/retried launches create one complete plan.

Existing tests passing is useful evidence, but does not cover these end-to-end contracts.
