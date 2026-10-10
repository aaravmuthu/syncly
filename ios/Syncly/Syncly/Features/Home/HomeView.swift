import SwiftUI

struct HomeView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("A LITTLE LESS BACK-AND-FORTH")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.primary)
                    Text("Good plans.\nEveryone included.")
                        .font(.largeTitle.weight(.bold))
                        .foregroundStyle(Theme.foreground)
                        .accessibilityAddTraits(.isHeader)
                    Text("Plans that actually work for everyone.")
                        .font(.body)
                        .foregroundStyle(Theme.secondaryText)
                }
                .padding(.top, 12)

                VStack(alignment: .leading, spacing: 20) {
                    Image(systemName: "calendar.badge.checkmark")
                        .font(.largeTitle)
                        .foregroundStyle(Theme.primary)
                        .accessibilityHidden(true)
                    Text("Make room for a good plan")
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(Theme.foreground)
                    Text("Your upcoming plans will live here. Everyone’s needs stay private, and the final plan brings you together.")
                        .foregroundStyle(Theme.secondaryText)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(24)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 24))

                Label {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("Your answers are yours")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.foreground)
                        Text("Share a plan, not your private constraints.")
                            .font(.subheadline)
                            .foregroundStyle(Theme.secondaryText)
                    }
                } icon: {
                    Image(systemName: "lock.shield")
                        .font(.title2)
                        .foregroundStyle(Theme.primary)
                        .accessibilityHidden(true)
                }
                .padding(.horizontal, 4)
            }
            .frame(maxWidth: 640, alignment: .leading)
            .padding(24)
            .frame(maxWidth: .infinity)
        }
        .background(Theme.background)
        .navigationTitle("Syncly")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink {
                    AppearanceSettingsView()
                } label: {
                    Image(systemName: "gearshape")
                        .frame(minWidth: 44, minHeight: 44)
                }
                .accessibilityLabel("Settings")
            }
        }
    }
}
