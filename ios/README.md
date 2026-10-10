# Syncly native iOS — M0

Native SwiftUI foundation for iOS 27, Swift 6.4 and Xcode 27. Open `ios/Syncly/Syncly.xcodeproj`, choose the shared Syncly scheme and an iOS 27 simulator, then Run. No package installation or CocoaPods is needed for M0. Physical-device signing needs an Apple team configured by the owner.

M0 opens directly to Home with native Home, Groups, Plans, Radar and Messages tabs. Settings provides a persisted system/light/dark appearance picker. Other tabs are intentional placeholders. No marketing landing page, website wrapper, sign-in, live data, analytics SDK or location permission is included. Auth and mock demo arrive in M1; feature work stops here pending the M0 report.

## Build and test

Run from the repository root. On this 8 GB Mac close Xcode GUI before CLI builds, use two jobs, serial tests and one simulator. The existing iPhone 18 Pro simulator is used below.

```sh
xcodebuild -project ios/Syncly/Syncly.xcodeproj -scheme Syncly -destination 'platform=iOS Simulator,id=D8183E87-966E-4026-97AF-64960FDD6751' -derivedDataPath /tmp/syncly-dd -jobs 2 build
xcodebuild -project ios/Syncly/Syncly.xcodeproj -scheme Syncly -destination 'platform=iOS Simulator,id=D8183E87-966E-4026-97AF-64960FDD6751' -derivedDataPath /tmp/syncly-dd -jobs 2 -parallel-testing-enabled NO test
xcodebuild -project ios/Syncly/Syncly.xcodeproj -scheme Syncly -configuration Release -destination 'platform=iOS Simulator,id=D8183E87-966E-4026-97AF-64960FDD6751' -derivedDataPath /tmp/syncly-dd -jobs 2 build
perl -e 'alarm 45; exec @ARGV' xcrun simctl install booted /tmp/syncly-dd/Build/Products/Debug-iphonesimulator/Syncly.app
perl -e 'alarm 45; exec @ARGV' xcrun simctl launch booted website.syncly.app
```

## Configuration and privacy

`Syncly/Config/Public.xcconfig` contains only the existing public Supabase URL/key and proposed HTTPS API base. Debug and Release include it; `Info.plist` expands those values. The xcconfig HTTPS spelling `https:/$()/` prevents its double slash being treated as a comment. AppConfiguration rejects missing settings, HTTP/credential-bearing URLs, service-role JWTs and secret keys. ATS disallows arbitrary loads in both configurations.

The API base is a draft contract, not a deployed service. No Supabase client or networking service is instantiated in M0. Optional analytics stays off. UserDefaults holds appearance only; future auth sessions must use Keychain. The privacy manifest declares the own-app UserDefaults API reason and no current tracking or data collection. Update it as features land.

The profile privacy prerequisite is separately pushed on feat/ios-api (13cff21). It has not been deployed or verified against hosted grants. Resolve the documented school/graduation privacy mismatch and verify staging RLS before enabling live private-data access.

## Validation and screenshots

Foundation tests cover HTTPS/public-key validation, bundled config, appearance persistence and analytics defaults. Seven Swift Testing functions include thirteen parameterized invocations. Screenshots under `docs/screenshots/` cover all five tabs and Settings in light and dark on iPhone 18 Pro; inspect captures after allowing launch rendering to settle. Full VoiceOver, large Dynamic Type, iPad and feature-flow QA remains later milestone work.

Debug-only launch arguments select reproducible shell screens without persisting appearance: `--snapshot-tab home|groups|plans|radar|messages`, `--snapshot-appearance light|dark|system`, and `--snapshot-settings`. Release excludes this launch-argument handling.

## Implementation plan

`docs/ARCHITECTURE.md` records the route/model/access map, design decisions and milestone checklist. `docs/BACKEND_GAP.md` records proposed versioned APIs and current source bindings; expanded JSON schemas and response fixtures remain endpoint implementation gates. `docs/OPEN_QUESTIONS.md` tracks deployment, privacy and owner configuration prerequisites. Source and operation inventories are in the adjacent JSON files.

M1: shared controls/auth/mock demo. M2: groups/plans/constraints and pure engine ports. M3: planning/venues/itinerary/finalize. M4: messages/activity. M5: Radar/settings. M6: family/guardian/deep links/push/legal. M7: accessibility, app icon and final polish. Each milestone is built, tested, visually checked, committed and reported separately; no automatic merge or PR creation.
