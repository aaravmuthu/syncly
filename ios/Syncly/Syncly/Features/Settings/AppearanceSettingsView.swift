import SwiftUI

struct AppearanceSettingsView: View {
    @Environment(AppState.self) private var state
    var body: some View {
        @Bindable var state = state
        Form {
            Section("Appearance") {
                Picker("Theme", selection: $state.appearance) {
                    ForEach(AppAppearance.allCases) { appearance in
                        Text(appearance.title).tag(appearance)
                    }
                }
                .pickerStyle(.inline)
            }
            Section {
                Label("Optional analytics are off", systemImage: "hand.raised")
                Text("Your preferences stay on this device.")
                    .foregroundStyle(.secondary)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
    }
}
