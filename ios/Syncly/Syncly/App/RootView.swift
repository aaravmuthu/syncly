import SwiftUI

struct RootView: View {
    @Environment(AppState.self) private var state

    var body: some View {
        @Bindable var state = state
        TabView(selection: $state.selectedTab) {
            ForEach(AppTab.allCases) { tab in
                Tab(tab.title, systemImage: tab.symbol, value: tab) {
                    NavigationStack {
                        #if DEBUG
                        if state.snapshotSettings && tab == .home {
                            AppearanceSettingsView()
                        } else {
                            content(for: tab)
                        }
                        #else
                        content(for: tab)
                        #endif
                    }
                }
            }
        }
        .tabViewStyle(.sidebarAdaptable)
    }

    @ViewBuilder
    private func content(for tab: AppTab) -> some View {
        if tab == .home {
            HomeView()
        } else {
            FoundationView(tab: tab)
        }
    }
}

#Preview {
    RootView().environment(AppState()).tint(Theme.primary)
}
