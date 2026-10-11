import Foundation
import Observation
import Supabase

@Observable
final class AppContainer {
    enum Stage { case restoring, signedOut, nativeFactor, emailFactor, agreement, onboarding, ready, connectionPending, passwordRecovery }
    var stage: Stage = .restoring
    var profile: JSONValue = .null
    var nicknames:JSONValue = .object([:])
    var isDemo = false
    let push = PushRegistration()
    var error: String?
    var pendingInvite: String?
    var approvalURL: URL?
    private(set) var client: SupabaseClient?
    private(set) var auth: (any AuthService)?
    private var service: (any SynclyService)?
    private var sessionRevision = 0
    private var callbackTask: Task<Void,Never>?
    private let liveOverride: Bool?
    var liveDataEnabled: Bool { liveOverride ?? (Bundle.main.object(forInfoDictionaryKey:"SYNCLY_LIVE_DATA_ENABLED") as? String == "YES") }
    init() {
        liveOverride = nil
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--demo") { return }
        #endif
        configureLive()
    }
    private func configureLive() {
        do {
            let configuration = try AppConfiguration.load()
            let client = SupabaseClient(supabaseURL:configuration.supabaseURL,supabaseKey:configuration.publishableKey,options:.init(auth:.init(storage:KeychainLocalStorage(service:"website.syncly.app.auth"),redirectToURL:URL(string:"syncly://auth-callback"))))
            self.client = client
            let live = LiveService(configuration:configuration,client:client)
            service = live; auth = SupabaseAuthService(client:client,service:live)
        } catch { self.error = "The app’s public configuration is unavailable."; stage = .signedOut }
    }
    init(auth: any AuthService,service: any SynclyService,liveDataEnabled: Bool) {
        self.auth = auth; self.service = service; liveOverride = liveDataEnabled
    }
    func restore() async {
        guard stage == .restoring, let auth else { return }
        do { if try await auth.restore() { try await finishSignIn() } else { stage = .signedOut } }
        catch { self.error = "Your session could not be restored. Sign in again or try the offline demo."; stage = .signedOut }
    }
    func call(_ operation: String,_ input: [String:JSONValue] = [:]) async throws -> JSONValue {
        guard let service else { throw ServiceFailure(message:"The connection is unavailable.") }
        return try await service.call(operation,.object(input))
    }
    func registerPush(token:String,environment:String) async throws {
        guard !isDemo,liveDataEnabled,let service else {throw ServiceFailure(message:"Push registration is unavailable.")}
        try await service.registerPush(token:token,environment:environment)
    }
    func finishSignIn() async throws {
        guard let auth else { throw ServiceFailure(message:"Sign-in is unavailable.") }
        let revision = sessionRevision
        let security = try await auth.security()
        guard revision == sessionRevision,!isDemo else { return }
        if security.requiresNativeFactor { stage = .nativeFactor; return }
        if security.email["enabled"].flag && !security.email["verified"].flag {
            if security.email["requiresPassword"].flag {
                try await auth.signOut(); stage = .signedOut
                throw ServiceFailure(message:"Sign in with your password or Google to use email as your second factor.")
            }
            stage = .emailFactor; return
        }
        guard liveDataEnabled else { stage = .connectionPending; return }
        if client?.auth.currentUser?.appMetadata["terms_version"]?.stringValue != "October 10, 2026" { stage = .agreement; return }
        try await loadProfile()
    }
    func loadProfile() async throws {
        let revision = sessionRevision
        let p = try await call("getMe")
        guard revision == sessionRevision else { return }
        profile = p; stage = p["onboarded"].flag ? .ready : .onboarding
        try? await loadNicknames()
    }
    func displayName(_ profileID:String,fallback:String)->String {nicknames[profileID].text.isEmpty ? fallback : nicknames[profileID].text}
    func loadNicknames() async throws {let revision=sessionRevision;let value=try await call("getNicknames");guard revision == sessionRevision else {return};nicknames=value}
    func enterDemo() async {
        sessionRevision += 1; nicknames = .object([:]);stage = .restoring; error = nil
        do {
            // Demo has a separate service and never copies the signed-in session.
            let demo = try DemoService();await client?.auth.stopAutoRefresh();auth=nil;client=nil;service = demo;isDemo = true
            profile = try await demo.call("getMe",.object([:])); stage = .ready
        } catch { self.error = error.localizedDescription; stage = .signedOut }
    }
    func leave() async throws {
        callbackTask?.cancel(); sessionRevision += 1
        if !isDemo { try await auth?.signOut() }
        isDemo = false; profile = .null; nicknames = .object([:]);error = nil
        configureLive()
        stage = .signedOut
    }
    func receive(_ url: URL) {
        if url.scheme == "https",url.host == "syncly.website" {
            let parts = url.pathComponents.filter {$0 != "/"}
            if parts.count == 2,parts[0] == "join",(4...12).contains(parts[1].count),PlanningHelpers.inviteCode(parts[1]) == parts[1].uppercased() { pendingInvite = PlanningHelpers.inviteCode(parts[1]) }
            else if parts.count == 2,parts[0] == "approve" { approvalURL = url }
            return
        }
        guard url.scheme == "syncly",url.host == "auth-callback",let client,!isDemo else { return }
        callbackTask?.cancel()
        callbackTask = Task {
            do {
                _ = try await client.auth.session(from:url)
                if URLComponents(url:url,resolvingAgainstBaseURL:false)?.queryItems?.contains(where: {$0.name == "recovery" && $0.value == "true"}) == true { stage = .passwordRecovery }
                else { try await finishSignIn() }
            } catch { self.error = "This sign-in link couldn’t be verified. Please try again."; stage = .signedOut }
        }
    }
}
