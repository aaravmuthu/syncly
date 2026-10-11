import SwiftUI
import MapKit

struct SpotsView: View {
    @Environment(AppContainer.self) private var app
    @State private var model=ResourceModel()
    @State private var saved=ResourceModel()
    @State private var query=""
    @State private var kind="food"
    @State private var searchMode="Nearby"
    @State private var radius=8.0
    private var spots:[WireRow] {model.value["spots"].items.map {WireRow(value:$0)}}
    private var bookmarks:[WireRow] {saved.value.items.map {WireRow(value:$0)}}
    var body: some View {
        List {
            searchControls
            if model.value["needsHome"].flag {
                Section {Text("Add your own ZIP code or home area in Planning defaults to search nearby.")}
            }
            results
            Section("Your saved spots") {
                ForEach(bookmarks) {r in
                    NavigationLink {SpotDetailView(spot:r.value)} label: {SpotSummary(spot:r.value)}
                    ActionButton(title:"Remove saved spot") {
                        _ = try await app.call("unsaveSpot",["key":r["key"]])
                        await saved.load(app,"listSavedSpots")
                    }
                }
            }
            if model.loading {ProgressView()}
            InlineFailure(message:model.error)
            InlineFailure(message:saved.error)
        }.synclyList().navigationTitle("Spots").task {await saved.load(app,"listSavedSpots")}
    }
    private var searchControls:some View {
        Section("Explore nearby") {
            Picker("Search",selection:$searchMode) {Text("Nearby").tag("Nearby");Text("By vibe").tag("Vibe")}.pickerStyle(.segmented)
            TextField(searchMode == "Vibe" ? "Quiet patio, affordable, walkable…" : "Cuisine, venue or activity",text:$query)
            Picker("Type",selection:$kind) {Text("Food").tag("food");Text("Activities").tag("activity")}
            Slider(value:$radius,in:1...60,step:1)
            Text("Within \(Int(radius)) miles")
            ActionButton(title:searchMode == "Vibe" ? "Find this vibe" : "Find spots",workingTitle:"Looking nearby…") {await search()}
        }
    }
    private var results:some View {
        Section("Nearby spots") {
            if model.value["aiGenerated"].flag {Text("Sync ranked these options for your request. Confirm venue details before going.").font(.footnote)}
            ForEach(spots) {r in
                NavigationLink {SpotDetailView(spot:r.value)} label: {SpotSummary(spot:r.value)}
            }
        }
    }
    private func search() async {
        await model.load(app,searchMode == "Vibe" ? "vibeSearchSpots" : "browseSpots",["query":.string(query),"kind":.string(kind),"radiusMiles":.number(radius)])
    }
}
private struct SpotSummary:View {
    let spot:JSONValue
    var body:some View {
        VStack(alignment:.leading,spacing:5) {
            Text(spot["title"].text).font(.headline)
            if !spot["subtitle"].text.isEmpty {Text(spot["subtitle"].text).font(.subheadline)}
            if !spot["reason"].text.isEmpty {Text(spot["reason"].text).font(.subheadline).foregroundStyle(Theme.secondaryText)}
            if let low=spot["costMin"].number,let high=spot["costMax"].number {Text(CostEstimate.moneyRange(low,high)).font(.caption)}
            if let minutes=spot["minutes"].number {Text("About \(Int(minutes)) min away").font(.caption).foregroundStyle(Theme.secondaryText)}
        }
    }
}
struct SpotDetailView: View {
    let spot:JSONValue
    @Environment(AppContainer.self) private var app
    @State private var insight:JSONValue = .null
    var body: some View {
        List {
            Section {Text(spot["title"].text).font(.title.bold());Text(spot["address"].text);Text(CostEstimate.moneyRange(spot["costMin"].number ?? 0,spot["costMax"].number ?? 0));if let lat=spot["lat"].number,let lon=spot["lon"].number {Map {Marker(spot["title"].text,coordinate:.init(latitude:lat,longitude:lon))}.frame(height:240);if let url=URL(string:"https://maps.apple.com/?daddr=\(lat),\(lon)") {Link("Directions",destination:url)}};ActionButton(title:"Save spot") {_ = try await app.call("saveSpot",["spot":spot])}}
            Section("Venue highlights") {
                ActionButton(title:"Ask Sync about this venue",workingTitle:"Finding highlights…") {insight = try await app.call("getVenueInsight",["name":spot["title"],"address":spot["address"],"cuisine":spot["cuisine"],"kind":spot["kind"],"priceLevel":spot["priceLevel"]])}
                Text("Highlights and review-style examples may be generated or templated. They are not verified customer reviews.").font(.footnote)
                ForEach(insight["popularDishes"].items.map(\.text),id:\.self) {Text($0)}
                ForEach(insight["reviews"].items,id:\.self) {r in VStack(alignment:.leading) {Text("\(r["author"].text) · \(r["rating"].number ?? 0,specifier:"%.1f")").font(.caption);Text(r["text"].text)}}
            }
        }.synclyList().navigationTitle("Venue").navigationBarTitleDisplayMode(.inline)
    }
}
struct SyncAssistantView: View {
    @Environment(AppContainer.self) private var app
    @State private var question=""
    @State private var answer:JSONValue = .null
    @State private var history:[JSONValue]=[]
    var body: some View {Form {
        Section("Ask Sync") {TextField("What should we do this weekend?",text:$question,axis:.vertical).lineLimit(3...6);ActionButton(title:"Ask Sync",workingTitle:"Thinking…") {let result = try await app.call("askSyncly",["question":.string(question),"history":.array(Array(history.suffix(20)))]);answer=result;history.append(.object(["role":.string("user"),"content":.string(question)]));if !result["answer"].text.isEmpty {history.append(.object(["role":.string("assistant"),"content":result["answer"]]))}}}
        if !answer["planRef"]["planId"].text.isEmpty {Section {NavigationLink(answer["planRef"]["title"].text) {PlanDetailView(planID:answer["planRef"]["planId"].text)}}}
        if answer["action"]["type"].text == "create_plan",!answer["action"]["groupId"].text.isEmpty {Section("Suggested plan") {
            Text(answer["action"]["groupName"].text);Text(answer["action"]["prompt"].text)
            NavigationLink("Review this plan idea") {MagicPlanView(groupID:answer["action"]["groupId"].text,prompt:answer["action"]["prompt"].text)}
        }}
        Section {Text(answer["answer"].text.isEmpty ? answer["message"].text : answer["answer"].text);Text("Review suggested actions before creating or changing a plan. Sync’s suggestions never authorize access to another person’s private answers.").font(.footnote)}
    }.synclyList().navigationTitle("Sync")}
}
