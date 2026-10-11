import SwiftUI
import MapKit

struct FairPointView:View {
    let groupID:String
    @Environment(AppContainer.self) private var app
    @State private var model=ResourceModel()
    @State private var category="dinner"
    @State private var vibe=""
    @State private var radius=12.0
    var body:some View {
        List {
            Section("Find a fair place") {
                Picker("Plan type",selection:$category) {Text("Food").tag("dinner");Text("Hangout").tag("hangout");Text("Sports").tag("sports");Text("Day trip").tag("daytrip")}
                TextField("What are you in the mood for?",text:$vibe)
                Slider(value:$radius,in:1...60,step:1);Text("Within \(Int(radius)) miles of the shared meeting area")
                ActionButton(title:"Compare venues",workingTitle:"Finding fair options…") {await model.load(app,"previewFairPointVenues",["groupId":.string(groupID),"category":.string(category),"vibe":.string(vibe),"radiusMiles":.number(radius)])}
                Text("Estimated drives are computed on the server. Members’ home coordinates and private answers are not downloaded.").font(.footnote)
            }
            if !model.value["origin"]["label"].text.isEmpty {Section("Meeting area") {Text(model.value["origin"]["label"].text)}}
            ForEach(model.value["venues"].items.map {WireRow(value:$0)}) {r in
                Section(r["title"].text) {
                    Text(r["subtitle"].text);Text(CostEstimate.moneyRange(r["costMin"].number ?? 0,r["costMax"].number ?? 0));if !r["address"].text.isEmpty {Text(r["address"].text)}
                    if let lat=r["lat"].number,let lon=r["lon"].number {Map {Marker(r["title"].text,coordinate:.init(latitude:lat,longitude:lon))}.frame(height:180);if let url=URL(string:"https://maps.apple.com/?daddr=\(lat),\(lon)") {Link("Directions",destination:url)}}
                    ForEach(r["drives"].items.map {WireRow(value:$0)}) {drive in LabeledContent(app.displayName(drive["profileId"].text,fallback:drive["name"].text),value:"About \(Int(drive["minutes"].number ?? 0)) min")}
                    Label(r["scheduleFits"].flag ? "Fits the group’s saved curfews" : "Check return timing",systemImage:r["scheduleFits"].flag ? "checkmark.circle" : "clock")
                }
            }
            InlineFailure(message:model.error)
        }.synclyList().navigationTitle("Fair meeting places")
    }
}
