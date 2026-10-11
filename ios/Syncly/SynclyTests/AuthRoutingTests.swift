import Foundation
import Testing
@testable import Syncly

private actor FixtureAuth: AuthService {
    enum Security {case failed,native,email,passwordRequired,verified}
    let state: Security
    private(set) var signedOut = false
    init(_ state: Security) {self.state = state}
    func restore() async throws -> Bool {true}
    func password(email:String,password:String,signup:Bool) async throws -> Bool {true}
    func sendCode(email:String) async throws {}
    func verifyCode(email:String,code:String) async throws {}
    func google() async throws {}
    func reset(email:String) async throws {}
    func updatePassword(_ password:String) async throws {}
    func signOut() async throws {signedOut = true}
    func security() async throws -> SecurityState {
        if state == .failed {throw ServiceFailure(message:"Verification unavailable")}
        return SecurityState(requiresNativeFactor:state == .native,email:.object(["enabled":.bool(state == .email || state == .passwordRequired),"verified":.bool(state == .verified),"requiresPassword":.bool(state == .passwordRequired)]))
    }
}
private actor CountingService: SynclyService {
    private(set) var calls: [String] = []
    func call(_ operation:String,_ input:JSONValue) async throws -> JSONValue {calls.append(operation);return .object([:])}
}
struct AuthRoutingTests {
    @Test @MainActor func failedVerificationNeverLoadsPrivateProfile() async throws {
        let service = CountingService(),auth = FixtureAuth(.failed)
        let app = AppContainer(auth:auth,service:service,liveDataEnabled:true)
        await app.restore()
        #expect(app.stage == .signedOut)
        #expect(await service.calls.isEmpty)
    }
    @Test @MainActor func nativeAndEmailMfaBlockProtectedData() async throws {
        for state in [FixtureAuth.Security.native,.email] {
            let service = CountingService(),auth = FixtureAuth(state)
            let app = AppContainer(auth:auth,service:service,liveDataEnabled:true)
            try await app.finishSignIn()
            #expect(app.stage == (state == .native ? .nativeFactor : .emailFactor))
            #expect(await service.calls.isEmpty)
        }
    }
    @Test @MainActor func emailPrimaryCannotCountAsIndependentSecondFactor() async throws {
        let auth = FixtureAuth(.passwordRequired),service = CountingService()
        let app = AppContainer(auth:auth,service:service,liveDataEnabled:true)
        await #expect(throws:ServiceFailure.self) {try await app.finishSignIn()}
        #expect(await auth.signedOut)
        #expect(await service.calls.isEmpty)
        #expect(app.stage == .signedOut)
    }
    @Test @MainActor func unverifiedDeploymentGatesLiveProfileAndDemoHasNoLiveCalls() async throws {
        let service = CountingService(),auth = FixtureAuth(.verified)
        let app = AppContainer(auth:auth,service:service,liveDataEnabled:false)
        try await app.finishSignIn()
        #expect(app.stage == .connectionPending)
        #expect(await service.calls.isEmpty)
        await app.enterDemo()
        #expect(app.isDemo && app.stage == .ready)
        _ = try await app.call("listGroups")
        #expect(await service.calls.isEmpty)
    }
    @Test func demoParentLinkRequiresTeenResponseAndRevokesLink() async throws {
        let demo = try DemoService()
        _ = try await demo.call("unlinkGuardian",.object(["linkId":.string("demo-link")]))
        _ = try await demo.call("linkTeen",.object(["code":.string("DEMO123")]))
        #expect(try await demo.call("getMyGuardians",.object([:])).items.isEmpty)
        let requests = try await demo.call("getMyLinkRequests",.object([:]))
        let id = try #require(requests.items.first?["id"])
        _ = try await demo.call("answerLinkRequest",.object(["requestId":id,"approve":.bool(true)]))
        #expect(try await !demo.call("getMyGuardians",.object([:])).items.isEmpty)
        _ = try await demo.call("unlinkGuardian",.object(["linkId":.string("demo-link")]))
        #expect(try await demo.call("getMyGuardians",.object([:])).items.isEmpty)
    }
}
