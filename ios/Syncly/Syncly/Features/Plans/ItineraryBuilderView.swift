import SwiftUI
import MapKit

struct ItineraryBuilderView: View {
    @Environment(AppContainer.self) private var app
    @State private var groups = ResourceModel()
    @State private var groupID = ""
    @State private var prompt = ""
    @State private var itinerary: NativeItinerary?
    @State private var origin: JSONValue = .null
    @State private var launched = ""
    var body: some View {
        Form {
            Section("A whole night, together") {
                Picker("Group",selection:$groupID) {Text("Choose a group").tag("");ForEach(groups.value.items.map(WireRow.init)) {r in Text(r["name"].text).tag(r.id)}}
                TextField("Dinner, bowling and dessert near us…",text:$prompt,axis:.vertical).lineLimit(3...6)
                ActionButton(title:"Draft itinerary",workingTitle:"Sync is planning…") {
                    let result=try await app.call("startItinerary",["groupId":groupID.isEmpty ? .null : .string(groupID),"prompt":.string(prompt),"timeZone":.string(TimeZone.current.identifier)])
                    origin=result["origin"];itinerary=try NativeItinerary.draft(result["draft"],origin:origin)
                }
                DemoNotice()
                if app.isDemo {Text("AI and live venue lookup require a connection. The sample compatibility engine is available from Home.").font(.footnote)}
            }
            if let itinerary {ItineraryEditorView(initial:itinerary,origin:origin,groupID:groupID,onLaunch:{launched=$0})}
            if !launched.isEmpty {Section {NavigationLink("Review launched plan") {PlanDetailView(planID:launched)}}}
            InlineFailure(message:groups.error)
        }.synclyList().navigationTitle("Itinerary").task {await groups.load(app,"listGroups");groupID=groups.value.items.first?["id"].text ?? ""}
    }
}
struct ItineraryEditorView: View {
    let initial: NativeItinerary
    let origin: JSONValue
    let groupID: String
    let onLaunch: (String)->Void
    @Environment(AppContainer.self) private var app
    @State private var itinerary: NativeItinerary
    init(initial:NativeItinerary,origin:JSONValue,groupID:String,onLaunch:@escaping (String)->Void) {self.initial=initial;self.origin=origin;self.groupID=groupID;self.onLaunch=onLaunch;_itinerary=State(initialValue:initial)}
    var body: some View {
        Section("Your draft") {TextField("Title",text:$itinerary.title);Text(itinerary.vibe);TextField("Start (HH:MM)",text:$itinerary.start);Text(CostEstimate.moneyRange(itinerary.costRange.0,itinerary.costRange.1)+" per person · ends "+itinerary.timeline.end)}
        ForEach(Array(itinerary.stops.enumerated()),id:\.element.id) {index,stop in
            Section(stop.label) {
                Text(stop.why).font(.subheadline)
                Stepper("Stay \(itinerary.stops[index].minutes) minutes",value:$itinerary.stops[index].minutes,in:15...600,step:15)
                if !stop.options.isEmpty {Picker("Venue",selection:$itinerary.stops[index].pick) {ForEach(Array(stop.options.enumerated()),id:\.element.key) {i,v in Text(v.title).tag(i)}}}
                ActionButton(title:stop.options.isEmpty ? "Find venues" : "Find other venues",workingTitle:"Looking nearby…") {
                    guard let lat=origin["lat"].number,let lon=origin["lon"].number else {throw ServiceFailure(message:"Add a home area or ZIP code in your planning settings so Sync knows where to look.")}
                    let result=try await app.call("scoutItineraryStop",["kind":.string(stop.kind),"near":.object(["lat":.number(lat),"lon":.number(lon),"label":origin["label"],"zip":origin["zip"]]),"maxSpend":itinerary.budgetPerPerson.map {.number($0)} ?? .null,"exclude":.array(stop.options.map {.string($0.key)})])
                    itinerary.stops[index].options=try result.decoded([ItineraryVenue].self);itinerary.stops[index].pick=0
                }
                Toggle("Group votes on this stop",isOn:Binding(get:{itinerary.anchor == index},set:{if $0 {itinerary.anchor=index}}))
            }
        }
        Section("Timeline") {ForEach(itinerary.timeline.stops,id:\.stop.id) {r in LabeledContent(r.stop.label,value:"\(r.start)–\(r.end)");if let minutes=r.driveMinutes {Text("\(minutes) min to this stop").font(.caption)}}}
        Section {
            ActionButton(title:"Check weather") {guard let venue=itinerary.stops.first?.chosen,let date=itinerary.date else {throw ServiceFailure(message:"Choose a first venue and date to check the forecast.")};let value=try await app.call("itineraryForecast",["lat":.number(venue.lat),"lon":.number(venue.lon),"date":.string(date)]);itinerary.weather=try value.decoded(ItineraryWeather?.self)}
            if let weather=itinerary.weather {Text("\(weather.emoji) \(weather.line)")}
            ActionButton(title:"Launch itinerary",workingTitle:"Launching…") {
                guard !groupID.isEmpty,!itinerary.stops.isEmpty,itinerary.stops.allSatisfy({$0.chosen != nil}) else {throw ServiceFailure(message:"Choose a group and a venue for every stop.")}
                let result=try await app.call("launchItinerary",["groupId":.string(groupID),"timeZone":.string(TimeZone.current.identifier),"itinerary":try JSONValue.encoded(itinerary)])
                onLaunch(result["planId"].text)
            }.buttonStyle(.borderedProminent)
        }
    }
}
struct ItineraryPlanView: View {
    let itinerary: NativeItinerary
    var body: some View {ForEach(itinerary.timeline.stops,id:\.stop.id) {r in VStack(alignment:.leading) {Text(r.stop.chosen?.title ?? r.stop.label).font(.headline);Text("\(r.start)–\(r.end)");if let venue=r.stop.chosen {Text(venue.address ?? "");Map {Marker(venue.title,coordinate:.init(latitude:venue.lat,longitude:venue.lon))}.frame(height:150)}}};if let weather=itinerary.weather {Text("\(weather.emoji) \(weather.line)")}}
}
