import Observation
import SwiftUI

@Observable
final class AppState {
    var selectedTab: AppTab = .home
    #if DEBUG
    let snapshotSettings: Bool
    private let isSnapshotLaunch: Bool
    #endif
    var appearance: AppAppearance {
        didSet {
            #if DEBUG
            guard !isSnapshotLaunch else { return }
            #endif
            preferences.set(appearance.rawValue, forKey: "appearance")
        }
    }
    let configuration: Result<AppConfiguration, AppConfiguration.Error>
    let analytics = AnalyticsConsent()
    private let preferences: UserDefaults

    init(preferences: UserDefaults = .standard) {
        self.preferences = preferences
        #if DEBUG
        let arguments = ProcessInfo.processInfo.arguments
        snapshotSettings = arguments.contains("--snapshot-settings")
        isSnapshotLaunch = arguments.contains("--snapshot-appearance")
        #endif
        appearance = AppAppearance(rawValue: preferences.string(forKey: "appearance") ?? "") ?? .system
        do {
            configuration = .success(try AppConfiguration.load())
        } catch {
            configuration = .failure(error)
        }
        #if DEBUG
        func argument(after flag: String) -> String? {
            guard let index = arguments.firstIndex(of: flag), index + 1 < arguments.count else { return nil }
            return arguments[index + 1]
        }
        if let name = argument(after: "--snapshot-tab"), let tab = AppTab(rawValue: name) {
            selectedTab = tab
        }
        if let name = argument(after: "--snapshot-appearance"), let choice = AppAppearance(rawValue: name) {
            appearance = choice
        }
        #endif
    }
}

enum AppTab: String, CaseIterable, Identifiable {
    case home, groups, plans, radar, messages
    var id: String { rawValue }
    var title: String { rawValue.capitalized }
    var symbol: String {
        switch self {
        case .home: "house.fill"
        case .groups: "person.2.fill"
        case .plans: "calendar"
        case .radar: "location.circle.fill"
        case .messages: "bubble.left.and.bubble.right.fill"
        }
    }
    var emptyTitle: String {
        switch self {
        case .home: "Plans that work for everyone"
        case .groups: "Your people, together"
        case .plans: "Something to look forward to"
        case .radar: "Meet up with peace of mind"
        case .messages: "Keep the group in the loop"
        }
    }
    var emptyMessage: String {
        switch self {
        case .home: "Everyone privately shares what they need. Find a plan that fits the whole group."
        case .groups: "Your groups and the people you plan with will appear here."
        case .plans: "Your upcoming plans will appear here, from the first idea to the final details."
        case .radar: "Location sharing is always your choice. No location is being shared."
        case .messages: "Squad conversations and direct messages will appear here."
        }
    }
}
