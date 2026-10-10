# Versioned native API gap — M0 contract draft

## Deployment status and transport

No endpoint below exists on origin/main. feat/ios-api currently contains only the tested profile-column privacy prerequisite; it has not deployed that migration. Implement these public routes on that branch, separate from native commits. The app’s configured base is `https://syncly.website/api/ios/v1`. M0 is offline and does not call it.

All operation routes use POST and `Content-Type: application/json`, including reads, to avoid putting private input in query strings. Endpoint: `/api/ios/v1/operations/<exportedFunctionName>`. Request body is exactly the existing function's validated data object, without the TanStack `{data: ...}` invocation wrapper. Empty input is `{}`. Response is `{ "data": <the existing function's JSON result> }`. Existing camelCase DTO keys and database snake_case keys remain unchanged; dates are ISO strings, absent optionals may be omitted, explicit null stays null. Do not serialize Infinity; family tier and finite/free-limit DTOs are authoritative instead of shipping the raw PLUS_LIMITS constant.

`Authorization: Bearer <Supabase access token>` is required. Derive user ID, signed session ID and auth method claims from the verified token, never from a body field. Use a user-scoped Supabase client for RLS and the existing has_required_mfa check before privileged work. Preserve each handler's relationship/host checks and quota/upload validations. Email status/challenge verification uses the existing first-factor-safe middleware; disabling an enabled factor requires the existing protected-session check. Server secrets never enter a native response.

Do not call generated TanStack createServerFn URLs from Swift. Extract/reuse checked business logic with an explicit trusted context, validate with the same zod validators, and expose ordinary versioned TanStack API route handlers. Do not accept a native-provided context/admin user ID. API implementation must preserve the handler's return type, verified by endpoint regression fixtures before Swift clients adopt it.

### Error JSON

```json
{"error":{"code":"validation_failed","message":"Enter a valid value.","field":"payload.maxSpend"},"requestId":"opaque-request-id"}
```

Use HTTP 401 for expired/missing session, 403 for authorization/MFA, 404 for inaccessible/missing resources, 409 for current-state conflict, 410 for expired capability, 422 for validated input errors, 429 for quotas/cooldowns, 503 for unavailable provider/configuration. Retry/cooldown error may include `retryAfterSeconds`. Never include SQL, credentials, another member's constraint value, hidden identity or private failing condition in a message. Swift presents errors inline at the relevant control; it must not turn failures into empty success arrays. Reads can retry; destructive/AI/launch writes require idempotency before automatic retries. Idempotency storage is itself a backend TODO, not an invented existing capability.

## Concrete JSON examples and response bindings

The examples use dummy IDs and representative successful results, not real user records. Complete canonical request validation is linked in the operation index. For responses containing full row arrays or nested DTOs, use the named existing TS type/return as the precise payload binding; do not invent a second schema with fewer checks. A backend implementation must snapshot representative responses and export JSON schemas/OpenAPI before native live decoding is enabled.

| Endpoint suffix | Request JSON | Response JSON example / payload binding | Existing implementation |
| --- | --- | --- | --- |
| getEmailSecurity | `{}` | `{"data":{"enabled":true,"verified":false,"requiresPassword":false}}` | email-mfa.functions.ts / emailSecurityStatus |
| sendEmailSecondFactor | `{"purpose":"verify"}` | `{"data":{"challengeId":"20000000-0000-4000-8000-000000000001","destination":"te…@example.com"}}` | sendEmailChallenge |
| verifyEmailSecondFactor | `{"purpose":"verify","challengeId":"20000000-0000-4000-8000-000000000001","code":"123456"}` | `{"data":{"verified":true}}`; failed verification retains existing optional message | verifyEmailChallenge |
| getMe | `{}` | `{"data":OwnProfileWithHasLinkedTeens}` (full caller profile only) | plan.functions.ts:getMe |
| saveProfile | `{"display_name":"Alex","theme_preference":"system"}` | `{"data":OwnProfileRow}`; allowed fields exactly schemas.profilePatch | plan.functions.ts:saveProfile |
| acceptTerms | `{"accepted":true}` | `{"data":{"ok":true}}` | account.functions.ts |
| deleteAccount | `{}` | `{"data":{"ok":true}}` | plan.functions.ts / prepare_account_deletion + account-storage.server.ts + Auth admin delete |
| exportAccountData | `{}` | `{"data":{"version":1,"exportedAt":"2026-10-10T20:00:00Z","profile":OwnProfileRow,"records":OwnedRecords,"scope":"..."}}` | account.functions.ts / account-data.server.ts |
| joinGroup | `{"code":"ABCDEFGHJKLM"}` | `{"data":GroupRow}`; code errors inline | plan.functions.ts:joinGroup (server lookup/insert/notification) |
| createGroup | `{"name":"Weekend crew","kind":"permanent","emoji":"🌿"}` | `{"data":GroupRow}`; preserve creator membership and activity | plan.functions.ts:createGroup |
| createPlan | `{"groupId":"10000000-0000-4000-8000-000000000001","title":"Friday dinner","category":"dinner","windowStart":"2026-10-17T23:30:00Z","participantIds":[]}` | `{"data":PlanRow}`; preserve profile identity, members and notification side effects | plan.functions.ts:createPlan |
| submitConstraints | `{"planId":"10000000-0000-4000-8000-000000000001","payload":{"maxSpend":25,"availability":["18:00"],"dietary":["vegetarian"]}}` | `{"data":{"ok":true}}`; never returns other members' payloads | plan.functions.ts:submitConstraints / recommend.server.ts |
| generateRecommendations | `{"planId":"10000000-0000-4000-8000-000000000001","shuffle":0}` | `{"data":Awaited<regenerateRecommendations>}` — ranked group-safe recommendation result | plan.functions.ts / recommend.server.ts, engine.ts, fairpoint.server.ts |
| finalizePlan | `{"planId":"10000000-0000-4000-8000-000000000001","recommendationId":"10000000-0000-4000-8000-000000000002"}` | `{"data":{"ok":true}}`; preserve actual handler fields and feasibility/approval checks | plan.functions.ts:finalizePlan |
| getAvailabilityHeatmap | `{"planId":"10000000-0000-4000-8000-000000000001"}` | `{"data":{"cells":[{"slot":"18:00","free":2,"total":3}],"answered":2,"total":3}}` (actual result has all 12 slots) | insight.functions.ts |
| castResolutionVote | `{"planId":"10000000-0000-4000-8000-000000000001","recommendationId":"10000000-0000-4000-8000-000000000002"}` | `{"data":{"ok":true,"locked":false,"votes":1,"needed":2}}` | conflict.functions.ts:castResolutionVote |
| getPlanDefaults | `{"groupId":"10000000-0000-4000-8000-000000000001"}` | `{"data":PlanDefaults}`; own defaults + public member pins + aggregate fairPoint | planner.functions.ts |
| previewFairPointVenues | `{"groupId":"10000000-0000-4000-8000-000000000001","category":"dinner","radiusMiles":10}` | `{"data":{"origin":null,"venues":[]}}` or origin + FairVenue[] | planner.functions.ts / fairpoint.server.ts / places.server.ts |
| launchAiPlan | `{"groupId":"10000000-0000-4000-8000-000000000001","prompt":"Dinner Friday","timeZone":"America/Chicago"}` | `{"data":{"planId":"10000000-0000-4000-8000-000000000002","title":"Friday dinner","category":"dinner","date":"2026-10-16","startTime":"18:30","endTime":"21:00","costPerPerson":25,"areaLabel":null,"optionCount":0,"inviteCode":"ABCDEFGHJKLM"}}` | planner.functions.ts |
| startItinerary | `{"prompt":"Dinner then bowling","groupId":null,"timeZone":"America/Chicago"}` | `{"data":{"draft":ItineraryDraft,"origin":null,"fairCount":0}}` | itinerary.functions.ts / draftItinerary |
| scoutItineraryStop | `{"kind":"bowling","near":{"lat":40,"lon":-90},"radiusMiles":8,"exclude":[]}` | `{"data":ItineraryVenue[]}`; up to 3 venues | itinerary.functions.ts / Geoapify |
| itineraryForecast | `{"lat":40,"lon":-90,"date":"2026-10-16"}` | `{"data":{"emoji":"☀️","line":"Clear · 75°/60° · 0% rain","outdoorRisk":false}}` or `{"data":null}` | itinerary.functions.ts / weather.server.ts |
| launchItinerary | `{"groupId":"10000000-0000-4000-8000-000000000001","timeZone":"America/Chicago","itinerary":Itinerary}` | `{"data":{"planId":"10000000-0000-4000-8000-000000000002","title":"Friday out"}}` | itinerary.functions.ts; itinerarySchema is the exact request model |
| getAiCompromise / getCompromiseSummaries / getPlanBSuggestion | `{"planId":"10000000-0000-4000-8000-000000000001"}` | `{"data":CompromisePlanResult}` / summary result / PlanBSuggestion respectively | ai.functions.ts / compromise.server.ts / conflict.server.ts |
| askPlanConcierge | `{"planId":"10000000-0000-4000-8000-000000000001","question":"Where should we start?","history":[]}` | `{"data":ConciergeAnswer}` | aiplus.functions.ts |
| suggestPlaces | `{"query":"Main Street","addressOnly":true,"proximity":null}` | `{"data":PlaceSuggestion[]}` | location.functions.ts / places.server.ts |
| geocodeZip / reverseZip | `{"zip":"75034"}` / `{"lat":40,"lon":-90}` | `{"data":ZipLocationOrNull}` / `{"data":"75034"}` or null | location.functions.ts / location.server.ts |
| getVenueInsight | `{"name":"Fixture Cafe","kind":"food"}` | `{"data":VenueInsight}`; explicitly label AI-generated reviews | reviews.functions.ts / reviews.server.ts |
| uploadAvatar / uploadChatImage / uploadGroupImage | `{"dataUrl":"data:image/png;base64,<validated-bytes>","ext":"png"}` | original signed URL response: avatar returns `{"data":{"avatar_url":"https://<project>/storage/v1/object/sign/..."}}`; other upload result fields follow their handler | plan/chat/group.functions.ts / upload-safety.server.ts |
| uploadVoiceNote | `{"dataUrl":"data:audio/mp4;base64,<validated-bytes>"}` | `{"data":Awaited<uploadVoiceNote>}` signed sender-owned voice result | dm.functions.ts / upload-safety.server.ts |
| pushLocation | `{"lat":40,"lon":-90,"accuracyM":10,"planId":null}` | `{"data":{"ok":false,"reason":"sharing_off"}}` when disabled; successful result preserves recordPing output | guardian.functions.ts / guardian.server.ts |
| shareLocationWith / stopSharingWith | `{"viewerProfileId":"10000000-0000-4000-8000-000000000002","mode":"hour"}` / same identity without mode | `{"data":{"ok":true}}` | sharing.functions.ts / sharing.server.ts |
| setGhostMode | `{"choice":"until_reenabled"}` | original sharing-state result, not permission bypass | sharing.functions.ts / sharing.server.ts |
| linkTeen | `{"code":"123456"}` | `{"data":{"teenName":"Alex","status":"pending"}}` (never treat pending as linked) | guardian.functions.ts / guardian.server.ts |
| answerLinkRequest | `{"requestId":"10000000-0000-4000-8000-000000000001","approve":true}` | original respondToLinkRequest result and permission side effects | guardian.functions.ts / guardian.server.ts |
| getGuardianHub / getMyRadar | `{}` | `{"data":GuardianDashboard}` / own radar DTO, only authorized teen/private own data | guardian.functions.ts / guardian.server.ts |
| decidePlanApproval | `{"approvalId":"10000000-0000-4000-8000-000000000001","decision":"approved"}` | `{"data":Awaited<decideApproval>}`; preserve decided_via guardian vs link distinction | guardian.functions.ts / guardian.server.ts |
| raiseSos | `{"lat":null,"lon":null,"note":"Need help"}` | `{"data":{"ok":true}}` if handler succeeds; never claim emergency services contacted | guardian.functions.ts / guardian.server.ts |
| getMyFamilyPlan / startFamilyPlus / cancelFamilyPlus | `{}` / `{"interval":"month"}` / `{}` | `{"data":MyFamilyPlan}` or exact mutation result; six-month trial, no payment request | family-plan.functions.ts / family-plan.server.ts |

Type names inside example cells are JSON payload placeholders, not literal wire strings. Their exact current fields/nullability are defined by the linked source type/handler. The operation index below is exhaustive for native-relevant server wrappers; exporting fully expanded response JSON schemas and checking them against fixtures is an API implementation acceptance item. Do not claim those endpoints implemented merely because this document exists.

## Public approval capabilities

The web supports parents without an account. Preserve this through separate capability routes rather than weakening the JWT operation dispatcher:

- POST `/api/ios/v1/capabilities/approval/view`, body `{"token":"opaque-token","timeZone":"America/Chicago"}`, response `{ "data": Awaited<getApproval> }` or null; reuse approval.functions.ts:getApproval.
- POST `/api/ios/v1/capabilities/approval/respond`, body `{"token":"opaque-token","decision":"approved_with_condition","condition":"Home by 10 PM"}`, response `{ "data": Awaited<respondToApproval> }`; enforce expiry, single response and decided_via=link exactly as web.
- POST `/api/ios/v1/capabilities/summary/view`, body `{"planId":"10000000-0000-4000-8000-000000000001","sig":"verified-signature","timeZone":"America/Chicago"}`, response `{ "data": Awaited<getParentSummary> }`.
- POST `/api/ios/v1/capabilities/summary/respond`, same signed identity plus decision/note, response `{ "data": Awaited<parentRespondToPlan> }`.

These routes authenticate a narrowly scoped capability instead of a Supabase JWT. They must not accept arbitrary plan IDs without a valid signature, return unrelated group/private answers, or turn a link answer into a linked guardian's approval. This exception needs explicit contract review before M6; Safari on the existing public HTTPS page is the safe fallback. Capability tokens must not be logged or stored in analytics.

## APNs and lifecycle gaps with no existing web equivalent

- POST `/api/ios/v1/push/register`: JWT body `{"token":"APNs-hex-token","environment":"sandbox","bundleId":"website.syncly.app"}`, response `{"data":{"ok":true}}`. Verify bundle/environment/token format and bind only to signed caller; backend token table, invalid-token cleanup, APNs key/provider implementation are missing.
- POST `/api/ios/v1/push/unregister`: JWT body `{"token":"APNs-hex-token"}`, response `{"data":{"ok":true}}`; revoke only caller-owned registration, call on sign-out.
- Web push.ts uses browser push and is not APNs. Do not promise delivery from registration plumbing. notify.server.ts is the eventual dispatch integration point.
- Lifecycle sweeping remains existing plan-lifecycle.server.ts; invoke through API reads/worker, never let the native user elevate themselves to update arbitrary expired plans.

## Direct Supabase operations and pure ports

RLS-safe reads: explicit roster projection, groups/members/plans/participants/recommendations/votes/visible transport assignments, own constraints, own notifications, group activity/memory, permitted chat/thread/read rows, own saved_places. Realtime uses the same JWT gates. Direct writes only where policy and triggers permit them: own constraint upsert, own response/vote/read markers, permitted draft/host editable fields, own safe saved places. Workflows involving private aggregation, joining by code, owner transfer, upload verification, messages with signed attachments, plan state/finalization, notifying guardians or quota/provider calls use the operation API so web side effects stay equivalent.

Full profile RPC `my_profile()` is a separate PostgREST endpoint `/rest/v1/rpc/my_profile` with `{}` input, returning `[OwnProfileRow]`; send apikey = publishable key and Authorization = user's token. Deploy the privacy prerequisite first. getMe API additionally creates/normalizes the profile and computes hasLinkedTeens; do not substitute my_profile when those behaviors are required. Never query profiles SELECT * as authenticated, even for the own row. No raw peer constraint query or client-side reconstruction of private group inputs.

Port pure availability/cost/engine/hardfilter/time/calendar/Haversine/midpoint/itinerary math with TS fixtures. A pure Swift engine only receives demo/self/explicitly shareable inputs; having a local engine does not authorize fetching everyone else's constraints.

## Swift implementation plan

M1 introduces AuthService with live Supabase SPM + Keychain storage and a mock; APIService actor uses URLSession, validated HTTPS config, Codable endpoint-specific DTOs, safe error mapping, cancellation and current-session Bearer injection. Feature protocols (GroupService, PlanService, ChatService, LocationService, AIService, GuardianService) each get deterministic actor mocks, including expired/MFA/offline/provider-failure cases. Preview/demo DI never creates a live client. M0 deliberately contains no live request path or pretended auth success. No UserDefaults session serialization, service-role key, internal TanStack URL, optional telemetry SDK or token logging.

Internal RLS self-check and the web demo coach are excluded from the native API. Native demo coaching uses local mock data; it must not send requests to the optional web demo endpoint. Mapbox browser-token delivery is also excluded because native maps use MapKit.

## Exhaustive existing wrapper index

For every row: request JSON is the object accepted by the exact input validator at the referenced function; response JSON is `{ "data": Awaited<ReturnType<typeof namedFunction>> }`. This source-bound type contract is preserved by the API route rather than guessing undocumented fields. Each endpoint must get expanded input/output schema fixtures before its native implementation is considered live-complete. Pure RLS reads listed here may instead be implemented by the native Supabase service as described above; server-only workflows cannot.

| Endpoint suffix (POST operations/) | Source and validation/return binding | Boundary |
| --- | --- | --- |
| `getEmailSecurity` | `src/lib/email-mfa.functions.ts:6`; existing validator + serialized named return | First-factor-safe JWT; operation-specific enrollment/disable gates |
| `sendEmailSecondFactor` | `src/lib/email-mfa.functions.ts:12`; existing validator + serialized named return | First-factor-safe JWT; operation-specific enrollment/disable gates |
| `verifyEmailSecondFactor` | `src/lib/email-mfa.functions.ts:19`; existing validator + serialized named return | First-factor-safe JWT; operation-specific enrollment/disable gates |
| `acceptTerms` | `src/lib/quorum/account.functions.ts:7`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `exportAccountData` | `src/lib/quorum/account.functions.ts:22`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `magicPlanDraft` | `src/lib/quorum/ai.functions.ts:28`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getCompromiseSummaries` | `src/lib/quorum/ai.functions.ts:82`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getPlanBSuggestion` | `src/lib/quorum/ai.functions.ts:106`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getAiCompromise` | `src/lib/quorum/ai.functions.ts:130`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `applyAiCompromise` | `src/lib/quorum/ai.functions.ts:155`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `askPlanConcierge` | `src/lib/quorum/aiplus.functions.ts:61`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getSquadDigest` | `src/lib/quorum/aiplus.functions.ts:149`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `vibeSearchSpots` | `src/lib/quorum/aiplus.functions.ts:268`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getGuardianAiSummary` | `src/lib/quorum/aiplus.functions.ts:370`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `askSyncly` | `src/lib/quorum/aiplus.functions.ts:464`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getApproval` | `src/lib/quorum/approval.functions.ts:20`; existing validator + serialized named return | Use capability route above, excluded from blanket dispatcher |
| `respondToApproval` | `src/lib/quorum/approval.functions.ts:77`; existing validator + serialized named return | Use capability route above, excluded from blanket dispatcher |
| `getParentSummary` | `src/lib/quorum/approval.functions.ts:213`; existing validator + serialized named return | Use capability route above, excluded from blanket dispatcher |
| `parentRespondToPlan` | `src/lib/quorum/approval.functions.ts:405`; existing validator + serialized named return | Use capability route above, excluded from blanket dispatcher |
| `listMessages` | `src/lib/quorum/chat.functions.ts:7`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `sendMessage` | `src/lib/quorum/chat.functions.ts:52`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `markRead` | `src/lib/quorum/chat.functions.ts:88`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `uploadChatImage` | `src/lib/quorum/chat.functions.ts:105`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `postRideUpdate` | `src/lib/quorum/chat.functions.ts:127`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getPlanConflicts` | `src/lib/quorum/conflict.functions.ts:16`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `flagConflict` | `src/lib/quorum/conflict.functions.ts:51`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `runConflictSweep` | `src/lib/quorum/conflict.functions.ts:122`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `castResolutionVote` | `src/lib/quorum/conflict.functions.ts:138`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `confirmAttendance` | `src/lib/quorum/conflict.functions.ts:206`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `openThread` | `src/lib/quorum/dm.functions.ts:9`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `listInbox` | `src/lib/quorum/dm.functions.ts:38`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getThread` | `src/lib/quorum/dm.functions.ts:157`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `sendDirect` | `src/lib/quorum/dm.functions.ts:241`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `markThreadRead` | `src/lib/quorum/dm.functions.ts:288`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `toggleReaction` | `src/lib/quorum/dm.functions.ts:306`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `listContacts` | `src/lib/quorum/dm.functions.ts:337`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `uploadVoiceNote` | `src/lib/quorum/dm.functions.ts:389`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getMyFamilyPlan` | `src/lib/quorum/family-plan.functions.ts:6`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `startFamilyPlus` | `src/lib/quorum/family-plan.functions.ts:14`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `cancelFamilyPlus` | `src/lib/quorum/family-plan.functions.ts:23`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getFriendProfile` | `src/lib/quorum/friend.functions.ts:8`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getNicknames` | `src/lib/quorum/friend.functions.ts:17`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `setNickname` | `src/lib/quorum/friend.functions.ts:25`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `setContactGhost` | `src/lib/quorum/friend.functions.ts:34`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `requestLocation` | `src/lib/quorum/friend.functions.ts:43`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `leaveGroup` | `src/lib/quorum/group.functions.ts:7`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `transferGroupOwnership` | `src/lib/quorum/group.functions.ts:64`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `deleteGroup` | `src/lib/quorum/group.functions.ts:112`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `updateGroupLook` | `src/lib/quorum/group.functions.ts:137`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `uploadGroupImage` | `src/lib/quorum/group.functions.ts:172`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getMySyncCode` | `src/lib/quorum/guardian.functions.ts:8`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `linkTeen` | `src/lib/quorum/guardian.functions.ts:16`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getMyLinkRequests` | `src/lib/quorum/guardian.functions.ts:25`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `answerLinkRequest` | `src/lib/quorum/guardian.functions.ts:33`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `unlinkGuardian` | `src/lib/quorum/guardian.functions.ts:42`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getMyGuardians` | `src/lib/quorum/guardian.functions.ts:73`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getGuardianHub` | `src/lib/quorum/guardian.functions.ts:87`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `setLocationSharing` | `src/lib/quorum/guardian.functions.ts:97`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `pushLocation` | `src/lib/quorum/guardian.functions.ts:110`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `addSafeZone` | `src/lib/quorum/guardian.functions.ts:162`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `removeSafeZone` | `src/lib/quorum/guardian.functions.ts:194`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `decidePlanApproval` | `src/lib/quorum/guardian.functions.ts:203`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `askForCheckin` | `src/lib/quorum/guardian.functions.ts:218`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `respondToCheckin` | `src/lib/quorum/guardian.functions.ts:227`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getMyCheckins` | `src/lib/quorum/guardian.functions.ts:238`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `sendDelay` | `src/lib/quorum/guardian.functions.ts:252`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `raiseSos` | `src/lib/quorum/guardian.functions.ts:261`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `markRideLeaving` | `src/lib/quorum/guardian.functions.ts:284`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `saveVehicleDetails` | `src/lib/quorum/guardian.functions.ts:293`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `markAlertsRead` | `src/lib/quorum/guardian.functions.ts:318`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getMyRadar` | `src/lib/quorum/guardian.functions.ts:332`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `arrivedSafely` | `src/lib/quorum/guardian.functions.ts:392`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getAvailabilityHeatmap` | `src/lib/quorum/insight.functions.ts:13`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getPlanWeather` | `src/lib/quorum/insight.functions.ts:57`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `listNotifications` | `src/lib/quorum/insight.functions.ts:116`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `markNotificationsRead` | `src/lib/quorum/insight.functions.ts:127`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getGroupMemory` | `src/lib/quorum/insight.functions.ts:149`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `startItinerary` | `src/lib/quorum/itinerary.functions.ts:30`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `scoutItineraryStop` | `src/lib/quorum/itinerary.functions.ts:107`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `itineraryForecast` | `src/lib/quorum/itinerary.functions.ts:168`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `launchItinerary` | `src/lib/quorum/itinerary.functions.ts:194`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `geocodeZip` | `src/lib/quorum/location.functions.ts:12`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `suggestPlaces` | `src/lib/quorum/location.functions.ts:21`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `searchMapPlaces` | `src/lib/quorum/location.functions.ts:39`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `reverseZip` | `src/lib/quorum/location.functions.ts:67`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `nearbyMapPlaces` | `src/lib/quorum/location.functions.ts:76`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getMe` | `src/lib/quorum/plan.functions.ts:15`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `saveProfile` | `src/lib/quorum/plan.functions.ts:65`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `uploadAvatar` | `src/lib/quorum/plan.functions.ts:158`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `deleteAccount` | `src/lib/quorum/plan.functions.ts:192`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `listGroups` | `src/lib/quorum/plan.functions.ts:211`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `createGroup` | `src/lib/quorum/plan.functions.ts:277`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `joinGroup` | `src/lib/quorum/plan.functions.ts:321`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getGroup` | `src/lib/quorum/plan.functions.ts:358`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `listPlans` | `src/lib/quorum/plan.functions.ts:404`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getDashboard` | `src/lib/quorum/plan.functions.ts:423`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `listActivity` | `src/lib/quorum/plan.functions.ts:553`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `createPlan` | `src/lib/quorum/plan.functions.ts:586`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getPlan` | `src/lib/quorum/plan.functions.ts:667`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `submitConstraints` | `src/lib/quorum/plan.functions.ts:749`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `generateRecommendations` | `src/lib/quorum/plan.functions.ts:810`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `castVote` | `src/lib/quorum/plan.functions.ts:829`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `finalizePlan` | `src/lib/quorum/plan.functions.ts:863`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `requestParentApproval` | `src/lib/quorum/plan.functions.ts:930`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getSummaryShareLink` | `src/lib/quorum/plan.functions.ts:993`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getPlanDefaults` | `src/lib/quorum/planner.functions.ts:37`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `previewFairPointVenues` | `src/lib/quorum/planner.functions.ts:143`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `launchAiPlan` | `src/lib/quorum/planner.functions.ts:226`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getVenueInsight` | `src/lib/quorum/reviews.functions.ts:8`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getFriendPins` | `src/lib/quorum/sharing.functions.ts:8`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getSharePeers` | `src/lib/quorum/sharing.functions.ts:16`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `getSharingState` | `src/lib/quorum/sharing.functions.ts:24`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `shareLocationWith` | `src/lib/quorum/sharing.functions.ts:32`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `stopSharingWith` | `src/lib/quorum/sharing.functions.ts:43`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `stopWatchingFriend` | `src/lib/quorum/sharing.functions.ts:52`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `setGhostMode` | `src/lib/quorum/sharing.functions.ts:61`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `nudgeFriendPin` | `src/lib/quorum/sharing.functions.ts:70`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `browseSpots` | `src/lib/quorum/spots.functions.ts:40`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `addSpotToPlan` | `src/lib/quorum/spots.functions.ts:172`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `saveSpot` | `src/lib/quorum/spots.functions.ts:245`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `unsaveSpot` | `src/lib/quorum/spots.functions.ts:281`; existing validator + serialized named return | JWT + handler authorization / side effects |
| `listSavedSpots` | `src/lib/quorum/spots.functions.ts:298`; existing validator + serialized named return | JWT + handler authorization / side effects |

## Acceptance gates for backend API milestones

Verified JWT/first-factor/capability distinction, same zod bounds/unknown-key stripping, same ownership/MFA/guardian checks, no private peer values, same quota/expiry/side effects, upload bytes+ownership validation, explicit finite JSON models, idempotent launch/delete semantics, inline field errors, and integration fixtures for success/401/403/422/429/503. Build and test web changes on feat/ios-api; push and leave merging to the user. No hosted database, provider delivery, quota spending or deployment is authorized by a local mock passing.
