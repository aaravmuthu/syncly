import Foundation
import Testing
@testable import Syncly

struct FoundationTests {
    private let valid: [String: String] = [
        "SUPABASE_URL": "https://example.supabase.co",
        "SUPABASE_PUBLISHABLE_KEY": "sb_publishable_fixture_only",
        "SYNCLY_API_URL": "https://syncly.website/api/ios/v1"
    ]

    @Test func configurationAcceptsPublicHTTPSSettings() throws {
        let config = try AppConfiguration(values: valid)
        #expect(config.supabaseURL.host == "example.supabase.co")
        #expect(config.apiURL.path == "/api/ios/v1")
    }
    @Test(arguments: ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SYNCLY_API_URL"])
    func configurationRejectsMissingSettings(name: String) {
        var values = valid
        values.removeValue(forKey: name)
        #expect(throws: AppConfiguration.Error.missingValue(name)) {
            try AppConfiguration(values: values)
        }
    }
    @Test(arguments: ["http://example.com", "file:///tmp/config", "https://user:password@example.com"])
    func configurationRejectsInsecureOrigins(url: String) {
        var values = valid
        values["SYNCLY_API_URL"] = url
        #expect(throws: AppConfiguration.Error.insecureURL("SYNCLY_API_URL")) {
            try AppConfiguration(values: values)
        }
    }
    @Test(arguments: ["sb_secret_fixture", "sb_publishable_", "a.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.c"])
    func configurationRejectsNonPublicKeys(key: String) {
        var values = valid
        values["SUPABASE_PUBLISHABLE_KEY"] = key
        #expect(throws: AppConfiguration.Error.invalidPublishableKey) {
            try AppConfiguration(values: values)
        }
    }
    @Test func optionalAnalyticsAreOffByDefault() {
        #expect(AnalyticsConsent() == AnalyticsConsent(analytics: false, marketing: false))
    }
    @Test @MainActor func appearancePersistsWithoutEnablingAnalytics() throws {
        let name = "SynclyTests.\(UUID().uuidString)"
        let preferences = try #require(UserDefaults(suiteName: name))
        defer { preferences.removePersistentDomain(forName: name) }
        let state = AppState(preferences: preferences)
        #expect(state.appearance == .system)
        state.appearance = .dark
        #expect(AppState(preferences: preferences).appearance == .dark)
        #expect(state.analytics.analytics == false)
    }
    @Test func bundledConfigurationLoads() throws {
        _ = try AppConfiguration.load()
    }
}
