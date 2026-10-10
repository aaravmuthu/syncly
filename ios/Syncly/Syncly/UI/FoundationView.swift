import SwiftUI

struct FoundationView: View {
    let tab: AppTab
    var body: some View {
        ScrollView {
            ContentUnavailableView {
                Label(tab.emptyTitle, systemImage: tab.symbol)
            } description: {
                Text(tab.emptyMessage)
            }
            .padding(.top, 72)
            .frame(maxWidth: 640)
            .frame(maxWidth: .infinity)
        }
        .background(Theme.background)
        .navigationTitle(tab.title)
    }
}
