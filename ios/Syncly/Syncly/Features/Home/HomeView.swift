import SwiftUI

struct HomeView: View {
    @Environment(AppContainer.self) private var app
    @State private var model = ResourceModel()
    @State private var create = false
    @State private var digest:JSONValue = .null
    var body: some View {
        List {
            Section {
                VStack(alignment:.leading,spacing:10) {
                    Text("Hey, \(app.profile["display_name"].text)").font(.title2.bold())
                    Text("Make room for a good plan.").foregroundStyle(Theme.secondaryText)
                    DemoNotice()
                }.padding(.vertical,4)
            }
            Section("Your week with Sync") {
                ActionButton(title:"Catch me up",workingTitle:"Reviewing your week…") {digest=try await app.call("getSquadDigest")}
                if !digest["headline"].text.isEmpty {Text(digest["headline"].text).font(.headline);ForEach(digest["bullets"].items.map(\.text),id:\.self) {Text($0)};if !digest["nextBest"].text.isEmpty {Text(digest["nextBest"].text)}}
            }
            Section("Your plans") {
                if model.value["plans"].items.isEmpty,!model.loading { ContentUnavailableView("Nothing planned yet",systemImage:"calendar",description:Text("Create a plan with your group and answer privately.")) }
                ForEach(model.value["plans"].items.map(WireRow.init)) { row in NavigationLink { PlanDetailView(planID:row.id) } label: { PlanRow(row:row) } }
            }
            Section {
                Button("Create a plan",systemImage:"plus") { create = true }
                NavigationLink("Magic AI plan",destination:MagicPlanView())
                NavigationLink("Multi-stop itinerary",destination:ItineraryBuilderView())
                if app.isDemo { NavigationLink("Compatibility playground",destination:DemoPlaygroundView()) }
                NavigationLink("Explore spots",destination:SpotsView())
                NavigationLink("Ask Sync",destination:SyncAssistantView())
                NavigationLink("Activity",destination:ActivityView())
                NavigationLink("Family hub",destination:FamilyHubView())
                NavigationLink("Settings",destination:SettingsView())
            }
            if model.loading { ProgressView() }
            InlineFailure(message:model.error)
        }.synclyList().navigationTitle("Syncly")
        .toolbar { ToolbarItem(placement:.topBarTrailing) { NavigationLink { SettingsView() } label: { Image(systemName:"gearshape") }.accessibilityLabel("Settings") } }
        .task { await model.load(app,"getDashboard") }
        .refreshable { await model.load(app,"getDashboard") }
        .sheet(isPresented:$create,onDismiss:{Task { await model.load(app,"getDashboard") }}) { NavigationStack { PlanWizardView() } }
    }
}
struct PlanRow: View {
    let row: WireRow
    var body: some View {
        VStack(alignment:.leading,spacing:6) {
            Text(row["title"].text).font(.headline)
            HStack { Label(row["status"].text.capitalized,systemImage:row["status"].text == "finalized" ? "checkmark.circle" : "clock"); if !row["location_area"].text.isEmpty { Text(row["location_area"].text) } }.font(.caption).foregroundStyle(Theme.secondaryText)
            if let date = WireDate.parse(row["window_start"].text) { Text(date,format:.dateTime.weekday().month().day().hour().minute()).font(.subheadline) }
        }.padding(.vertical,5)
    }
}
struct ActivityView: View {
    @Environment(AppContainer.self) private var app
    @State private var model = ResourceModel()
    @State private var feed = "Notifications"
    private var notifications:Bool {feed == "Notifications"}
    var body: some View {
        List {
            DemoNotice()
            Picker("Feed",selection:$feed) {
                Text("Notifications").tag("Notifications")
                Text("Group activity").tag("Group activity")
            }.pickerStyle(.segmented)
            if notifications,model.value.items.contains(where:{$0["read"].flag != true}) {
                ActionButton(title:"Mark all as read") {try await markRead(nil)}
            }
            ForEach(model.value.items.map(WireRow.init)) { row in
                VStack(alignment:.leading,spacing:6) {
                    HStack {
                        if notifications,row["read"].flag != true {Image(systemName:"circle.fill").font(.caption2).foregroundStyle(Theme.primary).accessibilityLabel("Unread")}
                        Text(row["title"].text.isEmpty ? row["message"].text : row["title"].text).font(.headline)
                    }
                    if !row["body"].text.isEmpty {Text(row["body"].text).font(.subheadline).foregroundStyle(Theme.secondaryText)}
                    if let date=WireDate.parse(row["created_at"].text) {Text(date,style:.relative).font(.caption).foregroundStyle(Theme.secondaryText)}
                    if !row["plan_id"].text.isEmpty {NavigationLink("View plan") {PlanDetailView(planID:row["plan_id"].text)}}
                    else if !row["group_id"].text.isEmpty {NavigationLink("View group") {GroupDetailView(groupID:row["group_id"].text)}}
                }.swipeActions {
                    if notifications,row["read"].flag != true {
                        Button("Mark read",systemImage:"checkmark") {Task {do {try await markRead(row.id)} catch {model.error=error.localizedDescription}}}.tint(Theme.primary)
                    }
                }
            }
            if model.loading {ProgressView()}
            if model.value.items.isEmpty,!model.loading {ContentUnavailableView("You’re all caught up",systemImage:"bell",description:Text("Group updates will appear here."))}
            InlineFailure(message:model.error)
        }.synclyList().navigationTitle("Activity")
        .task(id:feed) {await reload()}.refreshable {await reload()}
    }
    private func reload() async {await model.load(app,notifications ? "listNotifications" : "listActivity")}
    private func markRead(_ id:String?) async throws {
        let result=try await app.call("markNotificationsRead",id.map { ["ids":JSONValue.array([.string($0)])] } ?? [:])
        guard result["ok"].flag == true else {throw NSError(domain:"Syncly",code:1,userInfo:[NSLocalizedDescriptionKey:"Could not mark notifications as read."])}
        await reload()
    }
}
