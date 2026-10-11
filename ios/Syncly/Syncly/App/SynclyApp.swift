import AppIntents
import SwiftUI
import UIKit

@main
struct SynclyApp: App {
    @UIApplicationDelegateAdaptor(PushDelegate.self) private var delegate
    @State private var state = AppState()
    @State private var container = AppContainer()

    var body: some Scene {
        WindowGroup {
            AppEntryView()
                .environment(state)
                .environment(container)
                .onAppear {delegate.registration = container.push;container.push.app = container}
                .onOpenURL { container.receive($0); if container.pendingInvite != nil {state.selectedTab = .groups} }
                .tint(Theme.primary)
                .preferredColorScheme(state.appearance.colorScheme)
        }
    }
}
