import Foundation

nonisolated struct AnalyticsConsent: Equatable, Sendable {
    var analytics = false
    var marketing = false
    // No optional analytics or advertising SDK is installed. Consent-aware
    // integrations and versioned 180-day consent persistence belong to M1.
}
