# Syncly native iOS

Open `ios/Syncly/Syncly.xcodeproj`, select the shared **Syncly** scheme and the iPhone 18 Pro simulator, then Run. This is a SwiftUI app for iOS 27 with native Home, Groups, Plans, Radar and Messages tabs; there is no marketing landing page. Supabase Swift 2.55.3 resolves through SPM with the committed lockfile.

Choose **Try the demo** on the sign-in screen to explore groups, plans, private answers, deterministic recommendations, chat and sample family flows without an account. Demo changes last for the current session. Live AI, venues, uploads, location and push are not simulated as successes.

## Live connection

The native API and privacy migration on `feat/ios-api` must be deployed and verified before changing `Config/Public.xcconfig`'s `SYNCLY_LIVE_DATA_ENABLED` to `YES`. Authentication uses the real Supabase SDK and Keychain. A missing native API cannot silently finish sign-in. Only public URL/key settings ship. Configure the `syncly://auth-callback` redirect in Supabase before testing Google, recovery or magic links.

Apple Team ID, hosted AASA, physical-device signing and APNs provisioning need owner configuration. `docs/apple-app-site-association` includes a clearly marked Team ID placeholder. APNs registration plumbing does not yet deliver notifications. Foreground Radar requires explicit When In Use permission; it stops local updates when closed/backgrounded and attempts server revocation, with failed confirmation surfaced inline.

## Build and test

Close Xcode GUI before CLI builds on this 8 GB Mac. Use one simulator, two build jobs and serial tests. From this worktree's root:

```sh
xcodebuild -project ios/Syncly/Syncly.xcodeproj -scheme Syncly -destination 'platform=iOS Simulator,id=D8183E87-966E-4026-97AF-64960FDD6751' -derivedDataPath /tmp/syncly-dd -jobs 2 -parallel-testing-enabled NO 'OTHER_SWIFT_FLAGS=$(inherited) -j2' test
xcodebuild -project ios/Syncly/Syncly.xcodeproj -scheme Syncly -configuration Release -destination 'platform=iOS Simulator,id=D8183E87-966E-4026-97AF-64960FDD6751' -derivedDataPath /tmp/syncly-dd -jobs 2 'OTHER_SWIFT_FLAGS=$(inherited) -j2' build
perl -e 'alarm 45; exec @ARGV' xcrun simctl install booted /tmp/syncly-dd/Build/Products/Debug-iphonesimulator/Syncly.app
perl -e 'alarm 45; exec @ARGV' xcrun simctl launch booted website.syncly.app --demo
```

Debug-only inspection arguments: `--demo --snapshot-tab home|groups|plans|radar|messages --snapshot-appearance light|dark`; `--snapshot-route` opens actual feature screens for repeatable offline screenshots. These arguments are excluded from Release. Unit tests cover 120 web scoring fixtures, 20 cost fixtures, itinerary/time/calendar parity, auth/MFA/live gates, demo isolation and sample family mutations.

`docs/FEATURE_PARITY.md` records implemented flows and remaining acceptance gaps. `docs/ARCHITECTURE.md` retains the source inventory and data-access boundaries; `docs/BACKEND_GAP.md` records API contracts. Live device, accessibility and hosted integration acceptance must not be inferred from a compiling screen.

Local acceptance: Debug tests and the optimized Release simulator build passed. 30 native unit tests and the full group → finalized plan → guardian link/condition → teen check-in UI flow pass on iPhone 18 Pro. The backend branch passed 56 transport/privacy/MFA tests and TypeScript. See the parity ledger for remaining external and safety gates.
