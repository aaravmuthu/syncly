import SwiftUI
import MapKit

struct FriendProfileView:View {
    let profileID:String
    @Environment(AppContainer.self) private var app
    @State private var model=ResourceModel()
    @State private var nickname=""
    @State private var thread:String?
    var body:some View {
        List {
            Section {Text(model.value["emoji"].text).font(.largeTitle);Text(model.value["name"].text).font(.title2.bold());Text(model.value["bio"].text)}
            Section("Your nickname") {TextField("Nickname",text:$nickname);ActionButton(title:"Save nickname") {_ = try await app.call("setNickname",["profileId":.string(profileID),"nickname":.string(nickname)]);try await app.loadNicknames();await reload()}}
            Section("Together") {
                ForEach(model.value["circles"].items.map(WireRow.init)) {r in NavigationLink(r["name"].text) {GroupDetailView(groupID:r.id)}}
                ForEach(model.value["upcoming"].items.map(WireRow.init)) {r in NavigationLink(r["title"].text) {PlanDetailView(planID:r.id)}}
            }
            Section("Contact") {
                ActionButton(title:"Message") {let result=try await app.call("openThread",["peerId":.string(profileID)]);thread=result["threadId"].text}
                ActionButton(title:"Request location") {_ = try await app.call("requestLocation",["profileId":.string(profileID)])}
                Text("A request does not turn on their sharing or grant you access.").font(.footnote)
                ActionButton(title:"Hide from my map") {_ = try await app.call("setContactGhost",["profileId":.string(profileID),"hidden":.bool(true)]);await reload()}
                ActionButton(title:"Show on my map") {_ = try await app.call("setContactGhost",["profileId":.string(profileID),"hidden":.bool(false)]);await reload()}
            }
            if let lat=model.value["telemetry"]["lat"].number,let lon=model.value["telemetry"]["lon"].number {Section("Shared location") {Map {Marker(model.value["name"].text,coordinate:.init(latitude:lat,longitude:lon))}.frame(height:200);Text("Updated " + model.value["telemetry"]["lastSeen"].text).font(.caption)}}
            InlineFailure(message:model.error)
        }.synclyList().navigationTitle("Friend").task {await reload()}.refreshable {await reload()}.navigationDestination(item:$thread) {id in ChatView(id:id,title:model.value["name"].text,direct:true)}
    }
    private func reload() async {await model.load(app,"getFriendProfile",["profileId":.string(profileID)]);nickname=model.value["nickname"].text}
}
