import SwiftUI

struct RootView: View {
    @Environment(AppState.self) private var state
    @Environment(AppContainer.self) private var app
    var body: some View {
        @Bindable var state = state
        TabView(selection:$state.selectedTab) {
            Tab("Home",systemImage:"house.fill",value:AppTab.home) { NavigationStack { HomeView() } }
            Tab("Groups",systemImage:"person.2.fill",value:AppTab.groups) { NavigationStack { GroupsView() } }
            Tab("Plans",systemImage:"calendar",value:AppTab.plans) { NavigationStack { PlansView() } }
            Tab("Radar",systemImage:"location.circle.fill",value:AppTab.radar) { NavigationStack { RadarView() } }
            Tab("Messages",systemImage:"bubble.left.and.bubble.right.fill",value:AppTab.messages) { NavigationStack { InboxView() } }
        }.tabViewStyle(.sidebarAdaptable)
    }
}
struct DemoNotice: View {
    @Environment(AppContainer.self) private var app
    var body: some View { if app.isDemo { Label("Offline demo · sample people and plans",systemImage:"sparkles").font(.footnote).foregroundStyle(Theme.secondaryText) } }
}
