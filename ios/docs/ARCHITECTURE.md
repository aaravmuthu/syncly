# Syncly native iOS architecture

Source baseline: origin/main `bbef9eb12836b59fce0f29ed03b8c84524719826`, reviewed October 10, 2026. Native branch: `feat/ios-app`; separate backend prerequisite: `feat/ios-api`, commit `13cff21`.

## Scope and current state

Build a native SwiftUI iOS 27 app using the installed Swift 6.4 / Xcode 27 toolchain. Swift language mode is 6 (Xcode's SWIFT_VERSION value is 6.0, not a toolchain version). No WKWebView for core screens. User explicitly removed the marketing landing page and decorative sphere hero; the brand tagline belongs in native onboarding. M0 contains a themed offline shell, working appearance preferences, public-only configuration, privacy manifest, shared Xcode scheme and Swift Testing foundation coverage. Group/plan/radar/message tab content is a placeholder, not a working live feature. M1–M7 remain pending.

## Screen inventory

SwiftUI names below are planned except RootView, HomeView, FoundationView and AppearanceSettingsView, which exist in M0. No internal route is accidentally promoted to a native feature.

| Web source | Route | Native mapping | Milestone |
| --- | --- | --- | --- |
| `src/routes/[.]lovable.oauth.consent.tsx` | `/.lovable/oauth/consent` | Excluded internal/browser infrastructure | Skip |
| `src/routes/[.mcp]/invoke-tool/$tool.ts` | `/.mcp/invoke-tool/$tool` | Excluded internal/browser infrastructure | Skip |
| `src/routes/[.mcp]/list-tools.ts` | `/.mcp/list-tools` | Excluded internal/browser infrastructure | Skip |
| `src/routes/[.well-known]/oauth-protected-resource.ts` | `/.well-known/oauth-protected-resource` | Excluded internal/browser infrastructure | Skip |
| `src/routes/__root.tsx` | root document | App lifecycle / privacy preferences; HTML metadata omitted | M0/M1 |
| `src/routes/_authenticated/_app/activity.tsx` | `/_authenticated/_app/activity` | ActivityView | M4 |
| `src/routes/_authenticated/_app/groups.$groupId.tsx` | `/_authenticated/_app/groups/$groupId` | GroupDetailView + GroupSettingsSheet + GroupAppearanceSheet | M2 |
| `src/routes/_authenticated/_app/groups.index.tsx` | `/_authenticated/_app/groups/` | GroupsView | M2 |
| `src/routes/_authenticated/_app/home.tsx` | `/_authenticated/_app/home` | HomeView + week/digest/live-plan sections | M0 shell; M2–M4 data |
| `src/routes/_authenticated/_app/messages.tsx` | `/_authenticated/_app/messages` | MessagesView + SquadChatView + DirectChatView | M4 |
| `src/routes/_authenticated/_app/plans.$planId.tsx` | `/_authenticated/_app/plans/$planId` | PlanDetailView + ConstraintForm + PlanWizard + FinalizedPlanHub | M2–M3 |
| `src/routes/_authenticated/_app/plans.index.tsx` | `/_authenticated/_app/plans/` | PlansView | M2 |
| `src/routes/_authenticated/_app/radar.tsx` | `/_authenticated/_app/radar` | RadarView (MapKit) + SharingSheet | M5 |
| `src/routes/_authenticated/_app/rls-check.tsx` | `/_authenticated/_app/rls-check` | Excluded internal/browser infrastructure | Skip |
| `src/routes/_authenticated/_app/route.tsx` | `/_authenticated/_app` | RootView: TabView + one NavigationStack per tab | M0 |
| `src/routes/_authenticated/_app/settings.account.tsx` | `/_authenticated/_app/settings/account` | AccountSettingsView + SecurityView | M1/M5 |
| `src/routes/_authenticated/_app/settings.index.tsx` | `/_authenticated/_app/settings/` | SettingsView; appearance subview works in M0 | M0 appearance; M5 |
| `src/routes/_authenticated/_app/settings.info.tsx` | `/_authenticated/_app/settings/info` | AboutView | M6 |
| `src/routes/_authenticated/_app/settings.planning.tsx` | `/_authenticated/_app/settings/planning` | PlanningSettingsView | M5 |
| `src/routes/_authenticated/_app/settings.profile.tsx` | `/_authenticated/_app/settings/profile` | ProfileSettingsView | M5 |
| `src/routes/_authenticated/agreement.tsx` | `/_authenticated/agreement` | AgreementView | M1 |
| `src/routes/_authenticated/family-plus.tsx` | `/_authenticated/family-plus` | FamilyPlanView (trial, no payment collection) | M6 |
| `src/routes/_authenticated/guardian.tsx` | `/_authenticated/guardian` | GuardianHubView + context switcher | M6 |
| `src/routes/_authenticated/onboarding.tsx` | `/_authenticated/onboarding` | OnboardingView | M1 |
| `src/routes/_authenticated/route.tsx` | `/_authenticated` | AuthCoordinator + agreement/onboarding/context gates | M1 |
| `src/routes/accessibility.tsx` | `/accessibility` | LegalView or Safari sheet | M6 |
| `src/routes/approve.$token.tsx` | `/approve/$token` | ApprovalLinkView; signed planId.sig and opaque token are different capabilities | M6 |
| `src/routes/auth-callback.tsx` | `/auth-callback` | AuthCoordinator callback, no webpage | M1 |
| `src/routes/auth.tsx` | `/auth` | AuthView / EmailOTPView / EmailMFAView | M1 |
| `src/routes/demo.tsx` | `/demo` | DemoPlanningView | M1–M3 |
| `src/routes/index.tsx` | `/` | Native onboarding intro; web marketing omitted | M1 |
| `src/routes/join.$code.tsx` | `/join/$code` | DeepLinkCoordinator + JoinGroupSheet, defer until auth/onboarding | M2/M6 |
| `src/routes/mcp.ts` | `/mcp` | Excluded internal/browser infrastructure | Skip |
| `src/routes/privacy.tsx` | `/privacy` | LegalView or Safari sheet | M6 |
| `src/routes/sitemap[.]xml.ts` | `/sitemap.xml` | Excluded internal/browser infrastructure | Skip |
| `src/routes/subprocessors.tsx` | `/subprocessors` | ServiceProvidersView or Safari sheet | M6 |
| `src/routes/terms.tsx` | `/terms` | LegalView or Safari sheet | M6 |

## Feature-specific behavior to preserve

- Home: week/day selection, needs-answer/vote/live/upcoming/memory categorization, pending invite continuation, distinct empty/error states, guardian-vs-squad context choice. Cache verification only as UX; server checks every protected operation.
- Groups: permanent/temporary filters, create/join, 12-character CSPRNG invite codes (legacy 4–12 accepted after normalization), QR/share sheet, roster, host transfer before owner departure, appearance controls. Do not copy older six-character helper text as a validator.
- Plans: draft → collecting → recommending → voting → finalized → completed; expired non-final live plans become cancelled, drafts stay drafts. Grace is strictly more than four hours after end or start fallback. Lifecycle sweeping is server-owned; a local clock cannot authorize state writes.
- Questionnaires: dinner/event/trip/general; multi-step fields, skip preserving entered values with `skipped=true`, hard limits, hourly availability 11:00–22:00, accessible focus after step changes. Only own constraint payload may be loaded or saved.
- Scheduling: deterministic scoring ranks universal feasibility first, score second, fairness tie-breaker. Budget tests use costMin; neutral preference 0.72; groupFit=0.55 average+0.45 minimum; headline weights 0.62 groupFit+0.28 fairness+0.10 transport. Non-feasible score penalty/floor follows engine.ts, max 99. Transport seats default 3; drivers outside travel limits contribute no seats. Port exactly, including existing edge cases.
- Availability: longest consecutive run at peak free count; earliest run wins ties; empty/zero returns nil. Return counts only, never respondent identity or raw answers.
- Fair-point: spherical midpoint, local Haversine helpers, travel estimates and opening-hour checks can be pure ports. Loading other people's home bases, curfews, private answers and sacrifice loads stays server-only. Per-member drive estimates are existing shareable output; never return home coordinates or named private constraint failures.
- Itinerary: version 1, one to four stops, at most three options per stop, selected pick with first-option fallback, anchor stop controls plan category; starts are wall clocks in supplied IANA zone, stored plan times are instants. Swap re-times subsequent stops; short (<0.3mi) hops take two minutes.
- Auth: email/password, Google and email-code sign-in/recovery. Phone sign-up remains hidden. Existing native MFA factors must never be bypassed; email MFA is independent of AAL2 and email OTP cannot satisfy both factors. Requires-password status routes back to password/Google. Fail closed on status/RPC failure.
- Terms: current version comes from LEGAL; agreement timestamp/version is stored in trusted auth app_metadata, independently of optional analytics choices.
- Guardian: pairing code expires in one hour, consumed once; teen approves a request before linking. Account type does not itself establish a guardian relationship. A link-based plan approval must keep `decided_via=link` and cannot impersonate a linked guardian. Family trial is six months with no billing; preserve shared-family limits, safe zones, check-ins, consent and contact-sharing restrictions.
- Radar: start only after an explicit opt-in and When In Use permission. Stop publisher immediately on stop/sign-out/background permission revocation; mirror expiry/ghost/per-peer consent. Backend denies pings when sharing is off. Never use saved home coordinates as live location.
- Chat: group + DM, replies/reactions/location/venue/voice, unread system announcements count until viewed, own messages do not. Realtime is RLS-gated. Native image re-encode strips metadata and caps edge at 2048; image ≤5MiB, voice ≤8MiB; magic-byte types PNG/JPEG/GIF/WebP and MP4/WebM. Use authenticated server upload validation and sender-owned signed avatars-bucket paths for chat/voice attachments.
- Feedback: inline control-associated errors, cancellable loading labels, no red toast layer. Native confirmation for SOS/account deletion and an accessible alternative to hold gestures. SwiftUI sensoryFeedback is preferred where equivalent; UIKit haptic bridge only if needed. No automatic location/calendar/microphone/photo-library prompts at startup.

## Data models and storage boundaries

Use nonisolated Sendable Codable structs/enums for domain/network values, Decimal for money and Date for instants; explicit snake_case coding keys for rows. Keep private profile/constraint DTOs distinct from roster DTOs. Never decode a peer profile as a full private profile.

| Domain family | Source/table | Access strategy |
| --- | --- | --- |
| OwnProfile, RosterProfile, ProfilePatch | profiles; schemas.profilePatch | Caller-only my_profile RPC after backend prerequisite; roster explicit safe fields; initialization/profile normalization through API getMe/saveProfile |
| Group, GroupKind, Membership, MemberRole | groups, group_members | RLS reads/admin look updates; group creation/member insert is multi-row workflow; API for invite join, ownership/leave/delete and notifications |
| Plan, PlanStatus, Participant | plans, plan_participants | RLS-visible reads and permitted draft creation/self response; host-only direct editable fields; server owns status/selected recommendation/compatibility score |
| ConstraintPayload | plan_constraints | RLS self-only payload; no peer fetch, including for hosts. API submit preserves side effects/aggregate regeneration |
| OptionSeed, Recommendation, ScoreBreakdown, Vote | recommendations, votes | RLS reads/self votes; server computes recommendations using private group inputs and performs finalize/approval checks |
| TransportAssignment, TransportProfile | transport_assignments, transport_profiles | Visible assignments and permitted driver edits; private transport_profiles lacks client policies; allocation/vehicle departure side effects via API |
| AvailabilityCell, CostEstimate, GeoPoint, FairPoint, Forecast | pure helpers and aggregate DTOs | Pure ports for demo/own/group-visible data; private member aggregation and provider calls via API |
| ItineraryDraft, ItineraryStop, ItineraryVenue, Itinerary | plans.itinerary (20261011000000) | Server AI draft/scout/launch, local timeline/cost display |
| GroupMessage, DirectThread, DirectMessage, Reaction, ReadReceipt | group_messages, direct_threads, direct_messages, direct_reactions, direct_reads, message_reads | RLS + Realtime; upload/owned media validation + server-generated announcements through API |
| ActivityEvent, Notification | activity_events, notifications | RLS list and own read markers; creation/dispatch through server |
| GuardianLink, LinkRequest, Alert, CheckinRequest, SafeZone, GeofenceEvent, DelayPing | guardian_links, guardian_link_requests, guardian_alerts, checkin_requests, safe_zones, geofence_events, delay_pings | UI-specific safe DTOs behind server relationship/limit checks; direct client access is not blanket permission |
| LocationPing, LocationShare, SharingState, FriendPin | location_pings, location_shares | Sharing/expiry/ghost/permission-aware API; some tables intentionally have zero RLS policies; do not work around those |
| ContactNickname, SavedPlace, GroupMemory | contact_nicknames, saved_places, group_preferences | Nicknames server-only, saved_places self RLS, memory group aggregate reads; no raw private preference export |
| MyFamilyPlan, FamilyLimits | family_plans + family-plan.ts | Server-only trial/limits and shared guardian entitlement; no StoreKit/purchases |
| ConsentPreferences, AccountSecurityStatus | cookie-consent.ts; MFA security tables | Local optional choices default off, versioned 180-day expiry; MFA status via first-factor-safe API; never direct access to privileged security tables |
| AI quota/usage/event records | ai_quota_events, ai_usage_events, ai_events; migrations are authoritative | Internal backend accounting, never fetched as private raw prompts by native clients |

## RLS and backend prerequisite

All 32 committed SQL migrations were inventoried in chronological order; generated types are secondary to SQL. Some migrations refer to helper triggers/app_private schema supplied by the hosted baseline, so a full clean-database rollout needs its own reconciliation. Targeted privacy regression tests apply the actual relevant migrations with a dummy Supabase baseline, not a hosted database.

Original profiles_select_group_member exposed entire co-member rows. The separately pushed prerequisite revokes both table/column SELECT (including PUBLIC) and grants the member-card projection (id, display_name, avatar_emoji, avatar_url, bio, school, grad_year); my_profile() derives identity from JWT and checks MFA. Existing own-profile and guardian workflows use checked trusted server reads. Deployment is unverified: **live native access must wait for that migration in staging/production**. Native M0 is offline.

plan_constraints SELECT remains self-only. recommendations writes, parent-approval mutations, plan lifecycle and selected recommendation are privileged. 20260928000100 moves plan updates to host-only and protects lifecycle columns. 20261009010000 adds restrictive native/email MFA gates to protected public/storage tables. New tables added later need their own MFA enforcement; audit these during endpoint implementation rather than assuming the earlier loop includes future tables.

## Native structure and dependency injection

- App/: SwiftUI App, @Observable main-actor AppState, tab/navigation ownership; environment injects container.
- Core/: Config, Theme, analytics policy exist now. Keychain/auth client/networking/haptics arrive in M1. No auth tokens in UserDefaults; its current sole persistent value is appearance.
- Domain/: pure nonisolated value models and tested TS ports in M2–M3. Group private aggregation remains remote; offline/demo ports only use explicitly supplied allowed inputs.
- Services/: Sendable protocols + actor live and deterministic mock implementations per network-backed feature, introduced as features land. No network-backed service is wired in M0. Later Supabase dependency is via pinned SPM; no pods or heavy packages.
- Features/: feature View + @Observable ViewModel; UI/: reusable native controls. RootView/sidebarAdaptable adapts navigation for iPad; content constrained to 640pt and uses Dynamic Type without fixed text heights.
- Tests/: Swift Testing for domain/config/service behavior, XCTest only if later UI automation needs it. No global mutable service singleton beyond the app-owned container; no force unwraps in app source.

All build configurations enable Swift 6, complete strict concurrency and main-actor-by-default with approachable concurrency. Pure types explicitly opt out of actor isolation. Async services use actors, and views perform sync state changes before awaiting IO.

## Design and privacy choices

Asset color sets convert exact light/dark OKLCH tokens from src/styles.css to sRGB using OKLab matrices plus sRGB transfer and gamut clipping. Theme centralizes names. Warm paper by day, near-black layers by night, evergreen primary, amber accent. SF system text/display is used; Bricolage Grotesque and Gloock are not bundled, so no unverified font license enters the binary. Native bars/sheets receive system material automatically; flat content cards stay readable. App icon from supplied brand asset is an M7 task (must flatten alpha losslessly). Launch background uses the Background asset now.

M0 has no decorative animation, so Reduce Motion receives no app-created motion. Built-in SwiftUI navigation respects system settings. Labels/SF Symbols and 44pt settings hit area are in place; VoiceOver/Dynamic Type/iPad full pass is M7. ATS explicitly disallows arbitrary loads; release HTTPS only. No optional telemetry, collection SDKs or network access in M0. Privacy manifest declares only own-app UserDefaults reason CA92.1; revise declarations honestly as auth/chat/location features arrive.

## Domain regression plan

Mirror planning-regressions.test.ts (hard dietary block; returned compatibility; venue hard gates; walkable expense excludes car line; calendar overnight/date-only/Unicode folding), plan-expiry.test.ts (Chicago CDT/CST/DST, strict >4h grace, no-time plans), plan-write-guards.test.ts (stale lifecycle can't authorize writes), chat-unread.test.ts (system vs own vs read arrivals), cookie-consent.test.ts (expired/malformed/future/versioned choices), file sniff/upload cases, engine/default/tie/seat/fairness cases and itinerary timeline. New Swift fixtures should use identical input/output values; server guards stay backend tests, not local authorization substitutes.

## Updated feature checklist

- [x] M0: shared Xcode project/scheme, native shell, system tabs/navigation, adaptive width, light/dark token catalog, working appearance setting, public-only xcconfig, explicit bundle configuration, HTTPS validation, privacy manifest, foundation tests.
- [x] M0: architecture/backend contract draft reviewed; Debug tests and Release build pass with zero warnings; twelve iPhone screenshots inspected; README documents CI commands. Milestone commit includes only ios/.
- [ ] M1: native auth/Google/OTP/email-MFA, Keychain session, agreement/onboarding, consent, full mock demo, inline DynamicButton/HoldToConfirm components.
- [ ] M2: real groups/plans with safe RLS, create/join/QR, own constraints, exact pure engine and fixtures.
- [ ] M3: wizard/conflicts/compromise, venues/MapKit, itinerary/finalize, receipt and review behavior.
- [ ] M4: group/DM chat, Realtime/attachments/unread, Activity.
- [ ] M5: opt-in Radar, profile/account/planning settings and deletion.
- [ ] M6: Family/Guardian, public approval capabilities, Universal Links/AASA, APNs plumbing, legal.
- [ ] M7: full accessibility/VoiceOver/iPad/landscape/offline/error/performance pass, opaque app icon, final privacy audit, complete feature tests.

## Source inventory

SOURCE_INVENTORY.json records the baseline source file paths/hashes/line counts and screen/server-operation extraction; it is an inventory, not a substitute for review. Detailed feature-specific UI behavior must be rechecked against its source as each milestone is implemented. OPEN_QUESTIONS.md tracks mismatches; never silently guess or imply placeholders complete features.

## M0 acceptance evidence — October 10, 2026

Debug simulator build and serial Swift Testing run passed: seven test functions, thirteen parameterized invocations. Release simulator build also passed. Compiler logs contain zero warnings/errors. Installed and launched on iPhone 18 Pro; visually inspected Home, Groups, Plans, Radar, Messages and Settings in both appearances. Captures are in screenshots/m0-*.png. Settings persistence is covered by a test; full assistive-technology/iPad interaction testing remains M7. Backend privacy regression passed 38 cases on dummy local fixtures, with separate TypeScript validation; no hosted migration or API is deployed. M0 finishes here; M1 is not started.
