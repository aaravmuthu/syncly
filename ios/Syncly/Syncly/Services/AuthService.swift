import Foundation
import Supabase

private nonisolated struct EmailSecurityDTO: Decodable {let enabled:Bool;let verified:Bool;let requiresPassword:Bool}
nonisolated struct SecurityState: Sendable {
    let requiresNativeFactor: Bool
    let email: JSONValue
}
nonisolated protocol AuthService: Sendable {
    func restore() async throws -> Bool
    func password(email: String, password: String, signup: Bool) async throws -> Bool
    func sendCode(email: String) async throws
    func verifyCode(email: String, code: String) async throws
    func google() async throws
    func reset(email: String) async throws
    func updatePassword(_ password: String) async throws
    func signOut() async throws
    func security() async throws -> SecurityState
}
actor SupabaseAuthService: AuthService {
    let client: SupabaseClient
    let service: any SynclyService
    init(client: SupabaseClient, service: any SynclyService) { self.client = client; self.service = service }
    func restore() async throws -> Bool {
        guard client.auth.currentSession != nil else { return false }
        _ = try await client.auth.session
        return true
    }
    func password(email: String, password: String, signup: Bool) async throws -> Bool {
        if signup {
            return try await client.auth.signUp(email: email, password: password, redirectTo: URL(string: "syncly://auth-callback")).session != nil
        }
        _ = try await client.auth.signIn(email: email, password: password)
        return true
    }
    func sendCode(email: String) async throws {
        try await client.auth.signInWithOTP(email: email, redirectTo: URL(string: "syncly://auth-callback"), shouldCreateUser: false)
    }
    func verifyCode(email: String, code: String) async throws { _ = try await client.auth.verifyOTP(email: email, token: code, type: .email) }
    func google() async throws { _ = try await client.auth.signInWithOAuth(provider: .google, redirectTo: URL(string: "syncly://auth-callback")) }
    func reset(email: String) async throws { try await client.auth.resetPasswordForEmail(email, redirectTo: URL(string: "syncly://auth-callback?recovery=true")) }
    func updatePassword(_ password: String) async throws { _ = try await client.auth.update(user: UserAttributes(password: password)) }
    func signOut() async throws { try await client.auth.signOut() }
    func security() async throws -> SecurityState {
        let aal = try await client.auth.mfa.getAuthenticatorAssuranceLevel()
        let native = aal.currentLevel != "aal2" && aal.nextLevel == "aal2"
        // Do not query protected profile data until both security gates pass.
        let email = native ? JSONValue.null : try await service.call("getEmailSecurity", .object([:]))
        if !native { _ = try email.decoded(EmailSecurityDTO.self) }
        return SecurityState(requiresNativeFactor: native, email: email)
    }
}
