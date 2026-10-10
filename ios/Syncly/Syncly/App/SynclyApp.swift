import AppIntents
import SwiftUI

@main
struct SynclyApp: App {
    @State private var state = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(state)
                .tint(Theme.primary)
                .preferredColorScheme(state.appearance.colorScheme)
        }
    }
}
