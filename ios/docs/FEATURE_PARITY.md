# Native feature parity — October 10, 2026

This is an implementation and acceptance ledger, not a claim of perfect parity. The web sources remain authoritative. M0 screenshots describe the original shell. New screens are genuine SwiftUI controls; hosted happy-path acceptance is gated on backend rollout.

| Web capability | Native implementation | Current acceptance |
| --- | --- | --- |
| Password/signup/email OTP/Google/recovery | AuthView, PasswordRecoveryView, SDK Auth and Keychain | Routing and MFA fail-closed tests; hosted callbacks still require owner configuration |
| Email MFA, existing native factors | EmailFactorView, NativeFactorView, ExistingFactorsView | Validator/SDK-backed; real account enrollment/removal QA pending |
| Agreement, teen/guardian onboarding, consent | Native Forms and expiring optional choices | Terms version matches web; no optional tracking SDK loaded |
| Groups create/join/code/QR/invite/settings | GroupsView, GroupDetailView, GroupSettingsView, VisionKit QR scanner | Demo mutations; camera needs physical device; admin appearance permissions preserved |
| Group photos/member cards/contacts/nicknames | Safe upload, FriendProfileView, ContactsView | DTO-backed; hosted upload and aliases across all lists still need integration work |
| Plan wizard and private questionnaire | PlanWizardView, ConstraintFormView | Own answers only; sample mutation invalidates stale recommendations |
| Compatibility, hard constraints, ranking/fairness | PlanningEngine and PlanningHelpers | 120 exact TS scoring fixtures, 20 cost fixtures |
| Plan options/vote/finalize/cost/ICS/share | PlanDetailView, RecommendationView, CostView, CalendarDocument | Sample feasibility guard; real server writes gated |
| Availability and weather | AvailabilityView, PlanInsightsView | Aggregate-only availability, nullable weather; live forecast pending |
| Conflict flags/compromise/Plan B | ConflictView | Explanations and flags wired; AI apply and resolution-vote UI still pending |
| Fair-point planning/defaults | Backend registry includes existing aggregate wrappers | Native fair-point comparison and saved time/area prefill implemented; hosted aggregate acceptance pending |
| Multi-stop AI itinerary | ItineraryBuilderView, ItineraryEditorView, timeline/domain codec | TS parity fixtures and null-preserving encoding; live scout/launch pending |
| Spots/venue highlights/bookmarks | SpotsView, SpotDetailView | Safe map/directions and unverified generated-review wording; natural-language vibe ranking implemented; add-to-plan remains withheld pending safety checks |
| Cross-group assistant/plan concierge/digest | SyncAssistantView, PlanInsightsView | Weekly digest and proposed-plan review implemented; safe vote/finalize/nudge confirmations implemented; unsafe time changes withheld |
| Squad chat/replies/photos/read state | ChatView, safe image upload, Realtime | Demo text/reply behavior; live signed uploads and realtime integration pending |
| Direct chat/contacts/reactions/voice | InboxView, ContactsView, VoiceRecorder, AV playback | Native recording bounded to 120 seconds and stopped in background; real mic/upload QA pending |
| DM location/venue/telemetry | One-shot LocationSession and received location maps | Explicit one-shot DM location send and received maps implemented; latest shared map, timestamp/status/battery and read receipts implemented; hosted acceptance pending |
| Activity | ActivityView | Native notification/group feed picker, linked plan/group navigation, unread status, per-item and bulk mark-read actions; hosted acceptance pending |
| Radar, sharing/ghost, arrived/delay/SOS | MapKit, foreground LocationSession, native Forms, hold confirmation | Demo never requests location; device/share lifecycle QA pending; no background collection |
| Profile/planning/account/delete/export | SettingsView and native Forms | Profile/planning forms, private home map selection/clear, JSON file export and typed hold-to-delete implemented; hosted acceptance pending |
| Family tier/trial/cancel | FamilyPlusView | No purchases; six-month sample trial with cancellation retaining period access and no reuse; live server quotas preserved |
| Guardian link approval/unlink | GuardianLinksView, FamilyHubView | Teen-response and revocation regression tests |
| Guardian approval/check-ins/delay/ride/contact | TeenDetailView, GuardianApprovalView, CheckinsView, RideDetailsView | Per-plan sample approvals, requests/check-ins, ride details and delays; fresh hub reload; private contacts returned only by server |
| Safe zones | SafeZoneView with native map crosshair | Real quota/ownership in existing server; live geofence events pending |
| Parent links/Universal Links/legal | ShareLink + existing Safari capability page, AASA/entitlement | Owner must host AASA and supply Team ID; no core WebView |
| APNs | PushRegistration and delegate plumbing | Native registration route/provisioning/device verification not implemented |
| iPad/VoiceOver/Dynamic Type/icon/performance | Native lists, adaptive tab/sidebar, system typography, theme | Opaque 1024 px source-derived brand icon installed; dark screenshots inspected; full accessibility/iPad acceptance pending |

## Deployment and security gates

- `SYNCLY_LIVE_DATA_ENABLED = NO`. Do not enable protected data merely because screens compile.
- Deploy privacy migration and native API separately on `feat/ios-api`, verify hosted RLS/MFA, reconcile school/grad-year privacy language, and exercise real cross-account tests.
- Existing web `addSpotToPlan` assigns `feasible: true` to a supplied spot; `castResolutionVote` does not independently check feasibility. These need a backend hard-constraint review before native UI exposes those mutation paths. `addSpotToPlan`, `castResolutionVote`, and `applyAiCompromise` are excluded from the native API registry. No client may fetch peer constraints to work around it.
- Background/disappear always stop local location collection. Server revocation is best effort; a disconnected device cannot guarantee that a cloud flag changed. Surface that failure and retain explicit stop retry.
- APNs delivery, real guardian alerts, provider AI and venue data are not proven by demo. No billing exists.

## Native acceptance evidence

Dark captures inspected for all five main tabs, family hub, teen details and guardian links. Sample screenshots describe offline data and do not establish hosted integration or real-device safety delivery. Release iOS 27 simulator build passed with Swift 6 strict concurrency and warnings treated as errors. Debug acceptance passed: 30 Swift Testing functions across 3 suites and 1 full XCTest UI flow. The UI flow creates a group and plan, submits private answers, generates/votes/finalizes the selected venue, unlinks and approves a teen-controlled guardian link, saves a guardian condition, requests a check-in, and replies as the teen. The keyboard focus regression and stale mutation displays found during acceptance were corrected. Backend transport/profile/MFA tests: 56 passed; TypeScript passed. These are local checks, not hosted cross-account acceptance.

Largest Dynamic Type captures for guardian approval and teen check-ins were inspected: text wraps within the native scrollable forms. The iPhone text size was restored afterward. An iPad mini first-boot setup stalled before the app could be inspected, so no iPad acceptance is claimed. Full VoiceOver, iPad and physical-device acceptance remain pending. Fractional server timestamps are now tested and used by native date labels and calendar exports.
