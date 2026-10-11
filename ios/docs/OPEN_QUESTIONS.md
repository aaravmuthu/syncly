# Syncly native open questions / external prerequisites

1. **Backend privacy rollout:** feat/ios-api commit 13cff21 is pushed but not deployed. Hosted column grants/policies have not been inspected. Do not enable native live private-data access until the migration and staging tests are complete.
2. **Versioned native API:** no /api/ios/v1 endpoints exist in the baseline. BACKEND_GAP.md defines proposed endpoint contracts; none is represented as deployed. Actor clients/mocks will land with feature milestones, not M0's offline shell.
3. **Privacy language mismatch:** web planning settings say school/graduation defaults are never shared, while existing group/plan member cards explicitly select bio, school and grad_year. The minimal backend fix preserves these existing card fields but removes private contact/home/planning columns. Before M1 live access, resolve whether school/grad_year should also become private and update backend projection + corresponding web card readers together on feat/ios-api.
4. **Approval capability auth:** web /approve supports a no-account opaque token and separately a signed planId.sig summary. Blanket JWT-only API rules cannot preserve that no-account flow. Proposed capability endpoints are distinct and tightly scoped; alternatively open existing public approval in Safari. Confirm this boundary before M6 API implementation, never treat a bare plan ID as a capability.
5. **Hosted schema baseline:** 20260821 migrations reference helper functions and app_private schema not reconstructed in the initial committed migration. Reconcile the real staging baseline before claiming all 32 migrations apply to an empty database. Tables added after the MFA policy loop need explicit MFA checks.
6. **Existing native MFA accounts:** phone sign-up is hidden, but already-enrolled native MFA factors remain load-bearing. Support their legitimate Supabase challenge flow or a clear supported recovery path; never bypass required AAL2 because native UI omits phone sign-up.
7. **Receipt/reviews:** venue reviews in reviews.server.ts are AI-generated community-style content. No dedicated expense-ledger/receipt or user-review table appears in committed schema. Match displayed receipt/cost-estimate/share behavior without inventing persistence or representing AI reviews as verified user reviews.
8. **Universal Links / Google / APNs:** Apple Team ID, entitlements/provisioning, hosted AASA and Supabase allowed callback URLs need owner configuration. Simulator M0 needs none. APNs delivery/device token storage do not exist; document and implement separately. No billing or purchases.
9. **App icon / fonts:** The supplied SVG has now been rasterized into an opaque 1024 px native icon. System typography is used; no unlicensed font is bundled.
10. **Full QA:** M0 screenshots test only current native shell and appearance. Accessibility Inspector/VoiceOver, Dynamic Type extremes, iPad and all live feature flows remain later acceptance work.

User clarified native SwiftUI/Apple-style app only; web landing/marketing/sphere hero omitted. Original /Users/aaravmuthu/syncly leftovers were preserved; native work is in /Users/aaravmuthu/syncly-ios.

## Current integration gaps

The native screens are implemented beyond M0. The API registry and transport exist on the separate backend branch, with transport tests and compiled-route unauthorized smoke checks. They are not deployed; full production Vite bundling exceeded the tested 1 GB/1.5 GB Node heaps on this Mac. Hosted happy paths and cross-account authorization must be verified in staging.

FEATURE_PARITY.md records remaining native subflows and physical-device/accessibility QA. Of particular concern, existing addSpotToPlan feasibility and castResolutionVote safety checks need a backend review before exposing those paths natively. Preserve private constraints; do not solve this by querying peer answers. The M0 comments above are historical and do not describe current screen coverage.
