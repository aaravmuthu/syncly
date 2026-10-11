import SwiftUI
import MapKit

struct ContactsView:View {
    @Environment(AppContainer.self) private var app
    @State private var model=ResourceModel()
    @State private var thread:String?
    @State private var title=""
    var body:some View {
        List {
            ForEach(model.value.items.map(WireRow.init)) {r in VStack(alignment:.leading) {Text(app.displayName(r.id,fallback:r["name"].text)).font(.headline);Text(r["circles"].items.map(\.text).joined(separator:", ")).font(.caption);ActionButton(title:"Message") {let value=try await app.call("openThread",["peerId":r["id"]]);title=r["name"].text;thread=value["threadId"].text}}}
            InlineFailure(message:model.error)
        }.synclyList().navigationTitle("Contacts").task {await model.load(app,"listContacts")}.navigationDestination(item:$thread) {id in ChatView(id:id,title:title,direct:true)}
    }
}
struct DirectMessageLocation:View {
    let message:JSONValue
    var body:some View {
        if ["location","venue"].contains(message["kind"].text),let lat=message["meta"]["lat"].number,let lon=message["meta"]["lon"].number,lat.isFinite,lon.isFinite,(-90...90).contains(lat),(-180...180).contains(lon) {
            Map {Marker(message["meta"]["label"].text,coordinate:.init(latitude:lat,longitude:lon))}.frame(height:160)
            Text("Location shared at " + message["created_at"].text).font(.caption)
            if let url=URL(string:"https://maps.apple.com/?daddr=\(lat),\(lon)") {Link("Directions",destination:url)}
        }
    }
}
